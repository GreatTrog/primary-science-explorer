"use client";

import { create } from "zustand";

import { invalidatesTrialData } from "@/lib/domain/gating";
import type { InvestigationSession, RuntimeState, TrialRecord } from "@/lib/domain/types";
import { nowIso } from "@/lib/utils/time";

type StepId = InvestigationSession["completionState"]["completedSteps"][number];

type InvestigationStore = {
  session: InvestigationSession | null;
  initialize: (session: InvestigationSession) => void;
  updateResponse: (stepId: StepId, value: unknown) => void;
  updateRuntimeState: (runtimeState: Partial<RuntimeState>) => void;
  setAutoEntries: (
    autoEntries: InvestigationSession["notebookArtifacts"]["autoEntries"],
  ) => void;
  setCurrentStepIndex: (index: number) => void;
  addTrial: (trial: TrialRecord) => void;
  setNotes: (notes: string) => void;
  setDrawing: (drawing: string | null) => void;
  replaceSession: (session: InvestigationSession) => void;
};

function mergeRuntimeSlice(
  currentSlice: RuntimeState["sceneState"],
  nextSlice?: RuntimeState["sceneState"],
) {
  if (!nextSlice) {
    return { merged: currentSlice, changed: false };
  }

  let changed = false;
  const merged: RuntimeState["sceneState"] = { ...currentSlice };

  for (const [key, value] of Object.entries(nextSlice)) {
    if (merged[key] !== value) {
      merged[key] = value;
      changed = true;
    }
  }

  return {
    merged: changed ? merged : currentSlice,
    changed,
  };
}

function clearDependentResponses(
  stepResponses: InvestigationSession["stepResponses"],
): InvestigationSession["stepResponses"] {
  const next = { ...stepResponses };
  for (const key of ["prediction", "simulation", "record", "analyse", "conclusion", "evaluate"]) {
    delete next[key];
  }
  return next;
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  session: null,
  initialize: (session) => set({ session }),
  replaceSession: (session) => set({ session }),
  updateResponse: (stepId, value) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      const updatedAt = nowIso();
      const requiresRerun = invalidatesTrialData(stepId) && state.session.trialData.length > 0;

      return {
        session: {
          ...state.session,
          stepResponses: {
            ...((requiresRerun
              ? clearDependentResponses(state.session.stepResponses)
              : state.session.stepResponses) as InvestigationSession["stepResponses"]),
            [stepId]: {
              stepId,
              value,
              updatedAt,
            },
          },
          trialData: requiresRerun ? [] : state.session.trialData,
          completionState: {
            ...state.session.completionState,
            requiresRerun,
          },
          updatedAt,
        },
      };
    }),
  updateRuntimeState: (runtimeState) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      const sceneState = mergeRuntimeSlice(
        state.session.runtimeState.sceneState,
        runtimeState.sceneState,
      );
      const interactionState = mergeRuntimeSlice(
        state.session.runtimeState.interactionState,
        runtimeState.interactionState,
      );
      const effectState = mergeRuntimeSlice(
        state.session.runtimeState.effectState,
        runtimeState.effectState,
      );
      const cameraState = mergeRuntimeSlice(
        state.session.runtimeState.cameraState,
        runtimeState.cameraState,
      );

      if (
        !sceneState.changed &&
        !interactionState.changed &&
        !effectState.changed &&
        !cameraState.changed
      ) {
        return state;
      }

      return {
        session: {
          ...state.session,
          runtimeState: {
            sceneState: sceneState.merged,
            interactionState: interactionState.merged,
            effectState: effectState.merged,
            cameraState: cameraState.merged,
          },
          updatedAt: nowIso(),
        },
      };
    }),
  setAutoEntries: (autoEntries) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      return {
        session: {
          ...state.session,
          notebookArtifacts: {
            ...state.session.notebookArtifacts,
            autoEntries,
          },
          updatedAt: nowIso(),
        },
      };
    }),
  setCurrentStepIndex: (index) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      return {
        session: {
          ...state.session,
          completionState: {
            ...state.session.completionState,
            currentStepIndex: index,
          },
          updatedAt: nowIso(),
        },
      };
    }),
  addTrial: (trial) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      return {
        session: {
          ...state.session,
          trialData: [...state.session.trialData, trial],
          completionState: {
            ...state.session.completionState,
            requiresRerun: false,
          },
          updatedAt: nowIso(),
        },
      };
    }),
  setNotes: (notes) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      return {
        session: {
          ...state.session,
          notebookArtifacts: {
            ...state.session.notebookArtifacts,
            notes,
          },
          updatedAt: nowIso(),
        },
      };
    }),
  setDrawing: (drawing) =>
    set((state) => {
      if (!state.session) {
        return state;
      }

      return {
        session: {
          ...state.session,
          notebookArtifacts: {
            ...state.session.notebookArtifacts,
            drawing,
          },
          updatedAt: nowIso(),
        },
      };
    }),
}));
