"""Text cleanup, pre-internship signal detection, and field classification."""

from __future__ import annotations

import html
import re
from datetime import date, datetime

from bs4 import BeautifulSoup


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


def visible_text_len(page_html: str) -> int:
    """Cheap estimate of how much readable text an HTML document has (no DOM parse)."""
    s = re.sub(r"(?is)<(script|style|noscript|svg|template)\b.*?</\1>", " ", page_html)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return len(clean(html.unescape(s)))


# ---------------------------------------------------------------------------
# Pre-internship signals
# ---------------------------------------------------------------------------


def _underclass_grad_years(today: date | None = None) -> list[int]:
    # Freshmen/sophomores graduate 3-4 years out in the fall term, 2-3 years out in spring.
    today = today or date.today()
    offset = 3 if today.month >= 7 else 2
    return [today.year + offset, today.year + offset + 1]


_GRAD_YEARS = "|".join(map(str, _underclass_grad_years()))

# Text that says a program is aimed at first/second-year students. Deliberately avoids bare
# "first-year", which banks use for full-time "first-year analyst" roles.
UNDERCLASS_RE = re.compile(
    r"\b(?:freshm[ae]n|sophomores?|underclass\w*|pre[- ]?internships?"
    r"|first[- ]+(?:and|or|&|/) ?second[- ]*years?"
    r"|(?:first|second|1st|2nd)[- ]+years? (?:college |university |undergraduate |undergrad )?students?"
    r"|(?:first|second)[- ]+year (?:of|in) (?:college|university|undergrad\w*|your degree|study)"
    rf"|(?:class of|graduat\w*[^.]{{0,40}}?)\s(?:{_GRAD_YEARS}))\b",
    re.I,
)

# Program names that are pre-internship programs almost by definition.
STRONG_NAME_RE = re.compile(
    r"\b(?:early insights?|insights? (?:days?|weeks?|program(?:me)?s?|series|summits?|experiences?)"
    r"|discovery (?:days?|program(?:me)?s?|series|weeks?|summits?)|spring weeks?|pre[- ]?internships?"
    r"|sophomores?|freshm[ae]n|underclass\w*|first[- ]year (?:program|insight|intern|summit|series)\w*"
    r"|(?:emerging|launching|rising|future) leaders|externships?|bridge program(?:me)?s?|early internships?"
    r"|explore (?:program|internship)s?|explorers? program(?:me)?)\b",
    re.I,
)

# Words that make a heading look like a program name (used together with UNDERCLASS_RE).
PROGRAM_WORD_RE = re.compile(
    r"\b(?:program(?:me)?s?|summits?|series|fellows(?:hip)?s?|academy|insights?|discover\w*|explore\w*"
    r"|bridge|launch\w*|weeks?|days?|experiences?|conferences?|bootcamps?|scholars?|forums?|workshops?"
    r"|extern\w*|internships?|interns?|immersion|pathways?|exploration|leaders?)\b",
    re.I,
)

# Headings that are page furniture, not program names.
GENERIC_HEADING_RE = re.compile(
    r"^(?:our |student |university |campus |early careers? |featured |upcoming |explore )?"
    r"(?:programs?|internships?|events?|opportunities|students?|faqs?|overview|eligibility|how to apply"
    r"|apply|benefits|locations?|about(?: us)?|resources|contact(?: us)?|search jobs|related content)\W*$",
    re.I,
)


# Marketing taglines and calls to action that look like headings but aren't program names.
CTA_HEADING_RE = re.compile(
    r"^(?:what|how|why|who|when|where|get|find|kickstart|start|begin|join|meet|see|learn|hear|read|watch|apply"
    r"|search|browse|view|sign up|register|your|our|we|you)\b"
    r"|^(?:discover|explore|launch|build|grow|shape|jump ?start) (?:your|our|the|internship|early|career|opportunities|more|what)\b",
    re.I,
)

# Program-name words minus the generic "program"/"internship", for judging a whole page's title.
NAMED_PROGRAM_WORD_RE = re.compile(
    r"\b(?:summits?|series|fellows(?:hip)?s?|academy|insights?|discover\w*|explore\w*|bridge|launch\w*|weeks?|days?"
    r"|experiences?|conferences?|bootcamps?|scholars?|forums?|workshops?|extern\w*|immersion|pathways?|exploration)\b",
    re.I,
)


