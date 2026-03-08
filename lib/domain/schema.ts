import { z } from "zod";

import {
  AGE_BANDS,
  CAMERA_PRESETS,
  INVESTIGATION_STEPS,
  LIGHTING_PRESETS,
  PERFORMANCE_TIERS,
  RECORDING_MODES,
  SCENE_FAMILIES,
} from "@/lib/domain/constants";

const StepIdSchema = z.enum(INVESTIGATION_STEPS);
const AgeBandSchema = z.enum(AGE_BANDS);
const SceneFamilySchema = z.enum(SCENE_FAMILIES);
const RecordingModeSchema = z.enum(RECORDING_MODES);
const PerformanceTierSchema = z.enum(PERFORMANCE_TIERS);
const CameraPresetSchema = z.enum(CAMERA_PRESETS);
const LightingPresetSchema = z.enum(LIGHTING_PRESETS);

const ResponseOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

const MinimumEvidenceSchema = z.object({
  type: z.enum(["option", "text", "trial", "analysis", "none"]),
  minEntries: z.number().int().min(0).default(1),
});

export const InvestigationStepSchema = z.object({
  id: StepIdSchema,
  title: z.string(),
  prompt: z.string(),
  guidance: z.string(),
  responseType: z.enum(["choice", "text", "simulation"]),
  options: z.array(ResponseOptionSchema).optional(),
  sentenceStem: z.string().optional(),
  allowMultiple: z.boolean().default(false),
  minimumEvidence: MinimumEvidenceSchema,
});

const MaterialsLabSceneConfigSchema = z.object({
  apparatusLabel: z.string(),
  materials: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
      absorbency: z.number(),
      roughness: z.number(),
    }),
  ),
});

const ForcesMotionSceneConfigSchema = z.object({
  towerHeightMeters: z.number(),
  parachutes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      canopyRadius: z.number(),
      dropTimeSeconds: z.number(),
      color: z.string(),
    }),
  ),
});

const CircuitsEnergySceneConfigSchema = z.object({
  cells: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      voltage: z.number(),
    }),
  ),
  outputs: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(["bulb", "buzzer"]),
      color: z.string(),
    }),
  ),
});

const LightOpticsSceneConfigSchema = z.object({
  mirrorAngles: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      degrees: z.number(),
    }),
  ),
  targets: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
    }),
  ),
});

const ParticlesMixturesSceneConfigSchema = z.object({
  substances: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
      dissolves: z.boolean(),
      baseDissolveSeconds: z.number(),
      residueColor: z.string().optional(),
    }),
  ),
  temperatures: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      multiplier: z.number(),
      tint: z.string(),
    }),
  ),
  stirringLevels: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      multiplier: z.number(),
    }),
  ),
});

export const SceneConfigSchema = z.discriminatedUnion("family", [
  z.object({
    family: z.literal("materials_lab"),
    payload: MaterialsLabSceneConfigSchema,
  }),
  z.object({
    family: z.literal("forces_motion"),
    payload: ForcesMotionSceneConfigSchema,
  }),
  z.object({
    family: z.literal("circuits_energy"),
    payload: CircuitsEnergySceneConfigSchema,
  }),
  z.object({
    family: z.literal("light_optics"),
    payload: LightOpticsSceneConfigSchema,
  }),
  z.object({
    family: z.literal("particles_mixtures"),
    payload: ParticlesMixturesSceneConfigSchema,
  }),
]);

const InteractionTargetSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["selector", "toggle", "action", "sensor"]),
});

const EffectTimelineSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

const TrialExtractionSchema = z.object({
  primaryMeasure: z.string(),
  unit: z.string(),
  observedFields: z.array(z.string()),
});

