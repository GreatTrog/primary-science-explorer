import type { z } from "zod";

import {
  CompletionStateSchema,
  CurriculumCoverageEntrySchema,
  InvestigationDefinitionSchema,
  InvestigationSessionSchema,
  InvestigationStepSchema,
  InvestigationSummarySchema,
  NotebookArtifactSchema,
  RuntimeStateSchema,
  SceneConfigSchema,
  SessionPatchSchema,
  StepResponseSchema,
  TrialCreateSchema,
  TrialRecordSchema,
} from "@/lib/domain/schema";

export type InvestigationDefinition = z.infer<typeof InvestigationDefinitionSchema>;
export type InvestigationSummary = z.infer<typeof InvestigationSummarySchema>;
export type InvestigationStep = z.infer<typeof InvestigationStepSchema>;
export type SceneConfig = z.infer<typeof SceneConfigSchema>;
export type StepResponse = z.infer<typeof StepResponseSchema>;
export type RuntimeState = z.infer<typeof RuntimeStateSchema>;
export type TrialRecord = z.infer<typeof TrialRecordSchema>;
export type TrialCreateInput = z.infer<typeof TrialCreateSchema>;
export type CompletionState = z.infer<typeof CompletionStateSchema>;
export type InvestigationSession = z.infer<typeof InvestigationSessionSchema>;
export type SessionPatchInput = z.infer<typeof SessionPatchSchema>;
export type NotebookArtifact = z.infer<typeof NotebookArtifactSchema>;
export type CurriculumCoverageEntry = z.infer<typeof CurriculumCoverageEntrySchema>;
