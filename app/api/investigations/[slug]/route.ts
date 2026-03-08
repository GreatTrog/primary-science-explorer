import { getInvestigation } from "@/lib/data/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const investigation = await getInvestigation(slug);

  if (!investigation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(investigation);
}
