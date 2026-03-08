import { describe, expect, it } from "vitest";

import { getAllInvestigations } from "@/lib/content/loaders";
import { INVESTIGATION_STEPS } from "@/lib/domain/constants";

describe("investigation content", () => {
  it("validates all investigation files and includes the full enquiry step set", async () => {
    const investigations = await getAllInvestigations();

    expect(investigations).toHaveLength(4);
    for (const investigation of investigations) {
      expect(investigation.steps.map((step) => step.id)).toEqual(INVESTIGATION_STEPS);
    }
  });
});
