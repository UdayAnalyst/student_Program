"""Turn one HTML page into pre-internship program candidates."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

from .models import StudentProgram, build_program
from .text import (
    GENERIC_HEADING_RE,
    NAMED_PROGRAM_WORD_RE,
    PROGRAM_WORD_RE,
    STRONG_NAME_RE,
    UNDERCLASS_RE,
    clean,
    looks_like_program_name,
)

HEADINGS = ("h1", "h2", "h3", "h4")
SECTION_CHARS = 1_500
NOISE_SELECTORS = (
    "script", "style", "noscript", "svg", "iframe", "nav", "footer", "form",
    '[id*="cookie" i]', '[class*="cookie" i]', '[id*="onetrust" i]', '[aria-hidden="true"]',
)
# Call-to-action verbs score high; the bare noun "application" is weak ("Application tips" isn't a form).
APPLY_TEXT_RE = re.compile(r"\b(apply|register|sign[ -]?up|join the (?:program|waitlist)|submit (?:an |your )?interest)\b", re.I)
APPLY_NOUN_RE = re.compile(r"\b(application|registration)\b", re.I)
NOT_APPLY_RE = re.compile(r"\b(tips|faqs?|interview|information|process|how to|learn more about)\b", re.I)
ATS_HOSTS = (
    "myworkdayjobs.com", "greenhouse.io", "lever.co", "icims.com", "taleo.net", "smartrecruiters.com",
    "successfactors", "oraclecloud.com", "brassring.com", "jobvite.com", "ashbyhq.com", "eightfold.ai",
    "avature.net", "phenompeople.com", "handshake.com", "joinhandshake.com",
)
STUDENT_CONTEXT_RE = re.compile(r"\b(students?|undergrad\w*|interns?(?:hips?)?|program(?:me)?s?|fellows?(?:hip)?|graduat\w+|campus)\b", re.I)


@dataclass
class Section:
    name: str
    text: str
    link: str


@dataclass
class PageInfo:
    url: str
    title: str
    text: str
    description: str
    apply_link: str | None
    links: list[tuple[str, str]] = field(default_factory=list)  # (absolute url, label) incl. nav/footer
    sections: list[Section] = field(default_factory=list)

    @property
    def underclass(self) -> bool:
        return bool(UNDERCLASS_RE.search(self.text[:4_000]))


def _usable_href(href: str) -> bool:
    return bool(href) and not href.startswith(("#", "mailto:", "tel:", "javascript:"))


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


def page_title(soup: BeautifulSoup, company: str) -> str:
    """Visible h1 first (og:title is often a generic 'Student'), then og:title, then <title>."""
    candidates = [h.get_text(" ") for h in soup.find_all("h1")[:3]]
    candidates += [_meta(soup, "og:title"), soup.title.get_text() if soup.title else ""]
    names = [_strip_site_suffix(clean(raw), company) for raw in candidates]
    for name in names:
        if name and looks_like_program_name(name):
            return name
    return next((n for n in names if n and len(n) <= 120), "")


def find_application_link(anchors: list[Tag], base_url: str) -> str | None:
    """Best-scoring 'Apply'/'Register' link among `anchors`, or None if nothing looks like one."""
    best, best_score = None, 0
    for a in anchors:
        if a.find_parent(["nav", "footer"]):
            continue
        href = (a.get("href") or "").strip()
        if not _usable_href(href):
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


def _section(heading: Tag) -> tuple[str, list[Tag]]:
    """Text and links from a heading down to the next heading of the same or higher level."""
    level = int(heading.name[1])
    parts: list[str] = []
    links: list[Tag] = []
    size = 0
    for el in heading.next_elements:
        if isinstance(el, Tag):
            if el.name in HEADINGS and int(el.name[1]) <= level and el is not heading:
                break
            if el.name == "a" and el.get("href"):
                links.append(el)
        elif isinstance(el, NavigableString):
            piece = str(el).strip()
            if piece:
                parts.append(piece)
                size += len(piece)
                if size > SECTION_CHARS:
                    break
    return clean(" ".join(parts)), links


def _best_description(soup: BeautifulSoup, program_name: str, text: str, min_len: int = 60) -> str:
    """Prefer a paragraph that talks about the program over the site's generic 'about us' blurb."""
    root = soup.find("main") or soup.find(attrs={"role": "main"}) or soup.body or soup
    paragraphs = [t for p in root.find_all("p") if len(t := clean(p.get_text(" "))) >= min_len]
    for para in paragraphs:
        if program_name and program_name.lower() in para.lower():
            return para
    for para in paragraphs:
        if STUDENT_CONTEXT_RE.search(para):
            return para
    # Many SPAs put copy in <div>s, not <p>s — fall back to the first on-topic sentence.
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(sentence) >= min_len and STUDENT_CONTEXT_RE.search(sentence):
            return sentence
    return paragraphs[0] if paragraphs else ""


