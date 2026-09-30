"""Orchestrates all sources, applies the tech filter, dedupes, and writes the output files."""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable

from playwright.async_api import async_playwright

from .ats import scan_board
from .crawl import crawl_company
from .extract import analyze, page_record, section_records
from .fetch import USER_AGENT, Fetcher, block_heavy_resources
from .models import StudentProgram, build_program
from .sources import (
    Company,
    ManualTarget,
    Seed,
    company_for_seed,
    load_companies,
    load_curated_seeds,
    load_manual_targets,
    registrable_domain,
)
from .text import detect_status

log = logging.getLogger("student_programs")

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_CSV = ROOT / "companies.csv"
MANUAL_TARGETS_CSV = ROOT / "manual_targets.csv"
DEFAULT_OUT_DIR = ROOT / "output"

HTTP_CONCURRENCY = 64
BROWSER_CONCURRENCY = 6
COMPANY_CONCURRENCY = 40
TASK_TIMEOUT_S = 300  # backstop; crawl_company has its own softer per-company budget
SOURCE_PRIORITY = {"manual": 0, "curated": 1, "crawl": 2, "greenhouse": 3, "lever": 3, "ashby": 3, "workday": 3}


class Runner:
    def __init__(self, fetcher: Fetcher, deadline: float):
        self.fetcher = fetcher
        self.deadline = deadline
        self.sem = asyncio.Semaphore(COMPANY_CONCURRENCY)
        self.failures: list[dict] = []
        self.skipped_for_time = 0
        self.pages_crawled = 0
        self.done = 0
        self.total = 0

    async def guarded(self, label: str, url: str, job: Callable[[], Awaitable[list[StudentProgram]]]) -> list[StudentProgram]:
        """Run one unit of work; never raises, so one bad site can't kill the run."""
        async with self.sem:
            try:
                if time.monotonic() > self.deadline:
                    self.skipped_for_time += 1
                    return []
                return await asyncio.wait_for(job(), TASK_TIMEOUT_S)
            except Exception as exc:
                message = (str(exc).splitlines() or [""])[0][:200] or type(exc).__name__
                log.debug("Failed %s (%s): %s", label, url, message)
                self.failures.append({"target": label, "url": url, "error": message})
                return []
            finally:
                self.done += 1
                if self.done % 100 == 0 or self.done == self.total:
                    log.info("Progress: %d/%d tasks, %d failed", self.done, self.total, len(self.failures))

    # --- per-source jobs --------------------------------------------------

    async def manual(self, t: ManualTarget) -> list[StudentProgram]:
        doc = await self.fetcher.get(t.url)
        info = analyze(doc.html, doc.url, t.company)
        records = [page_record(info, company=t.company, name=t.program_name or info.title or t.company, source="manual")]
        return [r for r in records if r] + section_records(info, company=t.company, source="manual")

    async def curated(self, seed: Seed, company: str) -> list[StudentProgram]:
        """Visit the listed link to refresh status and classification; fall back to the list's own data."""
        try:
            doc = await self.fetcher.get(seed.link)
        except Exception as exc:
            log.debug("Curated link unreachable %s: %s", seed.link, exc)
            record = build_program(company=company, name=seed.name, text=seed.description, link=seed.link,
                                   source_url=seed.link, source="curated", status=seed.status,
                                   description=seed.description or seed.name, tech=seed.all_tech or None)
            return [record] if record else []
        info = analyze(doc.html, doc.url, company)
        page_status = detect_status(info.text)
        record = page_record(
            info, company=company, name=seed.name, source="curated", link=seed.link,
            status=page_status if page_status != "Unknown" else seed.status,
            description=seed.description or None, extra_text=seed.description, tech=seed.all_tech or None,
        )
        return [record] if record else []

    async def crawl(self, c: Company) -> list[StudentProgram]:
        programs, pages = await crawl_company(self.fetcher, c.company, c.domain)
        self.pages_crawled += pages
        return programs

    async def board(self, c: Company) -> list[StudentProgram]:
        return await scan_board(self.fetcher, c.company, c.ats_board)


# --- merge / export ---------------------------------------------------------

_STOPWORDS = {"program", "programme", "internship", "intern", "the", "for", "and", "of", "at", "a", "an", "to",
              "in", "summer", "students", "student", "s"}


def _company_key(name: str) -> str:
    name = re.sub(r"[^a-z0-9 ]", " ", name.lower())
    name = re.sub(r"\b(inc|llc|corp|corporation|co|company|group|holdings|the|ltd|plc)\b", " ", name)
    return "".join(name.split())


def _name_key(company: str, name: str) -> frozenset[str]:
    """Order-insensitive program key: 'Microsoft Explore' == 'Explore Program at Microsoft'."""
    words = set(re.findall(r"[a-z0-9]+", name.lower()))
    company_words = set(re.findall(r"[a-z0-9]+", company.lower()))
    return frozenset(w for w in words - company_words - _STOPWORDS if not re.fullmatch(r"20\d\d", w))


