const DAY = 24 * 60 * 60 * 1000;

// "Today" is pinned to one timezone so the server render and the browser agree
// on day counts (otherwise a UTC server and an ET browser disagree every evening).
const TODAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

// Whole days from today until an ISO date (YYYY-MM-DD). Negative = passed.
export function daysUntil(iso: string, now = new Date()) {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(iso) - toUtc(TODAY_FMT.format(now))) / DAY);
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
