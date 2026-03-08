import { notFound } from "next/navigation";

import { InvestigationShell } from "@/components/investigation/investigation-shell";
import { getInvestigation, getSession } from "@/lib/data/repository";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ session?: string }>;

export default async function InvestigationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, { session: sessionId }] = await Promise.all([params, searchParams]);
  const definition = await getInvestigation(slug);

  if (!definition) {
    notFound();
  }

  const initialSession = sessionId ? await getSession(sessionId) : null;

  return (
    <InvestigationShell
      definition={definition}
      initialSession={initialSession}
      mode="pupil"
    />
  );
}
