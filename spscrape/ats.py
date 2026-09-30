"""Scan ATS job boards (Greenhouse, Lever, Ashby, Workday) for pre-internship postings via their JSON APIs."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from .fetch import Fetcher
from .models import StudentProgram, build_program
from .text import html_to_text, is_pre_internship_title

WORKDAY_SEARCH_TERMS = ("sophomore", "freshman", "first year", "insight", "discovery", "explore", "extern", "summit")
_LOCALE_RE = re.compile(r"[a-z]{2}-[A-Z]{2}")


def board_url(job_url: str) -> str | None:
    """Map one job-posting URL to the company's whole board, if it's a board we can query."""
    parsed = urlparse(job_url)
    host = parsed.netloc.lower()
    segments = [s for s in parsed.path.split("/") if s]
    if not segments:
        return None
    if host.endswith("greenhouse.io") and host.split(".")[0] in ("boards", "job-boards"):
        return f"https://boards.greenhouse.io/{segments[0]}"
    if host in ("jobs.lever.co", "jobs.ashbyhq.com"):
        return f"https://{host}/{segments[0]}"
    if host.endswith("myworkdayjobs.com"):
        segments = [s for s in segments if not _LOCALE_RE.fullmatch(s)]
        if segments and segments[0] != "job":
            return f"https://{parsed.netloc}/{segments[0]}"
    return None


async def _greenhouse(fetcher: Fetcher, company: str, board: str) -> list[StudentProgram]:
    token = urlparse(board).path.strip("/").split("/")[0]
    data = await fetcher.json(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs")
    programs = []
    for job in data.get("jobs", []):
        if not is_pre_internship_title(job.get("title", "")):
            continue
        # Descriptions only for matches — fetching content for whole boards is heavy.
        detail = await fetcher.json(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{job['id']}")
        if p := build_program(company=company, name=job["title"], text=html_to_text(detail.get("content", "")),
                              link=job.get("absolute_url") or board, source_url=board, source="greenhouse",
                              status="Open", location=(job.get("location") or {}).get("name", "")):
            programs.append(p)
    return programs


async def _lever(fetcher: Fetcher, company: str, board: str) -> list[StudentProgram]:
    slug = urlparse(board).path.strip("/").split("/")[0]
    programs = []
    for job in await fetcher.json(f"https://api.lever.co/v0/postings/{slug}?mode=json"):
        if not is_pre_internship_title(job.get("text", "")):
            continue
        categories = job.get("categories") or {}
        if p := build_program(company=company, name=job["text"], text=job.get("descriptionPlain", ""),
                              link=job.get("hostedUrl") or board, source_url=board, source="lever",
                              status="Open", location=categories.get("location", "")):
            programs.append(p)
    return programs


async def _ashby(fetcher: Fetcher, company: str, board: str) -> list[StudentProgram]:
    org = urlparse(board).path.strip("/").split("/")[0]
    data = await fetcher.json(f"https://api.ashbyhq.com/posting-api/job-board/{org}")
    programs = []
    for job in data.get("jobs", []):
        if not job.get("isListed", True) or not is_pre_internship_title(job.get("title", "")):
            continue
        if p := build_program(company=company, name=job["title"], text=job.get("descriptionPlain", ""),
                              link=job.get("jobUrl") or board, source_url=board, source="ashby",
                              status="Open", location=job.get("location", "")):
            programs.append(p)
    return programs


async def _workday(fetcher: Fetcher, company: str, board: str) -> list[StudentProgram]:
    """Workday career sites are React SPAs backed by a JSON 'CXS' endpoint; query it directly."""
    parsed = urlparse(board)
    tenant = parsed.netloc.split(".")[0]
    site = parsed.path.strip("/").split("/")[0]
    endpoint = f"https://{parsed.netloc}/wday/cxs/{tenant}/{site}/jobs"
    seen: dict[str, dict] = {}
    for term in WORKDAY_SEARCH_TERMS:
        data = await fetcher.json(endpoint, post_body={"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": term})
        for job in data.get("jobPostings") or []:
            if job.get("externalPath") and is_pre_internship_title(job.get("title", "")):
                seen.setdefault(job["externalPath"], job)
    programs = []
    for path, job in seen.items():
        location = job.get("locationsText", "")
        if p := build_program(company=company, name=job["title"], text=job["title"],
                              link=f"https://{parsed.netloc}/{site}{path}", source_url=board, source="workday",
                              status="Open", location=location,
                              description=f"{job['title']} at {company}" + (f" — {location}." if location else ".")):
            programs.append(p)
    return programs


async def scan_board(fetcher: Fetcher, company: str, board: str) -> list[StudentProgram]:
    host = urlparse(board).netloc.lower()
    if host.endswith("greenhouse.io"):
        return await _greenhouse(fetcher, company, board)
    if host == "jobs.lever.co":
        return await _lever(fetcher, company, board)
    if host == "jobs.ashbyhq.com":
        return await _ashby(fetcher, company, board)
    if host.endswith("myworkdayjobs.com"):
        return await _workday(fetcher, company, board)
    return []
