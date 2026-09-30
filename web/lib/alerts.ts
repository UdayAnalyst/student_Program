import { formatDate } from "./dates";
import { byDeadline, isOpen, opportunities } from "./opportunities";
import { CLASS_LEVELS, type Subscriber } from "./types";

const MAX_PER_TEXT = 3;

// The "agent": pick open, unsent opportunities that match the subscriber's class year
// and interests, soonest deadline first.
export function matchesFor(sub: Subscriber) {
  const years: number[] = sub.levels.map((l) => CLASS_LEVELS[l]);
  return opportunities
    .filter((o) => isOpen(o))
    .filter((o) => o.gradYears.some((y) => years.includes(y)))
    .filter((o) => sub.types.length === 0 || sub.types.includes(o.type))
    .filter((o) => !sub.sentIds.includes(o.id))
    .sort(byDeadline);
}

function classLabel(sub: Subscriber) {
  return sub.levels.map((l) => `Class of ${CLASS_LEVELS[l]}`).join(" & ");
}

export function welcomeText(sub: Subscriber) {
  return `Launchpad: You're subscribed to alerts for ${classLabel(sub)}. We'll text you when new opportunities open. Reply STOP to opt out.`;
}

export function alertText(sub: Subscriber, matches: ReturnType<typeof matchesFor>) {
  const picks = matches.slice(0, MAX_PER_TEXT);
  const lines = picks.map(
    (o, i) => `${i + 1}) ${o.title} – ${o.company}${o.deadline ? ` (closes ${formatDate(o.deadline)})` : ""}`,
  );
  const more = matches.length > picks.length ? `\n+${matches.length - picks.length} more on Launchpad` : "";
  return `Launchpad: ${picks.length} new for ${classLabel(sub)}\n${lines.join("\n")}${more}\nApply: ${picks[0].url}`;
}
