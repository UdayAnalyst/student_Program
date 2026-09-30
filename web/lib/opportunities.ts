import mock from "@/data/opportunities.json";
import { daysUntil } from "./dates";
import { scrapedOpportunities } from "./scraped";
import type { Opportunity } from "./types";

// Real listings come from the scraper (see lib/scraped.ts). The mock file pads the demo
// with realistic examples; set this to false once the scraper covers enough programs.
const INCLUDE_MOCK = true;

export const opportunities: Opportunity[] = [
  ...scrapedOpportunities,
  ...(INCLUDE_MOCK ? (mock as Opportunity[]) : []),
];

export function isOpen(o: Opportunity, now = new Date()) {
  return o.deadline === null || daysUntil(o.deadline, now) >= 0;
}

// Soonest deadline first; rolling (null) deadlines go last.
export function byDeadline(a: Opportunity, b: Opportunity) {
  if (a.deadline === b.deadline) return 0;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.localeCompare(b.deadline);
}
