import { createNotebookArtifact, getInvestigation, getSession } from "@/lib/data/repository";
import { InvestigationSessionSchema } from "@/lib/domain/schema";
import { buildNotebookArtifact } from "@/lib/export/notebook";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    slug?: string;
    session?: unknown;
  };
  if (!body.slug || (!body.sessionId && !body.session)) {
    return Response.json({ error: "Missing slug and session context" }, { status: 400 });
  }

  const investigation = await getInvestigation(body.slug);
  const session =
    body.session
      ? InvestigationSessionSchema.parse(body.session)
      : body.sessionId
        ? await getSession(body.sessionId)
        : null;

  if (!session || !investigation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const artifact = buildNotebookArtifact(investigation, session);
  await createNotebookArtifact(artifact);
  return Response.json(artifact);
}
