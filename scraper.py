#!/usr/bin/env python3
"""
Tech pre-internship program scraper (entry point).

Finds programs for first/second-year college students (Explore/STEP-style programs,
insight days, discovery programs, sophomore summits, externships, bridge programs)
across ~1,000 companies and writes output/student_programs.{json,csv}.

    python scraper.py                  # full run (a few hours)
    python scraper.py --limit 25 -v    # quick test on the first 25 companies
    python scraper.py --no-crawl       # curated lists + job boards only (fast)

Edit companies.csv or manual_targets.csv to add companies/pages.
Rebuild companies.csv with: python build_companies.py
"""

from spscrape.run import main

if __name__ == "__main__":
    main()
