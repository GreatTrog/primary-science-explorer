import { notFound } from "next/navigation";

import { PrintButton } from "@/components/ui/print-button";
import { getInvestigation, getNotebookArtifact, getSession } from "@/lib/data/repository";
import { buildNotebookArtifact } from "@/lib/export/notebook";
import { formatDateTime } from "@/lib/utils/time";

type Params = Promise<{ sessionId: string }>;

export default async function ExportPage({
  params,
}: {
  params: Params;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    notFound();
  }

  const definition = await getInvestigation(session.investigationId);
  if (!definition) {
    notFound();
  }

  const artifact = (await getNotebookArtifact(sessionId)) ?? buildNotebookArtifact(definition, session);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="display-font text-4xl">{definition.title}</p>
            <p className="mt-2 text-muted">
              Exported {formatDateTime(artifact.generatedAt)} • {definition.yearGroup} • {definition.curriculumArea}
            </p>
          </div>
          <PrintButton />
        </div>

        <div className="mt-8 space-y-6">
          {artifact.sections.map((section) => (
            <section key={section.title} className="rounded-[1.5rem] border border-[var(--border)] bg-white/78 p-5">
              <h2 className="display-font text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--foreground)]">
                {section.content.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
