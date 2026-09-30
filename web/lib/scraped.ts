// Adapter: turns the scraper's output (../output/student_programs.json, written by scraper.py)
// into the Opportunity shape the UI uses. If the scraper adds fields later (deadline…),
// map them here and nothing else in the front end has to change.
import raw from "../../output/student_programs.json";
import { CLASS_LEVELS, type Opportunity, type OpportunityType } from "./types";
import { COMPANIES } from "./companies";
import { PROGRAM_DETAILS } from "./programDetails";
import { CORRECTIONS, REMOVED, VERIFIED, VERIFIED_ON } from "./verification";

type ScrapedProgram = {
  company_name: string;
  program_name: string;
  target_audience: string; // "All" | "Undergraduate" | "Graduate"
  target_year: string; // "Freshman" | "Sophomore" | "Freshman/Sophomore" | "Senior" | "All" | …
  field: string; // "Software Engineering" | "Data Science/AI" | …
  application_link: string;
  status: string; // "Open" | "Closed" | "Rolling" | "Unknown"
  description: string;
  source_url: string;
  scraped_at: string; // ISO timestamp
  location?: string;
  term?: string;
  source?: string;
};

function yearsMentioned(text: string) {
  const years = new Set<number>();
  // "first[- ]…year" also catches "first- and second-year"
  if (/freshm|\bfirst\b[^.]{0,20}\byear/.test(text)) years.add(CLASS_LEVELS.freshman);
  if (/sophomore|\bsecond\b[^.]{0,20}\byear/.test(text)) years.add(CLASS_LEVELS.sophomore);
  return years;
}

// Freshman/sophomore class years this program is explicitly for. Empty = leave it out:
// junior/senior-only programs, and "All"-year programs whose posting doesn't call out
// first- or second-year students. An explicit label is widened by the description
// (e.g. "Sophomore" on a program "for first- and second-year students").
function gradYearsFor(targetYear: string, description: string): number[] {
  const label = targetYear.toLowerCase();
  const fromLabel = yearsMentioned(label);
  const fromDescription = yearsMentioned(description.toLowerCase());
  if (!label.trim() || label.includes("all")) return [...fromDescription];
  if (fromLabel.size === 0) return []; // junior / senior only
  return [...new Set([...fromLabel, ...fromDescription])];
}

// Where to get each company's logo. Most source_urls are the company's own site; these
// point at hiring platforms or program sites instead, so map them to the real domain.
const COMPANY_DOMAINS: Record<string, string> = {
  adobe: "adobe.com",
  "bank of america": "bankofamerica.com",
  barclays: "barclays.com",
  "capital one": "capitalone.com",
  dropbox: "dropbox.com",
  "morgan stanley": "morganstanley.com",
  "procter & gamble": "pg.com",
  pwc: "pwc.com",
  salesforce: "salesforce.com",
  susquehanna: "sig.com",
  "wells fargo": "wellsfargo.com",
};
const PLATFORM_HOSTS = /(tal\.net|smapply\.org|icims\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|avature\.net|applytojob\.com|docs\.google\.com)$/;

// The scraper sometimes picks up a subdomain as the company name.
const NAME_FIXES: Record<string, string> = { Joinus: "Barclays", Tal: "Bank of America" };

function logoFor(company: string, sourceUrl: string) {
  let domain = COMPANY_DOMAINS[company.toLowerCase()];
  if (!domain) {
    try {
      const host = new URL(sourceUrl).hostname;
      if (!PLATFORM_HOSTS.test(host)) domain = host.split(".").slice(-2).join(".");
    } catch {
      // unparseable URL: no logo
    }
  }
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined;
}

function typeFor(name: string): OpportunityType {
  const n = name.toLowerCase();
  if (n.includes("hackathon") || n.includes("datathon")) return "hackathon";
  if (n.includes("fellow") || n.includes("scholar")) return "fellowship";
  if (n.includes("research")) return "research";
  if (n.includes("intern")) return "internship";
  return "program";
}

// The sentence in the description that mentions class year, shown as eligibility proof.
function evidenceFrom(description: string) {
  return description
    .split(/(?<=[.!?])\s+/)
    .find((s) => /(first|second)[- ]year|freshm|sophomore|class of 20\d\d|graduat/i.test(s));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seen = new Set<string>();

export const scrapedOpportunities: Opportunity[] = (raw as ScrapedProgram[])
  .filter((p) => p.status.toLowerCase() !== "closed")
  .filter((p) => p.target_audience.toLowerCase() !== "graduate")
  .map((p): Opportunity => {
    const evidence = evidenceFrom(p.description);
    const location = p.location?.trim() || "See posting";
    const company = NAME_FIXES[p.company_name] ?? p.company_name;
    return {
      id: slug(`${company}-${p.program_name}`),
      title: p.program_name,
      company,
      logo: logoFor(company, p.source_url),
      type: typeFor(p.program_name),
      gradYears: gradYearsFor(p.target_year, p.description),
      gradYearSource: evidence ? "scraped" : "keyword",
      gradYearEvidence: evidence,
      description: p.description,
      location,
      remote: /remote|virtual/i.test(location),
      deadline: null, // scraper doesn't collect deadlines yet
      url: p.application_link || p.source_url,
      tags: [
        p.field,
        ...(p.term ? [p.term] : []),
        p.status.toLowerCase() === "open" ? "open now" : p.status.toLowerCase() === "rolling" ? "rolling" : "status unconfirmed",
      ],
      verifiedAt: p.scraped_at.slice(0, 10),
    };
  })
  .filter((o) => o.gradYears.length > 0)
  .filter((o) => !seen.has(o.id) && seen.add(o.id)) // drop duplicate listings
  .filter((o) => !(o.id in REMOVED))
  .map((o) => {
    const info = COMPANIES[o.company];
    const withInfo = info ? { ...o, companyFocus: info.focus, companyAbout: info.about } : o;
    if (!VERIFIED.has(o.id)) return withInfo;
    const fix = CORRECTIONS[o.id] ?? {};
    const statusLabel =
      fix.statusLabel ?? (fix.accepting ? "Open now" : fix.accepting === false ? "Not open yet" : undefined);
    // The scraper's own status tags ("open now"…) can contradict the manual check, so drop them.
    const tags = withInfo.tags.filter((t) => !/^(open now|rolling|status unconfirmed)$/.test(t));
    return { ...withInfo, ...fix, tags, statusLabel, details: PROGRAM_DETAILS[o.id], verifiedAt: VERIFIED_ON };
  });
