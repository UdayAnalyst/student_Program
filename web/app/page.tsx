import { connection } from "next/server";
import { Explorer } from "@/components/Explorer";
import { opportunities } from "@/lib/opportunities";

export default async function Home() {
  // Render per request: deadline countdowns and "closed" filtering depend on today's date.
  await connection();
  return (
    <main className="flex-1">
      <Explorer opportunities={opportunities} />
    </main>
  );
}
