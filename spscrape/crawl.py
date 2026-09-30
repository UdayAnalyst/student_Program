"""Crawl one company's website toward its student / early-careers pages and collect programs.

Navigation rules (learned the hard way — "students" and "insights" links on a homepage
usually lead to product discounts or market commentary, not careers):
  - From the homepage, follow only "Careers"-type links.
  - After that, follow only links whose URL looks like a careers page, preferring
    student/university/early-career ones, and never news/blog/store/product pages.
"""

from __future__ import annotations

import heapq
import itertools
import logging
import re
import time
from urllib.parse import urlparse

from .extract import ATS_HOSTS, analyze, programs_from_page
from .fetch import Fetcher
from .models import StudentProgram
from .sources import registrable_domain
from .text import STRONG_NAME_RE, UNDERCLASS_RE

log = logging.getLogger("student_programs")

MAX_PAGES = 15        # pages fetched per company
MAX_RENDERS = 3       # of which rendered in Chromium (slow)
MAX_DEPTH = 4
COMPANY_TIME_S = 150  # stop crawling a company after this long and keep what was found

CAREER_LINK_RE = re.compile(r"\b(careers?|jobs|join (?:us|our team)|work (?:with|at|for) us|life at)\b", re.I)
# URL (host + path) of a careers-area page.
CAREERS_URL_RE = re.compile(
    r"careers?|jobs|students?|universit|campus|early[-_]?(?:careers?|talent)|graduates?|interns?|emerging[-_]talent"
    r"|people[-_]opportunities|join[-_]?us|talent|recruit|life[-_]at|programs?[-_]and[-_](?:internships|events)",
    re.I,
)
STUDENT_LINK_RE = re.compile(
    r"\b(students?|universit(?:y|ies)|campus|early[- ]?careers?|emerging[- ]talent|graduates?|interns?(?:hips?)?"
    r"|programs?|insights?|explore|discover(?:y)?|sophomores?|freshm[ae]n|first[- ]year|summits?|events?"
    r"|pathways?|academy|fellowships?)\b",
    re.I,
)
SKIP_PATH_RE = re.compile(
    r"/(?:news|newsroom|press|blog|insights?/(?:topics|articles|podcasts|videos)|articles?|podcasts?|videos?|store|shop"
    r"|products?|pricing|investors?|search|login|signin|privacy|legal|terms|cookie)(?:/|$)",
    re.I,
)
SKIP_EXT_RE = re.compile(r"\.(?:pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3|ics|xml|json)$", re.I)
SKIP_HOSTS = ATS_HOSTS + (
    "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "tiktok.com",
    "glassdoor.com", "indeed.com", "ziprecruiter.com", "apps.apple.com", "play.google.com", "wikipedia.org",
)
# Common student-page locations, tried up front (cheap 404s if absent).
SEED_PATHS = ("careers/students", "careers/university", "careers/early-careers", "students", "university", "early-careers")


def _normalize(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc.lower()}{p.path.rstrip('/') or '/'}" + (f"?{p.query}" if p.query else "")


def _is_careers_url(url: str) -> bool:
    p = urlparse(url)
    host = p.netloc.lower().removeprefix("www.").rsplit(".", 1)[0]  # 'careers.x', 'metacareers'
    return bool(CAREERS_URL_RE.search(f"{host} {p.path}"))


async def crawl_company(fetcher: Fetcher, company: str, domain: str) -> tuple[list[StudentProgram], int]:
    """Best-first crawl: student-ish careers links first. Returns (programs, pages fetched)."""
    base = registrable_domain(domain)
    allowed = {base}
    stop_at = time.monotonic() + COMPANY_TIME_S
    heap: list[tuple[float, int, int, str]] = []
    seen: set[str] = set()
    tiebreak = itertools.count()

    def push(url: str, depth: int, priority: float) -> None:
        key = _normalize(url)
        if key not in seen:
            seen.add(key)
            heapq.heappush(heap, (-priority, depth, next(tiebreak), url))

    for path in SEED_PATHS:
        push(f"https://www.{base}/{path}", 1, 4)
    push(f"https://careers.{base}/", 1, 3.5)
    push(f"https://www.{base}/careers", 1, 3.5)
    push(f"https://www.{base}/", 0, 2)

    programs: dict[str, StudentProgram] = {}
    processed: set[str] = set()  # final URLs, so redirects to an already-seen page aren't re-parsed
    pages = renders = 0
    while heap and pages < MAX_PAGES and time.monotonic() < stop_at:
        _, depth, _, url = heapq.heappop(heap)
        try:
            doc = await fetcher.get(url, allow_render=renders < MAX_RENDERS)
        except Exception as exc:  # dead link, DNS failure, robots.txt... just move on
            log.debug("crawl %s d%d %s FAILED: %s", company, depth, url,
                      str(exc).splitlines()[0][:120] if str(exc) else type(exc).__name__)
            continue
        final_reg = registrable_domain(urlparse(doc.url).netloc)
        if final_reg not in allowed:
            # A /careers link that redirects to a separate careers site (e.g. capitalonecareers.com)
            # is fine; a short link that bounces to some unrelated product site is not.
            if depth > 1 or not _is_careers_url(doc.url):
                log.debug("crawl %s d%d %s redirected off-site to %s; skipped", company, depth, url, doc.url)
                continue
            allowed.add(final_reg)
        final_key = _normalize(doc.url)
        if final_key in processed:
            continue
        processed.add(final_key)
        seen.add(final_key)
        pages += 1
        renders += doc.rendered

        info = analyze(doc.html, doc.url, company)
        found = programs_from_page(info, company=company, source="crawl")
        log.debug("crawl %s d%d %s%s -> %d program(s)", company, depth, doc.url,
                  " [rendered]" if doc.rendered else "", len(found))
        for p in found:
            programs.setdefault(p.program_name.lower(), p)

        if depth >= MAX_DEPTH:
            continue
        for link, label in info.links:
            parsed = urlparse(link)
            if parsed.scheme not in ("http", "https") or SKIP_EXT_RE.search(parsed.path) or SKIP_PATH_RE.search(parsed.path):
                continue
            if any(h in parsed.netloc.lower() for h in SKIP_HOSTS):
                continue
            haystack = f"{label} {parsed.path.replace('-', ' ').replace('_', ' ')}"
            is_career = bool(CAREER_LINK_RE.search(haystack))
            is_strong = bool(STRONG_NAME_RE.search(haystack) or UNDERCLASS_RE.search(haystack))
            is_student = bool(STUDENT_LINK_RE.search(haystack))
            if depth == 0:
                if not is_career:
                    continue  # homepage: careers links only
            elif not (_is_careers_url(link) and (is_student or is_career or is_strong)):
                continue
            reg = registrable_domain(parsed.netloc)
            if reg not in allowed:
                if not (is_career and depth <= 1):
                    continue
                allowed.add(reg)  # follow the main site's "Careers" link to its own domain, once
            priority = 5.0 if is_strong else 3.0 if is_student else 1.5
            push(link, depth + 1, priority - 0.3 * depth)
    return list(programs.values()), pages
