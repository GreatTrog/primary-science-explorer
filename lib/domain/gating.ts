import type { InvestigationSession, InvestigationStep } from "@/lib/domain/types";

export function getStepCompletion(
  step: InvestigationStep,
  session: Pick<InvestigationSession, "stepResponses" | "trialData">,
): boolean {
  if (step.minimumEvidence.type === "none") {
    return true;
  }

  if (step.minimumEvidence.type === "trial") {
    return session.trialData.length >= step.minimumEvidence.minEntries;
  }

  const response = session.stepResponses[step.id];
  if (!response) {
    return false;
  }

  if (step.minimumEvidence.type === "option") {
    if (Array.isArray(response.value)) {
      return response.value.length >= step.minimumEvidence.minEntries;
    }

    return Boolean(response.value);
  }

  if (step.minimumEvidence.type === "text" || step.minimumEvidence.type === "analysis") {
    return typeof response.value === "string" && response.value.trim().length > 0;
  }

  return false;
}

export function buildCompletedSteps(
  steps: InvestigationStep[],
  session: Pick<InvestigationSession, "stepResponses" | "trialData">,
): InvestigationSession["completionState"]["completedSteps"] {
  return steps.filter((step) => getStepCompletion(step, session)).map((step) => step.id);
}

export function invalidatesTrialData(stepId: string): boolean {
  return stepId === "plan" || stepId === "question";
}
