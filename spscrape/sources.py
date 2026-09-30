"""Inputs: companies.csv, manual_targets.csv, and community-curated underclassmen program lists."""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from .fetch import Fetcher
from .text import PROGRAM_WORD_RE, STRONG_NAME_RE, UNDERCLASS_RE, clean

log = logging.getLogger("student_programs")

# README tables of community-maintained underclassmen lists. `sections` selects which
# "## Heading" sections hold pre-internship programs (skipping scholarships, resources, etc.).
CURATED_LISTS = [
    {
        "repo": "LuisaE/opportunities",
        "sections": r"cs underclassmen internships|cs exploratory programs",
        "all_tech": True,  # these sections are CS-only, curated by hand
    },
    {
        "repo": "Jose-Gael-Cruz-Lopez/underclassmen-opportunities",
        "sections": r"underclassmen internships|underclassmen programs|hbcu|women in tech|rising freshmen",
        "all_tech": False,  # mixed fields; the tech filter decides per program
    },
]


@dataclass(frozen=True)
class Company:
    company: str
    domain: str
    ats_board: str
    priority: bool = False


@dataclass(frozen=True)
class ManualTarget:
    company: str
    url: str
    program_name: str


@dataclass(frozen=True)
class Seed:
    company: str  # may be empty; resolved from the link's domain later
    name: str
    link: str
    description: str
    status: str  # Open / Closed / Unknown, as the list reports it
    list_repo: str
    all_tech: bool


def registrable_domain(host: str) -> str:
    """'careers.jpmorgan.com' -> 'jpmorgan.com'; handles 'x.co.uk'-style suffixes."""
    parts = host.lower().split(":")[0].removeprefix("www.").split(".")
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in ("co", "com", "ac", "org", "net", "gov"):
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def load_companies(path: Path) -> list[Company]:
    with path.open(newline="", encoding="utf-8") as f:
        return [Company(clean(r["company"]), clean(r.get("domain")), clean(r.get("ats_board")),
                        clean(r.get("priority")) == "1")
                for r in csv.DictReader(f) if clean(r.get("company"))]


def load_manual_targets(path: Path) -> list[ManualTarget]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return [ManualTarget(clean(r["company"]), clean(r["url"]), clean(r.get("program_name")))
                for r in csv.DictReader(f) if clean(r.get("url"))]


# --- Curated README tables ----------------------------------------------------

_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")
_HREF_RE = re.compile(r'href="(https?://[^"]+)"')
_TAG_RE = re.compile(r"<[^>]+>")
_SKIP_LINK_RE = re.compile(r"shields\.io|github\.com/.*/(?:issues|blob|tree)|imgur|\.(?:png|jpe?g|gif|svg)$", re.I)


def _cell_text(cell: str) -> str:
    text = _MD_LINK_RE.sub(r"\1", cell)
    text = _TAG_RE.sub(" ", text)
    return clean(re.sub(r"[*_`]+", "", text))


def _row_link(cells: list[str]) -> str | None:
    for cell in cells:
        for url in [m.group(2) for m in _MD_LINK_RE.finditer(cell)] + _HREF_RE.findall(cell):
            if not _SKIP_LINK_RE.search(url):
                return url
    return None


def parse_curated_readme(markdown: str, *, sections: str, repo: str, all_tech: bool = False) -> list[Seed]:
    """Parse every markdown table in the selected '## ' sections into Seeds, using header names."""
    wanted = re.compile(sections, re.I)
    seeds: list[Seed] = []
    in_section = False
    header: list[str] | None = None
    for line in markdown.splitlines():
        if line.startswith("## "):
            in_section = bool(wanted.search(line))
            header = None
            continue
        if not in_section or not line.lstrip().startswith("|"):
            header = None if not line.strip() else header
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells if c):
            continue  # |---|---| separator
        if header is None:
            header = [_cell_text(c).lower() for c in cells]
            continue
        col = {h: cells[i] for i, h in enumerate(header) if i < len(cells)}
        link = _row_link(cells)
        if not link:
            continue
        company = _cell_text(next((col[h] for h in col if h in ("company", "organization", "university/organization")), ""))
        name_cell = next((col[h] for h in col if h in ("role", "program", "opportunity", "name")), "")
        name = _cell_text(name_cell)
        deadline = ""
        if m := re.search(r"\s+[—–-]\s+deadline:\s*(.+)$", name, re.I):
            name, deadline = name[: m.start()], m.group(1)
        deadline = deadline or _cell_text(col.get("approximate deadline", "") or col.get("deadline", ""))
        description = _cell_text(col.get("description", "")) or " ".join(
            _cell_text(col.get(h, "")) for h in ("type", "location") if col.get(h))
        row_text = _cell_text(line)
        status = "Closed" if re.search(r"\bclosed\b|🔒|❌", row_text, re.I) else (
            "Open" if re.search(r"\bopen\b|✅", _cell_text(col.get("status", "")), re.I) else "Unknown")
        # The Jose-Gael list mixes ordinary internships into the programs; keep program-shaped rows.
        if not (STRONG_NAME_RE.search(name) or UNDERCLASS_RE.search(f"{name} {description}")
                or PROGRAM_WORD_RE.search(re.sub(r"\binterns?(?:hips?)?\b", "", name, flags=re.I))):
            continue
        if name:
            seeds.append(Seed(company=company, name=name, link=link,
                              description=clean(f"{description} Deadline: {deadline}." if deadline else description),
                              status=status, list_repo=repo, all_tech=all_tech))
    return seeds


async def load_curated_seeds(fetcher: Fetcher) -> list[Seed]:
    seeds: list[Seed] = []
    for cfg in CURATED_LISTS:
        url = f"https://raw.githubusercontent.com/{cfg['repo']}/HEAD/README.md"
        try:
            markdown = await fetcher.text(url)
        except Exception as exc:  # a missing list shouldn't stop the run
            log.warning("Could not load curated list %s: %s", cfg["repo"], exc)
            continue
        parsed = parse_curated_readme(markdown, sections=cfg["sections"], repo=cfg["repo"], all_tech=cfg["all_tech"])
        log.info("Curated list %s: %d programs", cfg["repo"], len(parsed))
        seeds.extend(parsed)
    return seeds


def company_for_seed(name: str, url: str, domain_names: dict[str, str]) -> str:
    """Company for a list entry that has no company column.

    Tries, in order: a known company named in the program title ("... Morgan Stanley"),
    the link's domain, the domain minus careers-site affixes ("pgcareers.com" -> "pg.com",
    "withgoogle.com" -> "google.com"), and finally the bare domain label.
    """
    lowered = f" {name.lower()} "
    for company in sorted(set(domain_names.values()), key=len, reverse=True):
        if len(company) >= 4 and re.search(rf"\b{re.escape(company.lower())}\b", lowered):
            return company
    reg = registrable_domain(urlparse(url).netloc)
    if reg in domain_names:
        return domain_names[reg]
    label, _, tld = reg.partition(".")
    stripped = re.sub(r"^(?:with|join|life|work)|(?:careers?|jobs|talent)$", "", label)
    if stripped and f"{stripped}.{tld}" in domain_names:
        return domain_names[f"{stripped}.{tld}"]
    return label.replace("-", " ").title()