def looks_like_program_name(name: str) -> bool:
    """Short noun phrase, not a sentence, question, or call to action."""
    return (3 <= len(name) <= 100 and len(name.split()) <= 10 and not re.search(r"[.?!:]$", name)
            and not CTA_HEADING_RE.search(name) and not GENERIC_HEADING_RE.match(name))


def is_pre_internship_title(title: str) -> bool:
    """For job-board postings, where only a title is available."""
    return bool(STRONG_NAME_RE.search(title) or UNDERCLASS_RE.search(title))


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

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
    "Freshman": [r"\bfreshm[ae]n\b", r"\bfirst[- ]+(?:(?:and|or|&|/) ?second[- ]*)?years? (?:college |university |undergrad\w* )?students?",
                 r"\bfirst[- ]+(?:and|or|&|/) ?second[- ]*year", r"\b1st[- ]year\b"],
    "Sophomore": [r"\bsophomores?\b", r"\bsecond[- ]+years? (?:college |university |undergrad\w* )?students?",
                  r"\bfirst[- ]+(?:and|or|&|/) ?second[- ]*year", r"\b2nd[- ]year\b"],
    "Junior": [r"\bjuniors?\b(?! analyst| developer| engineer)", r"\bthird[- ]year (?:students?|undergrad)", r"\bpenultimate[- ]year\b"],
    "Senior": [r"\bseniors?\b(?! analyst| developer| engineer| manager| associate| leaders?| leadership| executives?| vice| director)",
               r"\bfinal[- ]year\b", r"\bfourth[- ]year\b"],
}

# Tech sub-areas; the output only keeps programs that pass is_tech().
FIELD_RULES: dict[str, list[str]] = {
    "Software Engineering": [r"\bsoftware\b", r"\bswe\b", r"\bcoding\b", r"\bprogramming\b", r"\bdevelopers?\b",
                             r"\bcomputer science\b", r"\bfull[- ]stack\b", r"\bweb development\b", r"\bengineering\b"],
    "Data Science/AI": [r"\bdata scien\w+", r"\bmachine learning\b", r"\bartificial intelligence\b", r"\b(?:ai|ml)\b",
                        r"\bdata analy\w+", r"\banalytics\b"],
    "Product": [r"\bproduct manage\w+", r"\b(?:apm|pm)\b", r"\bproduct design\b", r"\bux\b"],
    "Hardware": [r"\bhardware\b", r"\belectrical engineering\b", r"\bsemiconductors?\b", r"\bchip\b", r"\bembedded\b"],
    "Cybersecurity": [r"\bcyber\s?security\b", r"\bsecurity engineering\b", r"\binfosec\b", r"\bcyber\b"],
    "IT/Infrastructure": [r"\bcloud\b", r"\binfrastructure\b", r"\bnetworking\b", r"\bit (?:support|operations)\b", r"\bdevops\b"],
}

TECH_RE = re.compile(
    r"\b(?:software|computer science|cs|coding|programming|developers?|engineering|engineers?|technolog\w+|tech"
    r"|stem|data scien\w+|machine learning|artificial intelligence|ai|ml|cyber\s?security|cyber|hardware|product manage\w+"
    r"|cloud|web development|hackathons?|computing|swe|apm)\b",
    re.I,
)


def is_tech(name: str, text: str) -> bool:
    """Tech in the program name, or at least twice in its text (one stray 'technology' isn't enough)."""
    return bool(TECH_RE.search(name)) or len(TECH_RE.findall(text[:4_000])) >= 2


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
    if top == 0 or ranked[1][1] == top:
        return "General Tech"
    return top_label


# ---------------------------------------------------------------------------
# Status detection
# ---------------------------------------------------------------------------

CLOSED_RE = re.compile(
    r"applications? (?:are|is|have been|has been) (?:now |currently )?closed|no longer accepting|"
    r"not currently accepting|(?:applications?|registration) (?:period )?(?:has |have )?closed|"
    r"applications? will (?:re-?)?open|check back (?:later|soon|in)|sign up to be notified|notify me when",
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
TERM_RE = re.compile(r"\b(?:summer|fall|autumn|winter|spring)\s+20\d\d\b", re.I)


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
