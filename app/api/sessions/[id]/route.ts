import { getSession, patchSession } from "@/lib/data/repository";
import { SessionPatchSchema } from "@/lib/domain/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSession(id);

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(session);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = SessionPatchSchema.parse(await request.json());
  const session = await patchSession(id, body);

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(session);
}
