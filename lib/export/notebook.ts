import type { InvestigationDefinition, InvestigationSession, NotebookArtifact } from "@/lib/domain/types";
import { buildNotebookAutoEntries } from "@/lib/notebook/auto-entries";
import { formatDateTime, nowIso } from "@/lib/utils/time";

function formatResponse(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join(", ");
  }

  return "Not recorded";
}

export function buildNotebookArtifact(
  definition: InvestigationDefinition,
  session: InvestigationSession,
): NotebookArtifact {
  const autoEntries =
    session.notebookArtifacts.autoEntries.length > 0
      ? session.notebookArtifacts.autoEntries
      : buildNotebookAutoEntries(definition, session);

  return {
    sessionId: session.id,
    investigationSlug: definition.slug,
    generatedAt: nowIso(),
    sections: [
      {
        title: "Investigation overview",
        content: [
          `${definition.title} (${definition.yearGroup})`,
          `${definition.curriculumArea} | ${definition.enquiryType}`,
          `Last saved: ${session.completionState.lastSavedAt ? formatDateTime(session.completionState.lastSavedAt) : "Draft only"}`,
        ],
      },
      ...definition.steps.map((step) => ({
        title: step.title,
        content: [step.prompt, formatResponse(session.stepResponses[step.id]?.value)],
      })),
      {
        title: "Trial records",
        content:
          session.trialData.length > 0
            ? session.trialData.map(
                (trial) =>
                  `Trial ${trial.trialNumber}: ${trial.label} | ${formatResponse(trial.variables)} | ${formatResponse(trial.observedValues)}`,
              )
            : ["No trials recorded"],
      },
      {
        title: "Scene state",
        content: [formatResponse(session.runtimeState.sceneState)],
      },
      {
        title: "Notebook decisions",
        content:
          autoEntries.length > 0
            ? autoEntries.map((entry) => `${entry.label}: ${entry.content}`)
            : ["No auto-generated notebook entries yet"],
      },
      {
        title: "Notebook notes",
        content: [session.notebookArtifacts.notes || "No extra notes recorded"],
      },
    ],
  };
}