def merge(records: list[StudentProgram]) -> tuple[list[StudentProgram], list[str]]:
    """Keep tech programs only; dedupe preferring manual > curated > crawl > job boards."""
    records = sorted(records, key=lambda r: SOURCE_PRIORITY.get(r.source, 9))
    seen: set[tuple[str, frozenset[str]]] = set()
    kept, non_tech = [], []
    for r in records:
        if not r._tech:
            non_tech.append(f"{r.company_name}: {r.program_name} [{r.source}]")
            continue
        key = (_company_key(r.company_name), _name_key(r.company_name, r.program_name))
        if not key[1] or key in seen:
            continue
        seen.add(key)
        kept.append(r)
    return sorted(kept, key=lambda r: (r.company_name.lower(), r.program_name.lower())), non_tech


def export(programs: list[StudentProgram], out_dir: Path, report: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = [p.model_dump() for p in programs]
    (out_dir / "student_programs.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    with (out_dir / "student_programs.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(StudentProgram.model_fields))
        writer.writeheader()
        writer.writerows(rows)
    (out_dir / "scrape_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


async def run(args: argparse.Namespace) -> None:
    started = time.monotonic()
    companies = load_companies(COMPANIES_CSV)
    domain_names = {registrable_domain(c.domain): c.company for c in companies if c.domain}
    if args.companies:
        wanted = {n.strip().lower() for n in args.companies.split(",")}
        companies = [c for c in companies if c.company.lower() in wanted]
    # Large employers first: if the time budget runs out, the long tail is what gets skipped.
    companies.sort(key=lambda c: not c.priority)
    if args.limit:
        companies = companies[: args.limit]
    manual_targets = load_manual_targets(MANUAL_TARGETS_CSV)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=not args.headful)
        context = await browser.new_context(user_agent=USER_AGENT, locale="en-US", viewport={"width": 1366, "height": 900})
        await context.route("**/*", block_heavy_resources)
        try:
            fetcher = Fetcher(context, http_concurrency=HTTP_CONCURRENCY, browser_concurrency=BROWSER_CONCURRENCY)
            runner = Runner(fetcher, deadline=started + args.max_minutes * 60)
            seeds = [] if args.no_curated else await load_curated_seeds(fetcher)

            jobs = [runner.guarded(f"manual: {t.company}", t.url, lambda t=t: runner.manual(t)) for t in manual_targets]
            for s in seeds:
                company = s.company or company_for_seed(s.name, s.link, domain_names)
                jobs.append(runner.guarded(f"curated: {company}", s.link, lambda s=s, c=company: runner.curated(s, c)))
            if not args.no_crawl:
                jobs += [runner.guarded(f"crawl: {c.company}", c.domain, lambda c=c: runner.crawl(c))
                         for c in companies if c.domain]
            jobs += [runner.guarded(f"board: {c.company}", c.ats_board, lambda c=c: runner.board(c))
                     for c in companies if c.ats_board]
            runner.total = len(jobs)
            log.info("Running %d tasks: %d manual, %d curated, %d companies (%d with a domain, %d with a job board)",
                     len(jobs), len(manual_targets), len(seeds), len(companies),
                     sum(bool(c.domain) for c in companies), sum(bool(c.ats_board) for c in companies))
            batches = await asyncio.gather(*jobs)
        finally:
            await context.close()
            await browser.close()

    raw = [p for batch in batches for p in batch]
    programs, non_tech = merge(raw)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "duration_min": round((time.monotonic() - started) / 60, 1),
        "programs": len(programs),
        "companies_with_programs": len({_company_key(p.company_name) for p in programs}),
        "by_source": dict(Counter(p.source for p in programs)),
        "by_status": dict(Counter(p.status for p in programs)),
        "by_field": dict(Counter(p.field for p in programs)),
        "candidates_found": len(raw),
        "dropped_non_tech": len(non_tech),
        "dropped_non_tech_examples": sorted(set(non_tech))[:200],
        "companies_in_universe": len(companies),
        "pages_crawled": runner.pages_crawled,
        "tasks": runner.total,
        "tasks_skipped_time_budget": runner.skipped_for_time,
        "tasks_failed": len(runner.failures),
        "failures": sorted(runner.failures, key=lambda f: f["target"].lower()),
    }
    export(programs, args.out_dir, report)
    log.info("Saved %d tech pre-internship programs from %d companies (%s) in %.1f min; %d non-tech dropped, "
             "%d/%d tasks failed", report["programs"], report["companies_with_programs"], report["by_source"],
             report["duration_min"], len(non_tech), len(runner.failures), runner.total)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape tech pre-internship programs for first/second-year students.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--limit", type=int, default=None, help="only the first N companies (for testing)")
    parser.add_argument("--companies", help="comma-separated company names to scrape (for testing)")
    parser.add_argument("--max-minutes", type=float, default=300, help="stop starting new tasks after this long")
    parser.add_argument("--no-crawl", action="store_true", help="skip website crawling (curated lists + job boards only)")
    parser.add_argument("--no-curated", action="store_true", help="skip the community-curated lists")
    parser.add_argument("--headful", action="store_true", help="show the browser window")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    for noisy in ("asyncio",):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    asyncio.run(run(args))
