#!/usr/bin/env python3
"""
Student program scraper.

Crawls company career pages and ATS job boards, extracts early-career student
programs (internships, fellowships, diversity summits, bridge programs, leadership
series), normalizes them into a single schema, and writes
`student_programs.json` + `student_programs.csv`.

Usage:
    python scraper.py                     # scrape TARGETS below
    python scraper.py --headful           # watch the browser (useful for debugging)
    python scraper.py --out-dir output --concurrency 2

To add a site, append a `Target(...)` to TARGETS. The right extractor is chosen
from the URL automatically:
    - boards.greenhouse.io / job-boards.greenhouse.io  -> Greenhouse JSON API
    - jobs.lever.co                                    -> Lever JSON API
    - *.myworkdayjobs.com                              -> Workday CXS JSON API
    - anything else                                    -> rendered-page (Playwright) extractor
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import html
import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable, Literal
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.async_api import (
    BrowserContext,
    Error as PlaywrightError,
    Page,
    Route,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)
from pydantic import BaseModel, Field, ValidationError, field_validator

# ---------------------------------------------------------------------------
# Configuration — edit this section to add/remove targets or tune behaviour.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Target:
    company: str
    url: str
    # Optional override when the page title/h1 is a slogan rather than the program name.
    program_name: str | None = None
    # Optional CSS selector that signals the JS-rendered content has arrived.
    wait_for: str | None = None


TARGETS: list[Target] = [
    Target(
        company="Goldman Sachs",
        url="https://www.goldmansachs.com/careers/students/programs-and-internships/americas/emerging-leaders-series",
        program_name="Emerging Leaders Series",
    ),
    Target(
        company="Jane Street",
        url="https://www.janestreet.com/join-jane-street/programs-and-events/bridge/",
        program_name="Jane Street Bridge",
    ),
    Target(
        company="Break Through Tech",
        url="https://www.breakthroughtech.org/",
        program_name="Break Through Tech",
    ),
    Target(
        company="EY",
        url="https://www.ey.com/en_us/careers/internships-student-programs",
        program_name="EY Internships & Student Programs",
    ),
    # ATS examples — uncomment or add your own:
    # Target(company="Example Co", url="https://boards.greenhouse.io/exampleco"),
    # Target(company="Example Co", url="https://jobs.lever.co/exampleco"),
    # Target(company="Example Co", url="https://exampleco.wd5.myworkdayjobs.com/en-US/External"),
]

DEFAULT_OUT_DIR = Path(__file__).parent / "output"
DEFAULT_CONCURRENCY = 3
NAV_TIMEOUT_MS = 45_000
NETWORK_IDLE_TIMEOUT_MS = 15_000
RETRIES = 2  # extra attempts after the first failure
WORKDAY_SEARCH_TERMS = ("intern", "student", "university", "graduate", "summer")
WORKDAY_MAX_PAGES_PER_TERM = 5
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

log = logging.getLogger("student_programs")

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

Audience = Literal["Undergraduate", "Graduate", "PhD", "High School", "All"]
# "Unknown" is used when a page gives no open/closed/rolling signal at all, so
# the output never claims a status the page didn't state.
Status = Literal["Open", "Closed", "Rolling", "Unknown"]


class StudentProgram(BaseModel):
    company_name: str
    program_name: str
    target_audience: Audience = "All"
    target_year: str = "All"
    field: str = "General"
    application_link: str
    status: Status = "Unknown"
    description: str = ""
    source_url: str
    scraped_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))

    @field_validator("company_name", "program_name", "description", mode="before")
    @classmethod
    def _collapse_whitespace(cls, v: str) -> str:
        return clean(v)

    @field_validator("program_name")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("program_name is empty")
        return v

    @field_validator("application_link", "source_url")
    @classmethod
    def _http_url(cls, v: str) -> str:
        if urlparse(v).scheme not in ("http", "https"):
            raise ValueError(f"not an http(s) URL: {v!r}")
        return v


class ScrapeError(Exception):
    """Raised for recoverable scrape failures (bot walls, empty pages, bad status codes)."""


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def summarize(text: str, max_sentences: int = 2, max_chars: int = 300) -> str:
    """First 1-2 sentences of `text`, capped at max_chars on a word boundary."""
    sentences = re.split(r"(?<=[.!?])\s+", clean(text))
    summary = " ".join(sentences[:max_sentences])
    if len(summary) > max_chars:
        summary = summary[:max_chars].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return summary


def html_to_text(fragment: str) -> str:
    return clean(BeautifulSoup(html.unescape(fragment or ""), "html.parser").get_text(" "))


# ---------------------------------------------------------------------------
# Normalization / classification
# ---------------------------------------------------------------------------

# Order matters only for tie-breaking; scores come from keyword hit counts.
AUDIENCE_RULES: dict[str, list[str]] = {
    "High School": [r"high school", r"secondary school", r"\bhs students?\b"],
    "PhD": [r"\bph\.?\s?d\b", r"doctoral", r"doctorate"],
    "Graduate": [r"\bgraduate (?:students?|degree|program|school)\b", r"\bmaster'?s\b", r"\bmba\b", r"\bgrad students?\b"],
    "Undergraduate": [
        r"undergrad", r"\bbachelor'?s?\b", r"\bfreshm[ae]n\b", r"\bsophomores?\b",
        r"\bcollege students?\b", r"\bfirst[- ]year\b", r"\bsecond[- ]year\b", r"\bjuniors?\b",
    ],
}

YEAR_RULES: dict[str, list[str]] = {
    "Freshman": [r"\bfreshm[ae]n\b", r"\bfirst[- ]year (?:students?|undergrad)", r"\b1st[- ]year\b"],
    "Sophomore": [r"\bsophomores?\b", r"\bsecond[- ]year (?:students?|undergrad)", r"\b2nd[- ]year\b"],
    "Junior": [r"\bjuniors?\b(?! analyst| developer| engineer)", r"\bthird[- ]year (?:students?|undergrad)", r"\bpenultimate[- ]year\b"],
    "Senior": [r"\bseniors?\b(?! analyst| developer| engineer| manager| associate| leaders?| leadership| executives?| vice| director)", r"\bfinal[- ]year\b", r"\bfourth[- ]year\b"],
}

FIELD_RULES: dict[str, list[str]] = {
    "Tech/Software": [
        r"\bsoftware\b", r"\bcomputer science\b", r"\bcoding\b", r"\bprogramming\b", r"\bdevelopers?\b",
        r"\bdata science\b", r"\bmachine learning\b", r"\b(?:ai|ml)\b", r"\btechnology\b", r"\btech\b", r"\bstem\b",
    ],
    "Finance/Quant": [
        r"\bfinance\b", r"\bfinancial\b", r"\btrading\b", r"\btraders?\b", r"\bquant(?:itative)?\b",
        r"\binvestment banking\b", r"\bmarkets\b", r"\basset management\b", r"\bsecurities\b", r"\bwealth management\b",
    ],
    "Consulting": [
        r"\bconsulting\b", r"\bconsultants?\b", r"\badvisory\b", r"\bassurance\b", r"\baudit\b",
        r"\btax\b", r"\bstrategy and transactions\b",
    ],
}

# Titles that indicate an early-career role on an ATS board.
EARLY_CAREER_RE = re.compile(
    r"\b(intern(?:ship)?s?|co-?op|fellow(?:ship)?s?|students?|university|campus|new grad(?:uate)?|"
    r"graduate program|summer (?:analyst|associate)|apprentice(?:ship)?s?|early career|entry[- ]level|"
    r"bridge|insight|scholars?(?:hip)?)\b",
    re.I,
)


def _scores(text: str, rules: dict[str, list[str]]) -> dict[str, int]:
    return {label: sum(len(re.findall(p, text, re.I)) for p in patterns) for label, patterns in rules.items()}


def classify_audience(text: str) -> str:
    scores = {k: v for k, v in _scores(text, AUDIENCE_RULES).items() if v}
    if not scores:
        return "All"
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    # If a second audience is mentioned nearly as often, the program targets both.
    if len(ranked) > 1 and ranked[1][1] * 2 > ranked[0][1]:
        return "All"
    return ranked[0][0]


def classify_year(text: str) -> str:
    hits = [label for label, n in _scores(text, YEAR_RULES).items() if n]
    return "/".join(hits) if hits else "All"


def classify_field(text: str) -> str:
    ranked = sorted(_scores(text, FIELD_RULES).items(), key=lambda kv: kv[1], reverse=True)
    top_label, top = ranked[0]
    if top < 2 or (len(ranked) > 1 and ranked[1][1] == top):
        return "General"
    return top_label


# --- Status detection -------------------------------------------------------

CLOSED_RE = re.compile(
    r"applications? (?:are|is|have been|has been) (?:now |currently )?closed|no longer accepting|"
    r"not currently accepting|(?:applications?|registration) (?:period )?(?:has |have )?closed|"
    r"applications? will (?:re-?)?open|check back (?:later|soon|in)",
    re.I,
)
ROLLING_RE = re.compile(r"rolling (?:basis|admissions?|applications?)|on a rolling", re.I)
OPEN_RE = re.compile(
    r"apply now|apply today|applications? (?:are|is) (?:now )?open|now accepting|register now|now open",
    re.I,
)
MONTHS = r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
DATE_RE = re.compile(rf"\b(?:(?:{MONTHS})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}|\d{{1,2}}/\d{{1,2}}/\d{{4}})\b", re.I)
DEADLINE_RE = re.compile(r"deadline|apply by|applications? (?:are )?due|closing date|closes?\b|due (?:on|by)", re.I)


def _parse_date(raw: str) -> date | None:
    s = re.sub(r"(\d)(?:st|nd|rd|th)\b", r"\1", raw)
    s = re.sub(r"\bsept\b", "sep", s, flags=re.I)
    s = clean(s.replace(",", " ").replace(".", " "))
    for fmt in ("%B %d %Y", "%b %d %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _deadlines(text: str) -> list[date]:
    found = []
    for m in DEADLINE_RE.finditer(text):
        window = text[m.end(): m.end() + 120]
        if (d := DATE_RE.search(window)) and (parsed := _parse_date(d.group(0))):
            found.append(parsed)
    return found


def detect_status(text: str, today: date | None = None) -> str:
    """Explicit 'closed' text > deadline dates > rolling > 'apply now' > Unknown."""
    today = today or date.today()
    if CLOSED_RE.search(text):
        return "Closed"
    if deadlines := _deadlines(text):
        return "Open" if max(deadlines) >= today else "Closed"
    if ROLLING_RE.search(text):
        return "Rolling"
    if OPEN_RE.search(text):
        return "Open"
    return "Unknown"


def build_program(
    *,
    company: str,
    name: str,
    text: str,
    link: str,
    source_url: str,
    status: str | None = None,
    description: str | None = None,
) -> StudentProgram:
    """Single place where raw scraped text becomes a normalized record."""
    classify_text = f"{name}. {text}"
    return StudentProgram(
        company_name=company,
        program_name=name,
        target_audience=classify_audience(classify_text),
        target_year=classify_year(classify_text),
        field=classify_field(classify_text),
        application_link=link,
        status=status or detect_status(text),
        description=summarize(description or text),
        source_url=source_url,
    )


# ---------------------------------------------------------------------------
# Browser helpers
# ---------------------------------------------------------------------------

BOT_WALL_RE = re.compile(r"access denied|just a moment\.\.\.|verify you are (?:a )?human|captcha|request blocked", re.I)


async def _block_heavy_resources(route: Route) -> None:
    # Images/fonts/media don't carry program data; skipping them speeds up crawls a lot.
    if route.request.resource_type in {"image", "media", "font"}:
        await route.abort()
    else:
        await route.continue_()


async def _dismiss_cookie_banner(page: Page) -> None:
    for selector in ("#onetrust-accept-btn-handler", "button:has-text('Accept all')", "button:has-text('Accept')"):
        try:
            button = page.locator(selector).first
            if await button.is_visible():
                await button.click(timeout=2_000)
                return
        except PlaywrightError:
            continue


async def _auto_scroll(page: Page, steps: int = 8) -> None:
    # Triggers lazy-loaded sections (common on React/Vue marketing pages).
    for _ in range(steps):
        await page.mouse.wheel(0, 1_500)
        await page.wait_for_timeout(300)


async def fetch_rendered_html(context: BrowserContext, target: Target) -> str:
    page = await context.new_page()
    try:
        response = await page.goto(target.url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        if response is not None and response.status >= 400:
            raise ScrapeError(f"HTTP {response.status}")
        try:
            await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
        except PlaywrightTimeoutError:
            pass  # SPAs with analytics beacons may never go idle; the DOM is usually ready anyway.
        if target.wait_for:
            try:
                await page.wait_for_selector(target.wait_for, timeout=NETWORK_IDLE_TIMEOUT_MS)
            except PlaywrightTimeoutError:
                log.warning("%s: selector %r never appeared; parsing what rendered", target.url, target.wait_for)
        await _dismiss_cookie_banner(page)
        await _auto_scroll(page)
        content = await page.content()
    finally:
        await page.close()

    title = BeautifulSoup(content, "html.parser").title
    if title and BOT_WALL_RE.search(title.get_text()):
        raise ScrapeError(f"bot wall detected ({clean(title.get_text())!r})")
    return content


# ---------------------------------------------------------------------------
# Extractors — each takes (context, target) and returns a list of programs.
# ---------------------------------------------------------------------------

Extractor = Callable[[BrowserContext, Target], Awaitable[list[StudentProgram]]]

# Call-to-action verbs score high; the bare noun "application" is weak ("Application tips" isn't a form).
APPLY_TEXT_RE = re.compile(r"\b(apply|register|sign[ -]?up|join the (?:program|waitlist))\b", re.I)
APPLY_NOUN_RE = re.compile(r"\b(application|registration)\b", re.I)
NOT_APPLY_RE = re.compile(r"\b(tips|faqs?|interview|information|process|how to|learn more about)\b", re.I)
ATS_HOSTS = (
    "myworkdayjobs.com", "greenhouse.io", "lever.co", "icims.com", "taleo.net", "smartrecruiters.com",
    "successfactors", "oraclecloud.com", "brassring.com", "jobvite.com", "ashbyhq.com", "eightfold.ai",
)
NOISE_SELECTORS = (
    "script", "style", "noscript", "svg", "iframe", "nav", "footer",
    '[id*="cookie" i]', '[class*="cookie" i]', '[id*="onetrust" i]',
)


def _meta(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return clean(tag.get("content")) if tag else ""


def _strip_site_suffix(title: str, company: str) -> str:
    """'Emerging Leaders Series | Goldman Sachs' -> 'Emerging Leaders Series'."""
    parts = [p.strip() for p in re.split(r"\s+[|–—-]\s+|\s*::\s*", title) if p.strip()]
    if not parts:
        return ""
    keep = [p for p in parts if company.lower() not in p.lower()]
    return (keep or parts)[0]


def extract_program_name(soup: BeautifulSoup, target: Target) -> str:
    if target.program_name:
        return target.program_name
    h1 = soup.find("h1")
    for raw in (_meta(soup, "og:title"), h1.get_text(" ") if h1 else "", soup.title.get_text() if soup.title else ""):
        name = _strip_site_suffix(clean(raw), target.company)
        if name and len(name) <= 120:
            return name
    return f"{target.company} Student Program"


def find_application_link(soup: BeautifulSoup, base_url: str) -> str:
    """Best-scoring 'Apply'/'Register' link on the page, falling back to the page itself."""
    best, best_score = base_url, 0
    for a in soup.find_all("a", href=True):
        if a.find_parent(["nav", "footer"]):
            continue
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        url = urljoin(base_url, href)
        label = clean(" ".join([a.get_text(" "), a.get("aria-label", ""), a.get("title", "")]))
        score = 0
        if APPLY_TEXT_RE.search(label):
            score += 3
        elif APPLY_NOUN_RE.search(label):
            score += 1
        if NOT_APPLY_RE.search(label):
            score -= 2
        if re.search(r"apply|application|register", href, re.I):
            score += 1
        if any(h in urlparse(url).netloc.lower() for h in ATS_HOSTS):
            score += 2
        if score > best_score:
            best, best_score = url, score
    return best


STUDENT_CONTEXT_RE = re.compile(r"\b(students?|undergrad\w*|interns?(?:hips?)?|program(?:me)?s?|fellows?(?:hip)?|graduat\w+|campus)\b", re.I)


def _best_description(soup: BeautifulSoup, program_name: str, text: str, min_len: int = 60) -> str:
    """Prefer a paragraph that talks about the program over the site's generic 'about us' blurb."""
    root = soup.find("main") or soup.find(attrs={"role": "main"}) or soup.body or soup
    paragraphs = [t for p in root.find_all("p") if len(t := clean(p.get_text(" "))) >= min_len]
    for para in paragraphs:
        if program_name.lower() in para.lower():
            return para
    for para in paragraphs:
        if STUDENT_CONTEXT_RE.search(para):
            return para
    # Many SPAs put copy in <div>s, not <p>s — fall back to the first on-topic sentence.
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(sentence) >= min_len and STUDENT_CONTEXT_RE.search(sentence):
            return sentence
    return ""


