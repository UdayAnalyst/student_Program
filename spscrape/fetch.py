"""HTTP-first page fetching with a Playwright fallback for JS-rendered pages, plus robots.txt."""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from playwright.async_api import (
    BrowserContext,
    Error as PlaywrightError,
    Page,
    Route,
    TimeoutError as PlaywrightTimeoutError,
)

from .models import ScrapeError
from .text import clean, visible_text_len

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)
HTTP_TIMEOUT_MS = 20_000
NAV_TIMEOUT_MS = 40_000
NETWORK_IDLE_TIMEOUT_MS = 12_000
# Below this much visible text, a page is probably a JS shell that needs rendering.
MIN_TEXT_CHARS = 800
BOT_WALL_RE = re.compile(r"access denied|just a moment\.\.\.|verify you are (?:a )?human|captcha|request blocked|attention required", re.I)


class Robots:
    """robots.txt per Google's spec (RFC 9309): the longest matching rule wins; Allow wins ties.

    urllib.robotparser uses first-match semantics and wrongly blocks e.g. https://www.google.com/.
    """

    def __init__(self, body: str, agent: str = "*"):
        groups: list[tuple[set[str], list[tuple[bool, str]]]] = []
        agents: set[str] = set()
        rules: list[tuple[bool, str]] = []
        for raw in body.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if rules:  # a user-agent line after rules starts a new group
                    groups.append((agents, rules))
                    agents, rules = set(), []
                agents.add(value.lower())
            elif key in ("allow", "disallow") and agents:
                if value:  # "Disallow:" with no path allows everything
                    rules.append((key == "allow", value))
        if agents:
            groups.append((agents, rules))
        self.rules = [r for a, rs in groups if agent in a for r in rs]

    @staticmethod
    def _pattern(path: str) -> re.Pattern:
        anchored = path.endswith("$")
        body = re.escape(path.rstrip("$")).replace(r"\*", ".*")
        return re.compile(body + ("$" if anchored else ""))

    def allowed(self, url: str) -> bool:
        p = urlparse(url)
        target = (p.path or "/") + (f"?{p.query}" if p.query else "")
        best_len, verdict = -1, True
        for allow, path in self.rules:
            if self._pattern(path).match(target):
                length = len(path)
                if length > best_len or (length == best_len and allow):
                    best_len, verdict = length, allow
        return verdict


@dataclass
class Doc:
    url: str  # final URL after redirects
    html: str
    rendered: bool


async def block_heavy_resources(route: Route) -> None:
    # Images/fonts/media don't carry program data; skipping them speeds up rendering a lot.
    if route.request.resource_type in {"image", "media", "font"}:
        await route.abort()
    else:
        await route.continue_()


class Fetcher:
    def __init__(self, context: BrowserContext, *, http_concurrency: int, browser_concurrency: int):
        self.context = context
        self.request = context.request
        self._http_sem = asyncio.Semaphore(http_concurrency)
        self._browser_sem = asyncio.Semaphore(browser_concurrency)
        self._robots: dict[str, asyncio.Task] = {}

    # --- robots.txt ---------------------------------------------------------

    async def allowed(self, url: str) -> bool:
        p = urlparse(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self._robots:
            # Store the task, so concurrent requests to one host share a single robots.txt fetch.
            self._robots[origin] = asyncio.ensure_future(self._load_robots(origin))
        robots = await self._robots[origin]
        return robots is None or robots.allowed(url)

    async def _load_robots(self, origin: str) -> Robots | None:
        try:
            async with self._http_sem:
                response = await self.request.get(f"{origin}/robots.txt", timeout=10_000, fail_on_status_code=False)
                if not response.ok:
                    return None  # no robots.txt (or unreadable) -> crawling allowed
                body = await response.text()
        except PlaywrightError:
            return None
        return Robots(body)

    # --- fetching -----------------------------------------------------------

    async def json(self, url: str, *, post_body: dict | None = None):
        async with self._http_sem:
            if post_body is not None:
                response = await self.request.post(url, data=post_body, timeout=HTTP_TIMEOUT_MS, fail_on_status_code=False)
            else:
                response = await self.request.get(url, timeout=HTTP_TIMEOUT_MS, fail_on_status_code=False)
            if not response.ok:
                raise ScrapeError(f"HTTP {response.status} from {url}", response.status)
            return await response.json()

    async def text(self, url: str, timeout_ms: int = 60_000) -> str:
        async with self._http_sem:
            response = await self.request.get(url, timeout=timeout_ms, fail_on_status_code=False)
            if not response.ok:
                raise ScrapeError(f"HTTP {response.status} from {url}", response.status)
            return await response.text()

    async def http(self, url: str) -> Doc:
        async with self._http_sem:
            response = await self.request.get(
                url, timeout=HTTP_TIMEOUT_MS, max_redirects=8, fail_on_status_code=False,
                headers={"Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9"},
            )
            if not response.ok:
                raise ScrapeError(f"HTTP {response.status}", response.status)
            if "html" not in response.headers.get("content-type", "html"):
                raise ScrapeError("not an HTML page", 415)
            return Doc(url=response.url, html=await response.text(), rendered=False)

    async def render(self, url: str, wait_for: str | None = None) -> Doc:
        async with self._browser_sem:
            page = await self.context.new_page()
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                if response is not None and response.status >= 400:
                    raise ScrapeError(f"HTTP {response.status}", response.status)
                try:
                    await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
                except PlaywrightTimeoutError:
                    pass  # SPAs with analytics beacons may never go idle; the DOM is usually ready anyway.
                if wait_for:
                    try:
                        await page.wait_for_selector(wait_for, timeout=NETWORK_IDLE_TIMEOUT_MS)
                    except PlaywrightTimeoutError:
                        pass
                await _dismiss_cookie_banner(page)
                await _auto_scroll(page)
                doc = Doc(url=page.url, html=await page.content(), rendered=True)
            finally:
                await page.close()
        if _is_bot_wall(doc.html):
            raise ScrapeError("bot wall detected", 403)
        return doc

    async def get(self, url: str, *, allow_render: bool = True, wait_for: str | None = None) -> Doc:
        """Plain HTTP first (fast); render in Chromium only when the page is a JS shell or blocked."""
        if not await self.allowed(url):
            raise ScrapeError("disallowed by robots.txt")
        doc: Doc | None = None
        try:
            doc = await self.http(url)
            if visible_text_len(doc.html) >= MIN_TEXT_CHARS and not _is_bot_wall(doc.html):
                return doc
        except ScrapeError as exc:
            if exc.status in (404, 410, 415):
                raise  # the page doesn't exist; a browser won't change that
            if not allow_render:
                raise
        except PlaywrightError:
            if not allow_render:
                raise
        if not allow_render:
            return doc  # thin page, but it's what we have
        try:
            return await self.render(url, wait_for)
        except (ScrapeError, PlaywrightError):
            if doc is not None:
                return doc
            raise


def _is_bot_wall(page_html: str) -> bool:
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", page_html)
    return bool(m and BOT_WALL_RE.search(clean(m.group(1))))


async def _dismiss_cookie_banner(page: Page) -> None:
    for selector in ("#onetrust-accept-btn-handler", "button:has-text('Accept all')", "button:has-text('Accept')"):
        try:
            button = page.locator(selector).first
            if await button.is_visible():
                await button.click(timeout=2_000)
                return
        except PlaywrightError:
            continue


async def _auto_scroll(page: Page, steps: int = 6) -> None:
    # Triggers lazy-loaded sections (common on React/Vue marketing pages).
    for _ in range(steps):
        await page.mouse.wheel(0, 1_500)
        await page.wait_for_timeout(250)
