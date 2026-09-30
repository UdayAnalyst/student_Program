#!/usr/bin/env python3
"""
Build / refresh companies.csv — the list of companies the scraper crawls.

Sources:
  - Companies that posted tech internships on SimplifyJobs in the last N days
    (their ATS job board is recorded from the posting URLs).
  - EXTRA_COMPANIES below: large employers known for tech programs for students.
Each name is resolved to a website domain with Clearbit's free autocomplete API.

Existing rows in companies.csv are kept as-is (so hand edits survive); only new
companies are looked up. Run occasionally:  python build_companies.py
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import difflib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from spscrape.ats import board_url

ROOT = Path(__file__).resolve().parent
COMPANIES_CSV = ROOT / "companies.csv"
SIMPLIFY_URL = "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json"
CLEARBIT_URL = "https://autocomplete.clearbit.com/v1/companies/suggest?query="

# Large employers known for tech programs for students, with verified domains (not auto-resolved).
EXTRA_COMPANIES: dict[str, str] = {
    # Big tech / software
    "Google": "google.com", "Microsoft": "microsoft.com", "Meta": "meta.com", "Apple": "apple.com",
    "Amazon": "amazon.jobs", "Netflix": "netflix.com", "LinkedIn": "linkedin.com", "Salesforce": "salesforce.com",
    "Adobe": "adobe.com", "Intuit": "intuit.com", "Oracle": "oracle.com", "Cisco": "cisco.com", "Intel": "intel.com",
    "NVIDIA": "nvidia.com", "IBM": "ibm.com", "Uber": "uber.com", "Airbnb": "airbnb.com", "Pinterest": "pinterest.com",
    "Snap": "snap.com", "Spotify": "spotify.com", "Palantir": "palantir.com", "Datadog": "datadoghq.com",
    "Stripe": "stripe.com", "Robinhood": "robinhood.com", "Coinbase": "coinbase.com", "Duolingo": "duolingo.com",
    "Atlassian": "atlassian.com", "Workday": "workday.com", "ServiceNow": "servicenow.com", "Qualcomm": "qualcomm.com",
    "Texas Instruments": "ti.com", "Bloomberg": "bloomberg.com", "Dropbox": "dropbox.com", "Figma": "figma.com",
    "Twilio": "twilio.com", "Yelp": "yelp.com", "DoorDash": "doordash.com", "Lyft": "lyft.com", "Etsy": "etsy.com",
    "Wayfair": "wayfair.com", "Shopify": "shopify.com", "Block": "block.xyz", "PayPal": "paypal.com", "eBay": "ebay.com",
    "Dell Technologies": "dell.com", "HP": "hp.com", "Hewlett Packard Enterprise": "hpe.com", "AMD": "amd.com",
    "Micron": "micron.com", "Western Digital": "westerndigital.com", "Zillow": "zillow.com",
    "Expedia Group": "expediagroup.com", "Roblox": "roblox.com", "Electronic Arts": "ea.com",
    "Riot Games": "riotgames.com", "Epic Games": "epicgames.com", "Capital One": "capitalonecareers.com",
    "Visa": "visa.com", "Mastercard": "mastercard.com", "American Express": "americanexpress.com",
    # Finance firms with technology programs for students
    "Goldman Sachs": "goldmansachs.com", "Morgan Stanley": "morganstanley.com", "JPMorgan Chase": "jpmorganchase.com",
    "Bank of America": "bankofamerica.com", "Citi": "citi.com", "Wells Fargo": "wellsfargo.com", "Barclays": "barclays.com",
    "Deutsche Bank": "db.com", "UBS": "ubs.com", "BNY": "bny.com", "State Street": "statestreet.com",
    "Northern Trust": "northerntrust.com", "Fidelity Investments": "fidelity.com", "Vanguard": "vanguard.com",
    "BlackRock": "blackrock.com", "Charles Schwab": "schwab.com", "T. Rowe Price": "troweprice.com",
    "Citadel": "citadel.com", "Citadel Securities": "citadelsecurities.com", "Jane Street": "janestreet.com",
    "Hudson River Trading": "hudsonrivertrading.com", "Two Sigma": "twosigma.com", "D. E. Shaw": "deshaw.com",
    "Jump Trading": "jumptrading.com", "Optiver": "optiver.com", "IMC Trading": "imc.com", "Susquehanna": "sig.com",
    "DRW": "drw.com", "Akuna Capital": "akunacapital.com", "Five Rings": "fiverings.com",
    "Tower Research Capital": "tower-research.com", "Millennium": "mlp.com", "Point72": "point72.com",
    "Bridgewater Associates": "bridgewater.com", "AQR Capital Management": "aqr.com", "Squarepoint Capital": "squarepoint-capital.com",
    "Virtu Financial": "virtu.com", "Flow Traders": "flowtraders.com", "Peak6": "peak6.com", "CME Group": "cmegroup.com",
    "Nasdaq": "nasdaq.com", "Intercontinental Exchange": "ice.com", "S&P Global": "spglobal.com", "Moody's": "moodys.com",
    "MSCI": "msci.com", "LSEG": "lseg.com", "Truist": "truist.com", "PNC": "pnc.com", "U.S. Bank": "usbank.com",
    "Ally Financial": "ally.com", "Synchrony": "synchrony.com", "Liberty Mutual": "libertymutual.com",
    "Travelers": "travelers.com", "Progressive": "progressive.com", "State Farm": "statefarm.com",
    "Allstate": "allstate.com", "Prudential Financial": "prudential.com", "MetLife": "metlife.com",
    "Northwestern Mutual": "northwesternmutual.com", "Nationwide": "nationwide.com",
    # Consulting / tech services
    "Deloitte": "deloitte.com", "PwC": "pwc.com", "EY": "ey.com", "KPMG": "kpmg.com", "Accenture": "accenture.com",
    "Booz Allen Hamilton": "boozallen.com", "Capgemini": "capgemini.com", "Cognizant": "cognizant.com",
    "Infosys": "infosys.com", "Slalom": "slalom.com", "Thoughtworks": "thoughtworks.com", "Leidos": "leidos.com",
    "SAIC": "saic.com", "CACI": "caci.com", "MITRE": "mitre.org",
    # Other large employers with tech/engineering early-career programs
    "Walmart": "walmart.com", "Target": "target.com", "Home Depot": "homedepot.com", "Lowe's": "lowes.com",
    "Nike": "nike.com", "Disney": "disney.com", "Comcast": "comcast.com", "Verizon": "verizon.com", "AT&T": "att.com",
    "T-Mobile": "t-mobile.com", "Boeing": "boeing.com", "Lockheed Martin": "lockheedmartin.com",
    "Northrop Grumman": "northropgrumman.com", "RTX": "rtx.com", "General Dynamics": "gd.com",
    "GE Aerospace": "geaerospace.com", "Honeywell": "honeywell.com", "Caterpillar": "caterpillar.com",
    "John Deere": "deere.com", "Ford": "ford.com", "General Motors": "gm.com", "Tesla": "tesla.com",
    "Rivian": "rivian.com", "UnitedHealth Group": "unitedhealthgroup.com", "CVS Health": "cvshealth.com",
    "Epic Systems": "epic.com", "Johnson & Johnson": "jnj.com", "Procter & Gamble": "pg.com", "PepsiCo": "pepsico.com",
    "Delta Air Lines": "delta.com", "United Airlines": "united.com", "FedEx": "fedex.com", "UPS": "ups.com",
    "Chick-fil-A": "chick-fil-a.com", "Best Buy": "bestbuy.com", "Nordstrom": "nordstrom.com",
}

_SUFFIX_RE = re.compile(r"\b(inc|llc|corp|corporation|co|company|group|holdings|the|ltd|plc|technologies|labs?)\b")


def _norm(name: str) -> str:
    name = re.sub(r"\(.*?\)", " ", name.lower())
    name = _SUFFIX_RE.sub(" ", re.sub(r"[^a-z0-9& ]", " ", name))
    return " ".join(name.split())


def _pick_domain(name: str, suggestions: list[dict]) -> str:
    """Accept a suggestion only if both its name AND its domain match the company name.

    Name-only matching produced 'Meta' -> metacritic.com and 'Microsoft' -> office.com.
    """
    target = _norm(name)
    compact = target.replace(" ", "").replace("&", "")
    for s in suggestions:
        cand, domain = _norm(s.get("name", "")), (s.get("domain") or "").lower()
        if not cand or not domain:
            continue
        label = domain.split(".")[0].replace("-", "")
        name_ok = cand == target or difflib.SequenceMatcher(None, cand, target).ratio() >= 0.9
        domain_ok = (len(compact) >= 3 and (label.startswith(compact) or compact.startswith(label))) \
            or difflib.SequenceMatcher(None, label, compact).ratio() >= 0.75
        if name_ok and domain_ok:
            return domain
    return ""


def _clearbit(name: str) -> list[dict]:
    url = CLEARBIT_URL + urllib.parse.quote(name)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** attempt)
    return []


async def resolve_domains(names: list[str], concurrency: int = 8) -> dict[str, str]:
    sem = asyncio.Semaphore(concurrency)

    async def one(name: str) -> tuple[str, str]:
        async with sem:
            suggestions = await asyncio.to_thread(_clearbit, name)
            return name, _pick_domain(name, suggestions)

    return dict(await asyncio.gather(*(one(n) for n in names)))


def simplify_companies(days: int) -> dict[str, str]:
    """{company: ats_board} for companies with a tech internship posted in the last `days` days."""
    with urllib.request.urlopen(SIMPLIFY_URL, timeout=120) as r:
        listings = json.load(r)
    cutoff = time.time() - days * 86_400
    companies: dict[str, str] = {}
    for x in listings:
        if not x.get("is_visible", True) or (x.get("date_posted") or 0) < cutoff:
            continue
        name = x.get("company_name", "").strip()
        if not name:
            continue
        board = board_url(x.get("url", "")) or ""
        if not companies.get(name):
            companies[name] = board
    return companies


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=365, help="Simplify look-back window")
    args = parser.parse_args()

    existing: dict[str, dict] = {}
    if COMPANIES_CSV.exists():
        with COMPANIES_CSV.open(newline="", encoding="utf-8") as f:
            existing = {r["company"]: r for r in csv.DictReader(f)}

    boards = simplify_companies(args.days)
    print(f"Simplify: {len(boards)} companies posted in the last {args.days} days")
    names = {n: "" for n in EXTRA_COMPANIES} | boards
    new = [n for n in names if n not in existing]
    to_resolve = [n for n in new if n not in EXTRA_COMPANIES]
    print(f"Resolving {len(to_resolve)} new company domains via Clearbit...")
    domains = asyncio.run(resolve_domains(to_resolve)) | EXTRA_COMPANIES

    rows = dict(existing)
    for name in new:
        rows[name] = {"company": name, "domain": domains.get(name, ""), "ats_board": names[name]}
    for name, row in rows.items():
        row["priority"] = "1" if name in EXTRA_COMPANIES else ""
    for name, board in boards.items():  # keep job boards fresh for existing rows too
        if board and not rows[name].get("ats_board"):
            rows[name]["ats_board"] = board

    # One row per domain: several Simplify names can map to one site (e.g. subsidiaries).
    by_domain: dict[str, str] = {}
    for name, row in sorted(rows.items(), key=lambda kv: kv[0].lower()):
        d = row.get("domain", "")
        if d and d in by_domain and not row.get("ats_board"):
            row["domain"] = ""  # keep the row for its name, but crawl the site only once
        elif d:
            by_domain.setdefault(d, name)

    with COMPANIES_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["company", "domain", "ats_board", "priority"])
        writer.writeheader()
        writer.writerows(sorted(rows.values(), key=lambda r: r["company"].lower()))
    with_domain = sum(bool(r.get("domain")) for r in rows.values())
    print(f"Wrote {len(rows)} companies to {COMPANIES_CSV.name} ({with_domain} with a website domain, "
          f"{sum(bool(r.get('ats_board')) for r in rows.values())} with a job board)")


if __name__ == "__main__":
    main()
