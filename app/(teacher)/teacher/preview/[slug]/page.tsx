import { notFound } from "next/navigation";

import { InvestigationShell } from "@/components/investigation/investigation-shell";
import { getInvestigation } from "@/lib/data/repository";

type Params = Promise<{ slug: string }>;

export default async function TeacherPreviewPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const definition = await getInvestigation(slug);

  if (!definition) {
    notFound();
  }

  return (
    <InvestigationShell
      definition={definition}
      initialSession={null}
      mode="teacher-preview"
    />
  );
}