async def extract_generic(context: BrowserContext, target: Target) -> list[StudentProgram]:
    """Render the page with Playwright and pull one program record from it."""
    soup = BeautifulSoup(await fetch_rendered_html(context, target), "html.parser")

    # Title/meta/links are read before noise removal — hero <header>s often hold the h1 and CTA.
    name = extract_program_name(soup, target)
    link = find_application_link(soup, target.url)
    meta_description = _meta(soup, "og:description") or _meta(soup, "description")

    for selector in NOISE_SELECTORS:
        for tag in soup.select(selector):
            tag.decompose()
    root = soup.find("main") or soup.body or soup
    text = clean(root.get_text(" "))
    if len(text) < 200:
        raise ScrapeError(f"only {len(text)} chars of content rendered — blocked, or needs a `wait_for` selector")
    if BOT_WALL_RE.search(text[:500]):
        raise ScrapeError("bot wall detected in page body")

    description = _best_description(soup, name, text) or meta_description or text
    return [build_program(company=target.company, name=name, text=text, link=link,
                          source_url=target.url, description=description)]


def _safe_build(**kwargs) -> StudentProgram | None:
    try:
        return build_program(**kwargs)
    except ValidationError as exc:
        log.warning("Dropping invalid record %r: %s", kwargs.get("name"), exc.errors()[0]["msg"])
        return None


