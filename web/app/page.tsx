import { connection } from "next/server";
import { Explorer } from "@/components/Explorer";
import { opportunities } from "@/lib/opportunities";

export default async function Home(props: PageProps<"/">) {
  // Render per request: deadline countdowns and "closed" filtering depend on today's date.
  await connection();

  // ?program=<id> (the "See details" links in texts) opens that program's details on load.
  const { program } = await props.searchParams;
  const initialProgramId =
    typeof program === "string" && opportunities.some((o) => o.id === program) ? program : undefined;

  return (
    <main className="flex-1">
      <Explorer opportunities={opportunities} initialProgramId={initialProgramId} />
    </main>
  );
}
