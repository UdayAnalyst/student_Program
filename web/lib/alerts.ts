import { formatDate } from "./dates";
import { byDeadline, isOpen, opportunities } from "./opportunities";
import { CLASS_LEVELS, type Opportunity, type Subscriber } from "./types";

const MAX_PER_TEXT = 3;

// The "agent": pick open, unsent opportunities that match the subscriber's class year
// and interests, soonest deadline first.
export function matchesFor(sub: Subscriber) {
  const years: number[] = sub.levels.map((l) => CLASS_LEVELS[l]);
  return opportunities
    .filter((o) => isOpen(o))
    .filter((o) => o.accepting !== false) // only text programs taking applications now
    .filter((o) => o.gradYears.some((y) => years.includes(y)))
    .filter((o) => sub.types.length === 0 || sub.types.includes(o.type))
    .filter((o) => !sub.sentIds.includes(o.id))
    .sort(byDeadline);
}

function classLabel(sub: Subscriber) {
  return sub.levels.map((l) => `Class of ${CLASS_LEVELS[l]}`).join(" & ");
}

// "Citadel: Discover Citadel" reads awkwardly, so skip the company when the title already names it.
function programName(o: Opportunity) {
  const brand = o.company.split(/[\s(]/)[0].toLowerCase();
  return o.title.toLowerCase().includes(brand) ? o.title : `${o.company}: ${o.title}`;
}

// Base URL for links in texts: SITE_URL in .env.local once deployed, otherwise the
// address the request came in on (http://localhost:3000 in the demo).
export function siteUrl(request: Request) {
  return (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

// Link to the program's page on our site (details, eligibility, who it's for) rather than
// straight to the application, so students can decide before they apply.
export function programLink(siteUrl: string, id: string) {
  return `${siteUrl}/?program=${encodeURIComponent(id)}`;
}

export function welcomeText(sub: Subscriber, siteUrl: string, watched?: Opportunity) {
  if (watched) {
    const when = watched.applyWindow
      ? ` (${watched.applyWindow.charAt(0).toLowerCase()}${watched.applyWindow.slice(1)})`
      : "";
    return (
      `Launchpad: We'll text you the moment ${programName(watched)} starts accepting applications${when}.\n` +
      `Details: ${programLink(siteUrl, watched.id)}\nReply STOP to opt out.`
    );
  }
  return `Launchpad: You're subscribed to alerts for ${classLabel(sub)}. We'll text you when new opportunities open. Reply STOP to opt out.`;
}

export function alertText(sub: Subscriber, matches: ReturnType<typeof matchesFor>, siteUrl: string) {
  const picks = matches.slice(0, MAX_PER_TEXT);
  const items = picks.map(
    (o, i) =>
      `${i + 1}) ${programName(o)}${o.deadline ? ` (closes ${formatDate(o.deadline)})` : ""}\n` +
      `See details: ${programLink(siteUrl, o.id)}`,
  );
  const more = matches.length > picks.length ? `\n\n+${matches.length - picks.length} more at ${siteUrl}` : "";
  const heading = `Launchpad: ${picks.length} program${picks.length === 1 ? "" : "s"} open now for ${classLabel(sub)}`;
  return `${heading}\n\n${items.join("\n\n")}${more}\n\nReply STOP to opt out.`;
}