async def _get_json(context: BrowserContext, url: str, *, post_body: dict | None = None):
    response = await (context.request.post(url, data=post_body) if post_body is not None else context.request.get(url))
    if not response.ok:
        raise ScrapeError(f"HTTP {response.status} from {url}")
    return await response.json()


async def extract_greenhouse(context: BrowserContext, target: Target) -> list[StudentProgram]:
    token = urlparse(target.url).path.strip("/").split("/")[0]
    data = await _get_json(context, f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true")
    programs = []
    for job in data.get("jobs", []):
        title = job.get("title", "")
        if not EARLY_CAREER_RE.search(title):
            continue
        body = html_to_text(job.get("content", ""))
        location = (job.get("location") or {}).get("name", "")
        program = _safe_build(company=target.company, name=title, text=f"{body} {location}",
                              link=job.get("absolute_url", target.url), source_url=target.url,
                              status="Open")  # only live postings are listed on the board
        if program:
            programs.append(program)
    return programs


async def extract_lever(context: BrowserContext, target: Target) -> list[StudentProgram]:
    slug = urlparse(target.url).path.strip("/").split("/")[0]
    postings = await _get_json(context, f"https://api.lever.co/v0/postings/{slug}?mode=json")
    programs = []
    for job in postings:
        title = job.get("text", "")
        categories = job.get("categories") or {}
        if not EARLY_CAREER_RE.search(f"{title} {categories.get('commitment', '')}"):
            continue
        body = job.get("descriptionPlain", "")
        program = _safe_build(company=target.company, name=title,
                              text=f"{body} {categories.get('team', '')} {categories.get('commitment', '')}",
                              link=job.get("applyUrl") or job.get("hostedUrl") or target.url,
                              source_url=target.url, status="Open")
        if program:
            programs.append(program)
    return programs


async def extract_workday(context: BrowserContext, target: Target) -> list[StudentProgram]:
    """Workday career sites are React SPAs backed by a JSON 'CXS' endpoint; query it directly."""
    parsed = urlparse(target.url)
    tenant = parsed.netloc.split(".")[0]
    segments = [s for s in parsed.path.strip("/").split("/") if s and not re.fullmatch(r"[a-z]{2}-[A-Z]{2}", s)]
    if not segments:
        raise ScrapeError("could not find the Workday site name in the URL")
    site = segments[0]
    endpoint = f"https://{parsed.netloc}/wday/cxs/{tenant}/{site}/jobs"

    seen: dict[str, dict] = {}
    for term in WORKDAY_SEARCH_TERMS:
        for page_no in range(WORKDAY_MAX_PAGES_PER_TERM):
            data = await _get_json(context, endpoint, post_body={
                "appliedFacets": {}, "limit": 20, "offset": page_no * 20, "searchText": term,
            })
            postings = data.get("jobPostings", [])
            for job in postings:
                if EARLY_CAREER_RE.search(job.get("title", "")):
                    seen.setdefault(job.get("externalPath", job.get("title")), job)
            if len(postings) < 20:
                break

    programs = []
    for path, job in seen.items():
        program = _safe_build(company=target.company, name=job["title"],
                              text=f"{job['title']} {job.get('locationsText', '')}",
                              link=f"https://{parsed.netloc}/{site}{path}", source_url=target.url,
                              status="Open",
                              description=f"{job['title']} — {job.get('locationsText', 'location not listed')}.")
        if program:
            programs.append(program)
    return programs


def pick_extractor(url: str) -> Extractor:
    host = urlparse(url).netloc.lower()
    if host.endswith("greenhouse.io"):
        return extract_greenhouse
    if host == "jobs.lever.co":
        return extract_lever
    if host.endswith("myworkdayjobs.com"):
        return extract_workday
    return extract_generic


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


async def _with_retries(extractor: Extractor, context: BrowserContext, target: Target) -> list[StudentProgram]:
    for attempt in range(1, RETRIES + 2):
        try:
            return await extractor(context, target)
        except (PlaywrightError, ScrapeError) as exc:  # PlaywrightTimeoutError subclasses PlaywrightError
            if attempt > RETRIES:
                raise
            delay = 2 ** attempt
            log.warning("%s: attempt %d failed (%s); retrying in %ds", target.url, attempt, str(exc).splitlines()[0], delay)
            await asyncio.sleep(delay)
    return []  # unreachable; keeps type checkers happy


async def scrape_target(context: BrowserContext, target: Target, sem: asyncio.Semaphore) -> list[StudentProgram]:
    """Never raises: one broken site must not kill the whole run."""
    async with sem:
        extractor = pick_extractor(target.url)
        log.info("Scraping %s (%s) via %s", target.company, target.url, extractor.__name__)
        try:
            programs = await _with_retries(extractor, context, target)
        except Exception as exc:
            if extractor is extract_generic:
                log.error("Skipping %s: %s", target.url, str(exc).splitlines()[0])
                return []
            # ATS API failed (changed endpoint, private board...) — fall back to rendering the page.
            log.warning("%s API failed (%s); falling back to page rendering", extractor.__name__, exc)
            try:
                programs = await _with_retries(extract_generic, context, target)
            except Exception as fallback_exc:
                log.error("Skipping %s: %s", target.url, str(fallback_exc).splitlines()[0])
                return []
        log.info("%s: %d program(s)", target.company, len(programs))
        return programs


def dedupe(programs: list[StudentProgram]) -> list[StudentProgram]:
    seen, unique = set(), []
    for p in programs:
        key = (p.company_name.lower(), p.program_name.lower(), p.application_link)
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def export(programs: list[StudentProgram], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = [p.model_dump() for p in programs]
    json_path = out_dir / "student_programs.json"
    csv_path = out_dir / "student_programs.csv"
    json_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(StudentProgram.model_fields))
        writer.writeheader()
        writer.writerows(rows)
    return json_path, csv_path


async def run(targets: list[Target], out_dir: Path, headful: bool, concurrency: int) -> list[StudentProgram]:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=not headful)
        context = await browser.new_context(user_agent=USER_AGENT, locale="en-US",
                                            viewport={"width": 1366, "height": 900})
        context.set_default_timeout(NAV_TIMEOUT_MS)
        await context.route("**/*", _block_heavy_resources)
        try:
            sem = asyncio.Semaphore(concurrency)
            batches = await asyncio.gather(*(scrape_target(context, t, sem) for t in targets))
        finally:
            await context.close()
            await browser.close()

    programs = dedupe([p for batch in batches for p in batch])
    json_path, csv_path = export(programs, out_dir)
    log.info("Saved %d program(s) to %s and %s", len(programs), json_path, csv_path)
    return programs


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape early-career student programs.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--headful", action="store_true", help="show the browser window")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    asyncio.run(run(TARGETS, args.out_dir, args.headful, args.concurrency))


if __name__ == "__main__":
    main()
