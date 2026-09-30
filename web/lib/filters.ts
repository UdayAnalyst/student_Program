import { byDeadline, isOpen } from "./opportunities";
import type { Opportunity, OpportunityType } from "./types";

export type Filters = {
  gradYears: number[]; // empty = any
  types: OpportunityType[]; // empty = any
  remoteOnly: boolean;
  paidOnly: boolean;
  acceptingOnly: boolean;
  query: string;
};

export const EMPTY_FILTERS: Filters = {
  gradYears: [],
  types: [],
  remoteOnly: false,
  paidOnly: false,
  acceptingOnly: false,
  query: "",
};

export function applyFilters(list: Opportunity[], f: Filters) {
  const q = f.query.trim().toLowerCase();
  return list
    .filter((o) => isOpen(o))
    .filter((o) => f.gradYears.length === 0 || o.gradYears.some((y) => f.gradYears.includes(y)))
    .filter((o) => f.types.length === 0 || f.types.includes(o.type))
    .filter((o) => !f.remoteOnly || o.remote)
    .filter((o) => !f.paidOnly || o.paid)
    .filter(
      (o) =>
        !q ||
        [o.title, o.company, o.location, ...o.tags].some((s) => s.toLowerCase().includes(q)),
    )
    .filter((o) => !f.acceptingOnly || o.accepting !== false)
    // Programs taking applications now come first, then soonest deadline.
    .sort((a, b) => Number(a.accepting === false) - Number(b.accepting === false) || byDeadline(a, b));
}

export function isFiltered(f: Filters) {
  return (
    f.gradYears.length > 0 ||
    f.types.length > 0 ||
    f.remoteOnly ||
    f.paidOnly ||
    f.acceptingOnly ||
    f.query !== ""
  );
}

export function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
