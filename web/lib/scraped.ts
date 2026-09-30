// Adapter: turns the scraper's output (../output/student_programs.json, written by scraper.py)
// into the Opportunity shape the UI uses. If the scraper adds fields later (deadline,
// location…), map them here and nothing else in the front end has to change.
import raw from "../../output/student_programs.json";
import { CLASS_LEVELS, type Opportunity, type OpportunityType } from "./types";

type ScrapedProgram = {
  company_name: string;
  program_name: string;
  target_audience: string; // "All" | "Undergraduate" | "Graduate"
  target_year: string; // "Freshman" | "Sophomore" | "All" | …
  field: string; // "Finance/Quant" | "Tech/Software" | …
  application_link: string;
  status: string; // "Open" | "Closed" | "Unknown"
  description: string;
  source_url: string;
  scraped_at: string; // ISO timestamp
};

// Uses the scraper's target_year plus the description text, since labels can be narrower
// than the posting (e.g. "Sophomore" on a program "for first- and second-year students").
function gradYearsFor(targetYear: string, description: string): number[] {
  const t = `${targetYear} ${description}`.toLowerCase();
  const years = new Set<number>();
  // "first[- ]…year" also catches "first- and second-year"
  if (/freshm|\bfirst\b[^.]{0,20}\byear/.test(t)) years.add(CLASS_LEVELS.freshman);
  if (/sophomore|\bsecond\b[^.]{0,20}\byear/.test(t)) years.add(CLASS_LEVELS.sophomore);
  if (years.size === 0) return [CLASS_LEVELS.sophomore, CLASS_LEVELS.freshman];
  return [...years];
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

export const scrapedOpportunities: Opportunity[] = (raw as ScrapedProgram[])
  .filter((p) => p.status.toLowerCase() !== "closed")
  .map((p) => {
    const evidence = evidenceFrom(p.description);
    return {
      id: slug(`${p.company_name}-${p.program_name}`),
      title: p.program_name,
      company: p.company_name,
      type: typeFor(p.program_name),
      gradYears: gradYearsFor(p.target_year, p.description),
      gradYearSource: evidence ? "scraped" : "keyword",
      gradYearEvidence: evidence,
      description: p.description,
      location: "See posting",
      remote: false,
      deadline: null, // scraper doesn't collect deadlines yet
      url: p.application_link || p.source_url,
      tags: [p.field, p.status.toLowerCase() === "open" ? "open now" : "status unconfirmed"],
      verifiedAt: p.scraped_at.slice(0, 10),
    };
  });
