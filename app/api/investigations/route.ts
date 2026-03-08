import { NextRequest } from "next/server";

import { listInvestigations } from "@/lib/data/repository";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await listInvestigations({
    yearGroup: searchParams.get("yearGroup") ?? undefined,
    curriculumArea: searchParams.get("curriculumArea") ?? undefined,
    enquiryType: searchParams.get("enquiryType") ?? undefined,
  });

  return Response.json(data);
}
