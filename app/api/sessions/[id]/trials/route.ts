import { appendTrial } from "@/lib/data/repository";
import { TrialCreateSchema } from "@/lib/domain/schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = TrialCreateSchema.parse(await request.json());
  const trial = await appendTrial(id, body);

  if (!trial) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(trial, { status: 201 });
}
