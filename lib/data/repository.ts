import { nanoid } from "nanoid";

import {
  getCurriculumCoverage,
  getInvestigationBySlug,
  getInvestigationSummaries,
} from "@/lib/content/loaders";
import { buildCompletedSteps } from "@/lib/domain/gating";
import {
  InvestigationSessionSchema,
  NotebookArtifactSchema,
  SessionPatchSchema,
  TrialCreateSchema,
  TrialRecordSchema,
} from "@/lib/domain/schema";
import { createInvestigationSession } from "@/lib/domain/session-factory";
import type {
  CurriculumCoverageEntry,
  InvestigationDefinition,
  InvestigationSession,
  InvestigationSummary,
  NotebookArtifact,
  SessionPatchInput,
  TrialCreateInput,
  TrialRecord,
} from "@/lib/domain/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils/time";

type MemoryStore = {
  sessions: Map<string, InvestigationSession>;
  exports: Map<string, NotebookArtifact>;
};

declare global {
  var __PSE_MEMORY_STORE__: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__PSE_MEMORY_STORE__) {
    globalThis.__PSE_MEMORY_STORE__ = {
      sessions: new Map(),
      exports: new Map(),
    };
  }

  return globalThis.__PSE_MEMORY_STORE__;
}

async function upsertSupabaseSession(session: InvestigationSession) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from("investigation_sessions").upsert({
    id: session.id,
    session_token: session.sessionToken,
    investigation_id: session.investigationId,
    mode: session.mode,
    step_responses: session.stepResponses,
    trial_data: session.trialData,
    runtime_state: session.runtimeState,
    completion_state: session.completionState,
    notebook_artifacts: session.notebookArtifacts,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  });
}

async function fetchSupabaseSession(id: string): Promise<InvestigationSession | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("investigation_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) {
    return null;
  }

  return InvestigationSessionSchema.parse({
    id: data.id,
    sessionToken: data.session_token,
    investigationId: data.investigation_id,
    mode: data.mode,
    stepResponses: data.step_responses,
    trialData: data.trial_data,
    runtimeState: data.runtime_state ?? {
      sceneState: {},
      interactionState: {},
      effectState: {},
      cameraState: {},
    },
    completionState: data.completion_state,
    notebookArtifacts: data.notebook_artifacts,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

export async function listInvestigations(filters?: {
  yearGroup?: string;
  curriculumArea?: string;
  enquiryType?: string;
}): Promise<InvestigationSummary[]> {
  const summaries = await getInvestigationSummaries();

  return summaries.filter((summary) => {
    if (filters?.yearGroup && summary.yearGroup !== filters.yearGroup) {
      return false;
    }
    if (filters?.curriculumArea && summary.curriculumArea !== filters.curriculumArea) {
      return false;
    }
    if (filters?.enquiryType && summary.enquiryType !== filters.enquiryType) {
      return false;
    }
    return true;
  });
}

export async function getInvestigation(slug: string): Promise<InvestigationDefinition | null> {
  return getInvestigationBySlug(slug);
}

export async function createSession(input: {
  investigationId: string;
  mode: "pupil" | "teacher-preview";
}): Promise<InvestigationSession> {
  const session = InvestigationSessionSchema.parse(createInvestigationSession(input));

  getMemoryStore().sessions.set(session.id, session);
  await upsertSupabaseSession(session);
  return session;
}

export async function upsertSession(input: InvestigationSession): Promise<InvestigationSession> {
  const session = InvestigationSessionSchema.parse(input);

  getMemoryStore().sessions.set(session.id, session);
  await upsertSupabaseSession(session);
  return session;
}

export async function getSession(id: string): Promise<InvestigationSession | null> {
  const remote = await fetchSupabaseSession(id);
  if (remote) {
    return remote;
  }

  return getMemoryStore().sessions.get(id) ?? null;
}

export async function patchSession(
  id: string,
  input: SessionPatchInput,
): Promise<InvestigationSession | null> {
  const patch = SessionPatchSchema.parse(input);
  const existing = await getSession(id);
  if (!existing) {
    return null;
  }

  const definition = await getInvestigationBySlug(existing.investigationId);
  const now = nowIso();
  const session = InvestigationSessionSchema.parse({
    ...existing,
    stepResponses: patch.stepResponses,
    runtimeState: patch.runtimeState,
    notebookArtifacts: patch.notebookArtifacts,
    completionState: {
      ...existing.completionState,
      currentStepIndex: patch.currentStepIndex,
      completedSteps: definition
        ? buildCompletedSteps(definition.steps, {
            stepResponses: patch.stepResponses,
            trialData: existing.trialData,
          })
        : existing.completionState.completedSteps,
      requiresRerun: patch.requiresRerun ?? existing.completionState.requiresRerun,
      lastSavedAt: now,
    },
    updatedAt: now,
  });

  getMemoryStore().sessions.set(id, session);
  await upsertSupabaseSession(session);
  return session;
}

export async function appendTrial(
  sessionId: string,
  input: TrialCreateInput,
): Promise<TrialRecord | null> {
  const payload = TrialCreateSchema.parse(input);
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const definition = await getInvestigationBySlug(session.investigationId);
  if (!definition) {
    return null;
  }

  const now = nowIso();
  const trial = TrialRecordSchema.parse({
    id: nanoid(),
    sessionId,
    sceneFamily: definition.sceneFamily,
    trialNumber: session.trialData.length + 1,
    label: payload.label,
    variables: payload.variables,
    observedValues: payload.observedValues,
    runtimeSnapshot: payload.runtimeSnapshot,
    notes: payload.notes,
    createdAt: now,
  });

  const nextSession = InvestigationSessionSchema.parse({
    ...session,
    trialData: [...session.trialData, trial],
    completionState: {
      ...session.completionState,
      requiresRerun: false,
      lastSavedAt: now,
    },
    updatedAt: now,
  });

  getMemoryStore().sessions.set(sessionId, nextSession);
  await upsertSupabaseSession(nextSession);
  return trial;
}

export async function createNotebookArtifact(
  artifact: NotebookArtifact,
): Promise<NotebookArtifact> {
  const parsed = NotebookArtifactSchema.parse(artifact);
  getMemoryStore().exports.set(parsed.sessionId, parsed);

  const supabase = getSupabaseServerClient();
  if (supabase) {
    await supabase.from("notebook_exports").upsert({
      session_id: parsed.sessionId,
      investigation_slug: parsed.investigationSlug,
      generated_at: parsed.generatedAt,
      sections: parsed.sections,
    });
  }

  return parsed;
}

export async function getNotebookArtifact(sessionId: string): Promise<NotebookArtifact | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase
      .from("notebook_exports")
      .select("*")
      .eq("session_id", sessionId)
      .single();
    if (data) {
      return NotebookArtifactSchema.parse({
        sessionId: data.session_id,
        investigationSlug: data.investigation_slug,
        generatedAt: data.generated_at,
        sections: data.sections,
      });
    }
  }

  return getMemoryStore().exports.get(sessionId) ?? null;
}

export async function listCoverage(): Promise<CurriculumCoverageEntry[]> {
  return getCurriculumCoverage();
}
