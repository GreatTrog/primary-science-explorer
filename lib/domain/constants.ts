export const INVESTIGATION_STEPS = [
  "question",
  "plan",
  "prediction",
  "simulation",
  "record",
  "analyse",
  "conclusion",
  "evaluate",
] as const;

export const AGE_BANDS = ["LKS2", "UKS2"] as const;
export const SCENE_FAMILIES = [
  "materials_lab",
  "forces_motion",
  "circuits_energy",
  "light_optics",
  "particles_mixtures",
] as const;
export const RECORDING_MODES = [
  "short-text",
  "simple-table",
  "labelled-note",
  "drawing",
] as const;
export const PERFORMANCE_TIERS = ["baseline", "enhanced"] as const;

export const CAMERA_PRESETS = [
  "bench-close",
  "tower-drop",
  "circuit-lab",
  "optics-focus",
  "mixtures-bench",
] as const;

export const LIGHTING_PRESETS = [
  "bright-lab",
  "warm-lab",
  "demo-stage",
] as const;

export const STEP_LABELS: Record<(typeof INVESTIGATION_STEPS)[number], string> = {
  question: "Question",
  plan: "Plan",
  prediction: "Predict",
  simulation: "Test",
  record: "Record",
  analyse: "Analyse",
  conclusion: "Conclude",
  evaluate: "Evaluate",
};
