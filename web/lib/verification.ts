import type { Opportunity } from "./types";

// Results of opening every scraped listing's link by hand. Keyed by Opportunity id
// (see lib/scraped.ts). Listings the scraper adds later are not in here, so they show
// unverified until someone re-checks them.
export const VERIFIED_ON = "2026-09-30";

// Checked and live: either open now or a live program page waiting on next dates.
export const VERIFIED = new Set([
  "bank-of-america-ignite-with-tech",
  "bny-sophomore-summit",
  "capital-one-capital-one-s-early-internship-program",
  "capital-one-capital-one-s-tech-summit",
  "citadel-citadel-launch",
  "citadel-discover-citadel",
  "electronic-arts-ea-pathfinder",
  "hudson-river-trading-hrt-women-in-trading-technology-internship-jan",
  "imc-trading-launchpad-program",
  "jp-morgan-chase-jpmorganchase-fellowship-program",
  "linkedin-first-play-linkedin-s-underclassman-engineering-internshipk",
  "microsoft-microsoft-explore",
  "mlt-management-leadership-for-tomorrow-mlt-career-prep-class-of-2029",
  "nvidia-nvidia-ignite-program",
  "optiver-quantitative-intern-summer-2027-sophomore-standing-grad-dec-2027-jun-2029",
  "rewriting-the-code-rtc-membership-community",
  "susquehanna-discovery-programme-equity-research-on-site",
  "uber-uber-star",
]);

// Dropped: the link is dead, wrong, or the page no longer mentions the program.
export const REMOVED: Record<string, string> = {
  "bank-of-america-global-technology-freshman-summer-analyst-program": "posting removed; redirects to general campus page",
  "google-google-asdi-associate-software-developer-intern": "redirects to general Google job search",
  "procter-gamble-p-g-emerging-leaders-information-technology": "2022 posting; redirects to careers home",
  "visa-visa-sophomore-internship-program": "redirects to general careers page",
  "microsoft-discovery-program": "link points to an unrelated sales job",
  "microsoft-internship-programs": "link points to an unrelated sales job",
  "northrop-grumman-a-pathway-into-an-engineering-career": "employee story, not a program",
  "duolingo-duolingo-thrive-internship-swe": "careers homepage doesn't mention the program",
  "oracle-oracle-first-year-swe-internships": "internships page doesn't mention first-year roles",
  "palantir-palantir-path": "students page doesn't mention the program",
  "two-sigma-two-sigma-freshman-software-engineer-internship": "no freshman role on the job board",
  "zillow-zillow-engineering-and-leadership-program-zeal": "page blocked automated checks; couldn't confirm",
};

// Whether each verified program is taking applications right now, when it usually opens if
// not, and corrections to what the scraper collected. "official" windows come from the
// company's page; "past cycles" come from previous years' postings and may shift.
export const CORRECTIONS: Record<string, Partial<Opportunity>> = {
  // Accepting now
  "citadel-discover-citadel": {
    accepting: true,
    deadline: "2027-03-05",
    location: "New York, NY",
    // the scraped quote ended with an outdated "Deadline: December."
    gradYearEvidence: "Must be a first-year or second-year to apply (December 2027 – June 2029 graduation date).",
  },
  "mlt-management-leadership-for-tomorrow-mlt-career-prep-class-of-2029": { accepting: true, deadline: "2027-01-15" },
  "optiver-quantitative-intern-summer-2027-sophomore-standing-grad-dec-2027-jun-2029": {
    accepting: true,
    location: "Chicago, IL",
  },
  "susquehanna-discovery-programme-equity-research-on-site": {
    accepting: true,
    url: "https://careers.sig.com/jobs/11573?lang=en-us", // scraped link was a login page
    location: "Dublin, Ireland",
  },
  // HRT's page says second-year students only, though the scraper labeled it freshman/sophomore.
  "hudson-river-trading-hrt-women-in-trading-technology-internship-jan": {
    accepting: true,
    location: "New York, NY",
    gradYears: [2029],
  },
  "imc-trading-launchpad-program": { accepting: true, location: "Chicago, IL" },
  "bank-of-america-ignite-with-tech": { accepting: true },
  "rewriting-the-code-rtc-membership-community": { accepting: true, location: "Remote" },

  // Not accepting yet
  "bny-sophomore-summit": {
    accepting: false,
    statusLabel: "Opens Jan 11",
    applyWindow: "Registration opens January 11, 2027",
    applyWindowSource: "official",
  },
  "capital-one-capital-one-s-early-internship-program": {
    accepting: false,
    applyWindow: "Usually opens December–January",
    applyWindowSource: "past cycles",
  },
  "capital-one-capital-one-s-tech-summit": {
    accepting: false,
    applyWindow: "Sessions run in May, August, and January; email TechEE@capitalone.com to register interest",
    applyWindowSource: "official",
  },
  "jp-morgan-chase-jpmorganchase-fellowship-program": {
    accepting: false,
    applyWindow: "Usually opens mid-November and closes mid-January",
    applyWindowSource: "past cycles",
  },
  "linkedin-first-play-linkedin-s-underclassman-engineering-internshipk": {
    accepting: false,
    applyWindow: "Usually opens in late November for about 2 weeks",
    applyWindowSource: "past cycles",
  },
  "microsoft-microsoft-explore": {
    accepting: false,
    applyWindow: "Usually opens between August and November; closes early once full",
    applyWindowSource: "past cycles",
  },
  "nvidia-nvidia-ignite-program": {
    accepting: false,
    applyWindow: "Usually opens around October for about 2 weeks",
    applyWindowSource: "past cycles",
  },
  "uber-uber-star": {
    accepting: false,
    applyWindow: "Usually open September–December",
    applyWindowSource: "past cycles",
  },
  "citadel-citadel-launch": { accepting: false, applyWindow: "2027 dates not announced yet" },
  "electronic-arts-ea-pathfinder": { accepting: false, applyWindow: "2027 dates not announced yet" },
};