def analyze(page_html: str, url: str, company: str) -> PageInfo:
    soup = BeautifulSoup(page_html, "html.parser")

    # Read title/meta/links before removing noise: hero <header>s hold the h1 and CTA,
    # and the nav/footer hold the "Careers" / "Students" links the crawler needs.
    title = page_title(soup, company)
    meta_description = _meta(soup, "og:description") or _meta(soup, "description")
    all_anchors = soup.find_all("a", href=True)
    apply_link = find_application_link(all_anchors, url)
    links = []
    for a in all_anchors:
        href = a["href"].strip()
        if _usable_href(href):
            label = clean(" ".join([a.get_text(" "), a.get("aria-label", "")]))[:200]
            links.append((urldefrag(urljoin(url, href))[0], label))

    for selector in NOISE_SELECTORS:
        for tag in soup.select(selector):
            tag.decompose()
    root = soup.find("main") or soup.find(attrs={"role": "main"}) or soup.body or soup
    text = clean(root.get_text(" "))

    info = PageInfo(url=url, title=title, text=text, apply_link=apply_link, links=links,
                    description=_best_description(soup, title, text) or meta_description)

    seen: set[str] = set()
    for heading in root.find_all(HEADINGS):
        name = clean(heading.get_text(" "))
        if not looks_like_program_name(name):
            continue
        section_text, section_links = _section(heading)
        # An h1 is the page's subject, so the whole page's text speaks for it.
        eligibility_text = text[:4_000] if heading.name == "h1" else section_text
        # A heading is a program if its name alone says so ("Early Insights", "Sophomore Summit"),
        # or it reads like a program AND its section says it's for first/second-years.
        if not (STRONG_NAME_RE.search(name)
                or (PROGRAM_WORD_RE.search(name) and UNDERCLASS_RE.search(eligibility_text))):
            continue
        if heading.name == "h1" and len(section_text) < 300:
            section_text = text[:SECTION_CHARS]
        # Bare audience headings ("Sophomores") get the page title for context.
        if len(name.split()) <= 2 and not PROGRAM_WORD_RE.search(name) and title and title.lower() != name.lower():
            name = f"{title} – {name}"
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        parent_link = heading.find_parent("a", href=True)
        first_link = next((a["href"] for a in section_links if _usable_href(a["href"])), None)
        link = (
            find_application_link(section_links, url)
            or (urljoin(url, parent_link["href"]) if parent_link else None)
            or (urljoin(url, first_link) if first_link else None)
            or apply_link
            or url
        )
        info.sections.append(Section(name=name, text=section_text, link=link))
    return info


def page_record(info: PageInfo, *, company: str, name: str, source: str, link: str | None = None,
                status: str | None = None, description: str | None = None, extra_text: str = "",
                tech: bool | None = None) -> StudentProgram | None:
    """The whole page as one program (manual targets, curated links, single-program pages)."""
    return build_program(
        company=company, name=name, text=f"{extra_text} {info.text}".strip(),
        link=link or info.apply_link or info.url, source_url=info.url, source=source,
        status=status, description=description or info.description, tech=tech,
    )


def section_records(info: PageInfo, *, company: str, source: str) -> list[StudentProgram]:
    records = []
    for s in info.sections:
        body = s.text[len(s.name):] if s.text.startswith(s.name) else s.text
        record = build_program(company=company, name=s.name, text=s.text, link=s.link,
                               source_url=info.url, source=source, description=body or s.text)
        if record:
            records.append(record)
    return records


def programs_from_page(info: PageInfo, *, company: str, source: str) -> list[StudentProgram]:
    """Crawler entry point: program sections on the page, or the page itself if it is one program."""
    records = section_records(info, company=company, source=source)
    if not records and info.title and looks_like_program_name(info.title) and (
        STRONG_NAME_RE.search(info.title)
        or (NAMED_PROGRAM_WORD_RE.search(info.title) and info.underclass)
        or (PROGRAM_WORD_RE.search(info.title) and UNDERCLASS_RE.search(info.text[:1_500]))
    ):
        if record := page_record(info, company=company, name=info.title, source=source):
            records.append(record)
    return records
