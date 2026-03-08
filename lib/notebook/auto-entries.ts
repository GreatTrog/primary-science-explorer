import type {
  InvestigationDefinition,
  InvestigationSession,
  InvestigationStep,
} from "@/lib/domain/types";

type NotebookAutoEntry = InvestigationSession["notebookArtifacts"]["autoEntries"][number];

export function buildNotebookAutoEntries(
  definition: InvestigationDefinition,
  session: Pick<InvestigationSession, "stepResponses" | "runtimeState">,
): NotebookAutoEntry[] {
  const entries: NotebookAutoEntry[] = [];

  const questionStep = definition.steps.find((step) => step.id === "question");
  if (questionStep) {
    const questionLabel = getSelectedOptionLabels(
      questionStep,
      session.stepResponses.question?.value,
    )[0];
    if (questionLabel) {
      entries.push({
        id: "question",
        label: "Enquiry question",
        content: questionLabel,
      });
    }
  }

  const planStep = definition.steps.find((step) => step.id === "plan");
  const planValues = planStep
    ? getSelectedOptionLabels(planStep, session.stepResponses.plan?.value)
    : [];
  if (planValues.length > 0) {
    const variableToChange = planValues.filter((entry) => /^change\b/i.test(entry));
    const controls = planValues.filter((entry) => !/^change\b/i.test(entry));

    if (variableToChange.length > 0) {
      entries.push({
        id: "plan-variable",
        label: "Variable to change",
        content: variableToChange.join(", "),
      });
    }

    if (controls.length > 0) {
      entries.push({
        id: "plan-controls",
        label: "Keep the same",
        content: controls.join(", "),
      });
    }
  }

  const prediction = session.stepResponses.prediction?.value;
  if (typeof prediction === "string" && prediction.trim().length > 0) {
    entries.push({
      id: "prediction",
      label: "Prediction",
      content: prediction.trim(),
    });
  }

  const sceneSetup = describeSceneSetup(definition, session.runtimeState.sceneState);
  if (sceneSetup.length > 0) {
    entries.push({
      id: "scene-setup",
      label: "Scene setup",
      content: sceneSetup.join(" | "),
    });
  }

  return entries;
}

function getSelectedOptionLabels(step: InvestigationStep, value: unknown) {
  const selectedValues = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? [value]
      : [];

  return (step.options ?? [])
    .filter((option) => selectedValues.includes(option.id))
    .map((option) => option.label);
}

function describeSceneSetup(
  definition: InvestigationDefinition,
  sceneState: InvestigationSession["runtimeState"]["sceneState"],
) {
  if (definition.sceneConfig.family === "particles_mixtures") {
    return [
      describeValue("Substance", sceneState.substanceId, definition.sceneConfig.payload.substances),
      describeValue(
        "Water temperature",
        sceneState.temperatureId,
        definition.sceneConfig.payload.temperatures,
      ),
      describeValue("Stirring", sceneState.stirId, definition.sceneConfig.payload.stirringLevels),
    ].filter(Boolean) as string[];
  }

  if (definition.sceneConfig.family === "forces_motion") {
    return [
      describeValue(
        "Canopy size",
        sceneState.parachuteId,
        definition.sceneConfig.payload.parachutes,
      ),
    ].filter(Boolean) as string[];
  }

  if (definition.sceneConfig.family === "circuits_energy") {
    return [
      describeValue("Cells", sceneState.cellId, definition.sceneConfig.payload.cells),
      describeValue("Output device", sceneState.outputId, definition.sceneConfig.payload.outputs),
    ].filter(Boolean) as string[];
  }

  if (definition.sceneConfig.family === "light_optics") {
    return [
      describeValue(
        "Mirror angle",
        sceneState.angleId,
        definition.sceneConfig.payload.mirrorAngles,
      ),
      describeValue("Target", sceneState.targetId, definition.sceneConfig.payload.targets),
    ].filter(Boolean) as string[];
  }

  return [
    describeValue("Material", sceneState.materialId, definition.sceneConfig.payload.materials),
  ].filter(Boolean) as string[];
}

function describeValue<T extends { id: string; label: string }>(
  label: string,
  selectedId: unknown,
  options: T[],
) {
  if (typeof selectedId !== "string") {
    return "";
  }

  const option = options.find((entry) => entry.id === selectedId);
  return option ? `${label}: ${option.label}` : "";
}
