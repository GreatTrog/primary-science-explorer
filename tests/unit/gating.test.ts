import { describe, expect, it } from "vitest";

import { getInvestigationBySlug } from "@/lib/content/loaders";
import { buildCompletedSteps } from "@/lib/domain/gating";

describe("step gating", () => {
  it("marks steps complete only when minimum evidence exists", async () => {
    const definition = await getInvestigationBySlug("dissolving-and-separating-mixtures");
    if (!definition) {
      throw new Error("Definition missing");
    }

    const completed = buildCompletedSteps(definition.steps, {
      stepResponses: {
        question: {
          stepId: "question",
          value: "temperature",
          updatedAt: new Date().toISOString(),
        },
        plan: {
          stepId: "plan",
          value: ["change-temperature", "same-volume", "same-substance"],
          updatedAt: new Date().toISOString(),
        },
        prediction: {
          stepId: "prediction",
          value: "Hot water will dissolve the solid faster because particles have more energy.",
          updatedAt: new Date().toISOString(),
        },
      },
      trialData: [],
    });

    expect(completed).toEqual(["question", "plan", "prediction"]);
  });
});
