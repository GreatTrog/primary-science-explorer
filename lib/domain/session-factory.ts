import { nanoid } from "nanoid";

import type { InvestigationDefinition, InvestigationSession, TrialCreateInput, TrialRecord } from "@/lib/domain/types";
import { nowIso } from "@/lib/utils/time";

export function createInvestigationSession(input: {
  investigationId: string;
  mode: InvestigationSession["mode"];
}): InvestigationSession {
  const now = nowIso();

  return {
    id: nanoid(),
    sessionToken: nanoid(10),
    investigationId: input.investigationId,
    mode: input.mode,
    stepResponses: {},
    trialData: [],
    runtimeState: {
      sceneState: {},
      interactionState: {},
      effectState: {},
      cameraState: {},
    },
    completionState: {
      currentStepIndex: 0,
      completedSteps: [],
      requiresRerun: false,
      lastSavedAt: null,
    },
    notebookArtifacts: {
      autoEntries: [],
      notes: "",
      drawing: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createTrialRecord(input: {
  session: InvestigationSession;
  definition: InvestigationDefinition;
  payload: TrialCreateInput;
}): TrialRecord {
  return {
    id: nanoid(),
    sessionId: input.session.id,
    sceneFamily: input.definition.sceneFamily,
    trialNumber: input.session.trialData.length + 1,
    label: input.payload.label,
    variables: input.payload.variables,
    observedValues: input.payload.observedValues,
    runtimeSnapshot: input.payload.runtimeSnapshot,
    notes: input.payload.notes,
    createdAt: nowIso(),
  };
}