export const InvestigationDefinitionSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  yearGroup: z.string(),
  ageBand: AgeBandSchema,
  curriculumArea: z.string(),
  topicKeywords: z.array(z.string()),
  enquiryType: z.string(),
  wsObjectives: z.array(z.string()),
  difficulty: z.enum(["foundation", "core", "stretch"]),
  sceneFamily: SceneFamilySchema,
  sceneConfig: SceneConfigSchema,
  cameraPreset: CameraPresetSchema,
  lightingPreset: LightingPresetSchema,
  interactionTargets: z.array(InteractionTargetSchema),
  effectTimelines: z.array(EffectTimelineSchema),
  trialExtraction: TrialExtractionSchema,
  steps: z.array(InvestigationStepSchema).length(INVESTIGATION_STEPS.length),
  recordingModes: z.array(RecordingModeSchema),
  teacherNotes: z.array(z.string()),
  safetyNote: z.string(),
  misconceptionChecks: z.array(z.string()),
  supportsNarration: z.boolean(),
  estimatedDuration: z.number().int().positive(),
  performanceTier: PerformanceTierSchema,
  hero: z.object({
    eyebrow: z.string(),
    blurb: z.string(),
    accent: z.string(),
  }),
});

export const StepResponseSchema = z.object({
  stepId: StepIdSchema,
  value: z.unknown(),
  updatedAt: z.string(),
});

export const RuntimeStateSchema = z.object({
  sceneState: z.record(z.string(), z.unknown()).default({}),
  interactionState: z.record(z.string(), z.unknown()).default({}),
  effectState: z.record(z.string(), z.unknown()).default({}),
  cameraState: z.record(z.string(), z.unknown()).default({}),
});

const NotebookAutoEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  content: z.string(),
});

export const TrialRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sceneFamily: SceneFamilySchema,
  trialNumber: z.number().int().positive(),
  label: z.string(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  observedValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  runtimeSnapshot: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const CompletionStateSchema = z.object({
  currentStepIndex: z.number().int().min(0).max(INVESTIGATION_STEPS.length - 1),
  completedSteps: z.array(StepIdSchema),
  requiresRerun: z.boolean(),
  lastSavedAt: z.string().nullable(),
});

export const InvestigationSessionSchema = z.object({
  id: z.string(),
  sessionToken: z.string(),
  investigationId: z.string(),
  mode: z.enum(["pupil", "teacher-preview"]),
  stepResponses: z.record(z.string(), StepResponseSchema),
  trialData: z.array(TrialRecordSchema),
  runtimeState: RuntimeStateSchema.default({
    sceneState: {},
    interactionState: {},
    effectState: {},
    cameraState: {},
  }),
  completionState: CompletionStateSchema,
  notebookArtifacts: z
    .object({
      autoEntries: z.array(NotebookAutoEntrySchema).default([]),
      notes: z.string().default(""),
      drawing: z.string().nullable().default(null),
    })
    .default({
      autoEntries: [],
      notes: "",
      drawing: null,
    }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const InvestigationSummarySchema = InvestigationDefinitionSchema.pick({
  id: true,
  slug: true,
  title: true,
  yearGroup: true,
  ageBand: true,
  curriculumArea: true,
  enquiryType: true,
  difficulty: true,
  estimatedDuration: true,
  hero: true,
  topicKeywords: true,
  performanceTier: true,
  sceneFamily: true,
});

export const CurriculumCoverageEntrySchema = z.object({
  yearGroup: z.string(),
  curriculumArea: z.string(),
  investigationIds: z.array(z.string()),
  covered: z.boolean(),
});

export const NotebookArtifactSchema = z.object({
  sessionId: z.string(),
  investigationSlug: z.string(),
  generatedAt: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.array(z.string()),
    }),
  ),
});

export const SessionPatchSchema = z.object({
  currentStepIndex: z.number().int().min(0).max(INVESTIGATION_STEPS.length - 1),
  stepResponses: z.record(z.string(), StepResponseSchema),
  runtimeState: RuntimeStateSchema,
  notebookArtifacts: z
    .object({
      autoEntries: z.array(NotebookAutoEntrySchema).default([]),
      notes: z.string().default(""),
      drawing: z.string().nullable().default(null),
    })
    .default({
      autoEntries: [],
      notes: "",
      drawing: null,
    }),
  requiresRerun: z.boolean().optional(),
});

export const TrialCreateSchema = z.object({
  label: z.string(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  observedValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  runtimeSnapshot: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
});
