import { createSession, upsertSession } from "@/lib/data/repository";
import { InvestigationSessionSchema } from "@/lib/domain/schema";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    investigationId?: string;
    mode?: "pupil" | "teacher-preview";
    session?: unknown;
  };

  if (body.session) {
    const session = await upsertSession(InvestigationSessionSchema.parse(body.session));
    return Response.json(session, { status: 201 });
  }

  if (!body.investigationId || !body.mode) {
    return Response.json(
      { error: "Missing investigationId or mode, or provide a session snapshot" },
      { status: 400 },
    );
  }

  const session = await createSession({
    investigationId: body.investigationId,
    mode: body.mode,
  });

  return Response.json(session, { status: 201 });
}
