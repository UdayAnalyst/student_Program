// Shared contract with the scraper. data/opportunities.json must match `Opportunity[]`.

export const OPPORTUNITY_TYPES = [
  "internship",
  "program",
  "fellowship",
  "hackathon",
  "research",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export type Opportunity = {
  id: string;
  title: string;
  company: string;
  type: OpportunityType;
  gradYears: number[]; // e.g. [2029, 2030]
  gradYearSource: "scraped" | "keyword" | "manual";
  gradYearEvidence?: string; // the sentence from the posting that proves eligibility
  description?: string;
  location: string;
  remote: boolean;
  paid?: boolean;
  deadline: string | null; // ISO date YYYY-MM-DD, null = rolling
  url: string;
  tags: string[];
  verifiedAt: string; // ISO date YYYY-MM-DD
};

// Fall 2026: freshmen graduate in 2030, sophomores in 2029.
export const CLASS_LEVELS = {
  freshman: 2030,
  sophomore: 2029,
} as const;
export type ClassLevel = keyof typeof CLASS_LEVELS;

export function levelForYear(year: number): ClassLevel | null {
  if (year === CLASS_LEVELS.freshman) return "freshman";
  if (year === CLASS_LEVELS.sophomore) return "sophomore";
  return null;
}

export type Subscriber = {
  phone: string; // E.164, e.g. +15551234567
  levels: ClassLevel[];
  types: OpportunityType[]; // empty = all types
  sentIds: string[]; // opportunities already texted, so we never repeat
  createdAt: string;
};
