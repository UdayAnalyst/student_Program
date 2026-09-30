"""Output schema and the one function that turns scraped text into a normalized record."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, PrivateAttr, ValidationError, field_validator

from .text import TERM_RE, classify_audience, classify_field, classify_year, clean, detect_status, is_tech, summarize

log = logging.getLogger("student_programs")

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
    term: str = ""
    location: str = ""
    source: str = ""  # manual | curated | crawl | greenhouse | lever | ashby | workday
    source_url: str
    scraped_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    # Decided from the full page text at build time (not exported); the output keeps tech programs only.
    _tech: bool = PrivateAttr(default=False)

    @field_validator("company_name", "program_name", "description", "location", mode="before")
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
    """Recoverable scrape failure (bot wall, empty page, bad status code)."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def build_program(
    *,
    company: str,
    name: str,
    text: str,
    link: str,
    source_url: str,
    source: str,
    status: str | None = None,
    description: str | None = None,
    location: str = "",
    tech: bool | None = None,
) -> StudentProgram | None:
    """Classify raw text into a record. Returns None (and logs) if the record is invalid."""
    classify_text = f"{name}. {text}"
    term = TERM_RE.search(classify_text)
    try:
        record = StudentProgram(
            company_name=company,
            program_name=name,
            target_audience=classify_audience(classify_text),
            target_year=classify_year(classify_text),
            field=classify_field(classify_text),
            application_link=link,
            status=status or detect_status(text),
            description=summarize(description or text),
            term=term.group(0).title() if term else "",
            location=location,
            source=source,
            source_url=source_url,
        )
        record._tech = tech if tech is not None else is_tech(f"{company} {name}", classify_text)
        return record
    except ValidationError as exc:
        log.debug("Dropping invalid record %r: %s", name, exc.errors()[0]["msg"])
        return None
