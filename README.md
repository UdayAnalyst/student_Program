# student_Program
link: https://student-program-nine.vercel.app/

## Tech pre-internship program scraper

Finds **tech pre-internship programs** for first- and second-year college students (Explore/STEP-style
internships, insight days, discovery programs, sophomore summits, externships) across ~3,000 companies.

**Latest data:** [`output/student_programs.csv`](output/student_programs.csv) ·
[`output/student_programs.json`](output/student_programs.json) ·
[run report](output/scrape_report.json) — refreshed every Monday by GitHub Actions.

| Column | Meaning |
|---|---|
| `company_name`, `program_name` | Who runs it and what it's called |
| `target_audience` | Undergraduate / Graduate / PhD / High School / All |
| `target_year` | e.g. `Freshman/Sophomore` (`All` if the page doesn't say) |
| `field` | Software Engineering, Data Science/AI, Product, Hardware, Cybersecurity, IT/Infrastructure, General Tech |
| `application_link` | Best apply/register link found |
| `status` | Open / Closed / Rolling / Unknown (Unknown = the page doesn't say) |
| `description`, `term`, `location` | Short summary and details when available |
| `source`, `source_url` | Where the record came from: `manual`, `curated`, `crawl`, or a job board |

### Where the data comes from

1. **Curated lists** — the program sections of [LuisaE/opportunities](https://github.com/LuisaE/opportunities)
   and [Jose-Gael-Cruz-Lopez/underclassmen-opportunities](https://github.com/Jose-Gael-Cruz-Lopez/underclassmen-opportunities);
   each link is visited to refresh its status.
2. **Company websites** — for every company in [`companies.csv`](companies.csv), a crawler walks from the
   homepage/careers site to student and early-career pages and picks out program sections. It respects
   robots.txt and caps pages and time per company.
3. **Job boards** — Greenhouse, Lever, Ashby and Workday boards are searched for pre-internship titles.
4. **Manual pages** — anything in [`manual_targets.csv`](manual_targets.csv).

Everything is filtered to **tech** programs and de-duplicated.

### Run it yourself

```bash
pip install -r requirements.txt
python -m playwright install chromium
python scraper.py --limit 25 -v     # quick test
python scraper.py                   # full run (a few hours)
python scraper.py --no-crawl        # curated lists + job boards only (minutes)
```

Add a company: add a row to `companies.csv` (`company,domain,ats_board,priority`).
Add a specific program page: add a row to `manual_targets.csv`.
Refresh the company list from SimplifyJobs: `python build_companies.py`.

Program detection is keyword-based, so expect some misses and a few false positives —
check `status` and the link before relying on a row.
