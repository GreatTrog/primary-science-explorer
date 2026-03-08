import { describe, expect, it } from "vitest";

import { createSession, listCoverage, listInvestigations } from "@/lib/data/repository";

describe("repository", () => {
  it("lists investigations and creates a session", async () => {
    const investigations = await listInvestigations();
    const coverage = await listCoverage();
    const session = await createSession({
      investigationId: investigations[0].slug,
      mode: "pupil",
    });

    expect(investigations.length).toBeGreaterThan(0);
    expect(coverage.length).toBeGreaterThan(0);
    expect(session.investigationId).toBe(investigations[0].slug);
  });
});
