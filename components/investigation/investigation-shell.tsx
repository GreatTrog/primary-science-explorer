"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Beaker,
  BookOpenText,
  Cable,
  CheckCircle2,
  ClipboardList,
  Compass,
  Droplets,
  Eye,
  FlaskConical,
  Lightbulb,
  Microscope,
  Search,
  Wind,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { NarrationButton } from "@/components/investigation/narration-button";
import { STEP_LABELS } from "@/lib/domain/constants";
import { buildCompletedSteps, getStepCompletion } from "@/lib/domain/gating";
import { createInvestigationSession, createTrialRecord } from "@/lib/domain/session-factory";
import { buildNotebookAutoEntries } from "@/lib/notebook/auto-entries";
import type {
  InvestigationDefinition,
  InvestigationSession,
  InvestigationStep,
  TrialRecord,
} from "@/lib/domain/types";
import { clearDraft, loadDraft, saveDraft } from "@/lib/hooks/use-draft-persistence";
import { useInvestigationStore } from "@/lib/hooks/use-investigation-store";
import { cn } from "@/lib/utils/cn";

const DrawingPad = dynamic(
  () => import("@/components/investigation/drawing-pad").then((mod) => mod.DrawingPad),
  { ssr: false },
);
const SimulationLoader = dynamic(
  () => import("@/components/investigation/simulation-loader").then((mod) => mod.SimulationLoader),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[1.75rem] border border-[var(--border)] bg-white/82 p-6 text-sm text-muted">
        Loading simulation...
      </div>
    ),
  },
);
const PeriscopeDiagram = dynamic(
  () => import("@/components/investigation/periscope-diagram").then((mod) => mod.PeriscopeDiagram),
  { ssr: false },
);

async function persistSessionSnapshot(payload: InvestigationSession) {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: payload,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to restore session on the server.");
  }

  return (await response.json()) as InvestigationSession;
}

type InvestigationShellProps = {
  definition: InvestigationDefinition;
  initialSession: InvestigationSession | null;
  mode: "pupil" | "teacher-preview";
};

const STEP_ICONS = {
  question: Search,
  plan: ClipboardList,
  prediction: Lightbulb,
  simulation: FlaskConical,
  record: BookOpenText,
  analyse: Microscope,
  conclusion: CheckCircle2,
  evaluate: Wrench,
} satisfies Record<InvestigationDefinition["steps"][number]["id"], typeof Search>;

export function InvestigationShell({
  definition,
  initialSession,
  mode,
}: InvestigationShellProps) {
  const router = useRouter();
  const {
    session,
    initialize,
    updateResponse,
    updateRuntimeState,
    setAutoEntries,
    setCurrentStepIndex,
    addTrial,
    setNotes,
    setDrawing,
    replaceSession,
  } = useInvestigationStore();
  const hydratedRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState<string>("Preparing investigation...");
  const draftKey = `pse:draft:${definition.slug}:${mode}`;

  const createSessionMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investigationId: definition.slug,
          mode,
        }),
      });
      if (!response.ok) {
        throw new Error("Unable to create session.");
      }
      return (await response.json()) as InvestigationSession;
    },
    onSuccess: (createdSession) => {
      initialize(createdSession);
      hydratedRef.current = true;
      setStatusMessage("Session ready.");
      if (mode === "pupil") {
        router.replace(`/investigations/${definition.slug}?session=${createdSession.id}`, {
          scroll: false,
        });
      }
    },
  });

  const patchSessionMutation = useMutation({
    retry: false,
    mutationFn: async (payload: InvestigationSession) => {
      let response = await fetch(`/api/sessions/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStepIndex: payload.completionState.currentStepIndex,
          stepResponses: payload.stepResponses,
          runtimeState: payload.runtimeState,
          notebookArtifacts: payload.notebookArtifacts,
          requiresRerun: payload.completionState.requiresRerun,
        }),
      });

      if (response.status === 404) {
        await persistSessionSnapshot(payload);
        response = await fetch(`/api/sessions/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentStepIndex: payload.completionState.currentStepIndex,
            stepResponses: payload.stepResponses,
            runtimeState: payload.runtimeState,
            notebookArtifacts: payload.notebookArtifacts,
            requiresRerun: payload.completionState.requiresRerun,
          }),
        });
      }

      if (!response.ok) {
        throw new Error("Unable to save progress.");
      }

      return (await response.json()) as InvestigationSession;
    },
    onSuccess: (savedSession) => {
      setStatusMessage(
        savedSession.completionState.lastSavedAt
          ? `All progress saved at ${new Date(
              savedSession.completionState.lastSavedAt,
            ).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}.`
          : "All progress saved.",
      );
    },
  });

  const appendTrialMutation = useMutation({
    retry: false,
    mutationFn: async (payload: {
      label: string;
      variables: Record<string, string | number | boolean>;
      observedValues: Record<string, string | number | boolean>;
      runtimeSnapshot: Record<string, unknown>;
    }) => {
      if (!session) {
        throw new Error("Session not ready");
      }

      if (mode === "teacher-preview") {
        return createTrialRecord({
          session,
          definition,
          payload,
        });
      }

      let response = await fetch(`/api/sessions/${session.id}/trials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        await persistSessionSnapshot(session);
        response = await fetch(`/api/sessions/${session.id}/trials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        throw new Error("Unable to record trial.");
      }

      return (await response.json()) as InvestigationSession["trialData"][number];
    },
    onSuccess: (trial) => {
      addTrial(trial);
      setStatusMessage("Trial recorded from the scene.");
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (hydratedRef.current) {
        return;
      }

      if (initialSession) {
        initialize(initialSession);
        hydratedRef.current = true;
        setStatusMessage("Session restored from server.");
        return;
      }

      if (mode === "teacher-preview") {
        initialize(
          createInvestigationSession({
            investigationId: definition.slug,
            mode,
          }),
        );
        hydratedRef.current = true;
        setStatusMessage("Preview ready.");
        return;
      }

      const draft = await loadDraft(draftKey);
      if (!cancelled && draft) {
        initialize(draft);
        hydratedRef.current = true;
        setStatusMessage("Resumed saved draft.");
        if (mode === "pupil") {
          router.replace(`/investigations/${definition.slug}?session=${draft.id}`, {
            scroll: false,
          });
          void persistSessionSnapshot(draft)
            .then((restoredSession) => {
              if (!cancelled) {
                replaceSession(restoredSession);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setStatusMessage("Resumed saved draft. Server sync pending.");
              }
            });
        }
        return;
      }

      if (!cancelled) {
        createSessionMutation.mutate();
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    createSessionMutation,
    definition.slug,
    draftKey,
    initialSession,
    initialize,
    mode,
    replaceSession,
    router,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (mode === "teacher-preview") {
      return;
    }

    void saveDraft(draftKey, session);
    const timeout = window.setTimeout(() => {
      patchSessionMutation.mutate(session);
    }, 900);

      return () => {
        window.clearTimeout(timeout);
      };
  }, [draftKey, mode, patchSessionMutation, session]);

  const completedSteps = useMemo(() => {
    if (!session) {
      return [];
    }

    return buildCompletedSteps(definition.steps, {
      stepResponses: session.stepResponses,
      trialData: session.trialData,
    });
  }, [definition.steps, session]);

  const maxUnlockedStepIndex = useMemo(() => {
    if (!session) {
      return 0;
    }

    if (mode === "teacher-preview") {
      return definition.steps.length - 1;
    }

    const firstIncomplete = definition.steps.findIndex(
      (step) =>
        !getStepCompletion(step, {
          stepResponses: session.stepResponses,
          trialData: session.trialData,
        }),
    );

    if (firstIncomplete === -1) {
      return definition.steps.length - 1;
    }

    if (session.completionState.requiresRerun) {
      return Math.min(definition.steps.findIndex((step) => step.id === "simulation"), definition.steps.length - 1);
    }

    return firstIncomplete;
  }, [definition.steps, mode, session]);

  const currentStepIndex = session?.completionState.currentStepIndex ?? 0;
  const currentStep = definition.steps[currentStepIndex] ?? definition.steps[0];
  const currentStepComplete = session
    ? getStepCompletion(currentStep, {
        stepResponses: session.stepResponses,
        trialData: session.trialData,
      })
    : false;
  const canAdvance = mode === "teacher-preview" || currentStepComplete;
  const canRetreat = currentStepIndex > 0;
  const notebookAutoEntries = session?.notebookArtifacts.autoEntries ?? [];

  function handleAdvance() {
    if (!session || currentStepIndex === definition.steps.length - 1) {
      return;
    }

    setAutoEntries(buildNotebookAutoEntries(definition, session));
    setCurrentStepIndex(Math.min(currentStepIndex + 1, definition.steps.length - 1));
  }

  async function exportNotebook() {
    if (!session) {
      return;
    }

    const response = await fetch("/api/exports/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          slug: definition.slug,
          session: mode === "teacher-preview" ? session : undefined,
        }),
      });

    if (response.ok) {
      await clearDraft(draftKey);
      router.push(`/teacher/export/${session.id}`);
    }
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="glass-panel rounded-[2rem] p-8 text-center">
          <p className="display-font text-3xl">Opening investigation...</p>
          <p className="mt-3 text-muted">{statusMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div
          className="p-6 text-white sm:p-8"
          style={{
            background: `linear-gradient(135deg, ${definition.hero.accent}, rgba(20,50,61,0.95))`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.22em] text-white/72">
                {definition.hero.eyebrow}
              </p>
              <h1 className="display-font mt-2 text-4xl leading-tight sm:text-5xl">
                {definition.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base text-white/86">{definition.hero.blurb}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <NarrationButton
                text={`${currentStep.title}. ${currentStep.prompt}. ${currentStep.guidance}`}
              />
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-sm font-semibold text-white"
              >
                Back to dashboard
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/82">
            <span>{definition.yearGroup}</span>
            <span>&bull;</span>
            <span>{definition.curriculumArea}</span>
            <span>&bull;</span>
            <span>{definition.enquiryType}</span>
            <span>&bull;</span>
            <span>{definition.estimatedDuration} minutes</span>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[50px_minmax(0,1fr)_320px]">
        <aside className="glass-panel flex flex-col items-center gap-3 rounded-[1.6rem] px-1 py-3">
          {definition.steps.map((step, index) => {
            const StepIcon = STEP_ICONS[step.id];
            const completed = completedSteps.includes(step.id);
            const active = currentStep.id === step.id;
            const locked = mode !== "teacher-preview" && index > maxUnlockedStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                title={step.title}
                aria-label={step.title}
                disabled={locked}
                onClick={() => setCurrentStepIndex(index)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl border text-[var(--foreground)]",
                  active && "border-[var(--accent-pond)] bg-[rgba(42,157,143,0.14)]",
                  completed && "bg-white",
                  locked && "cursor-not-allowed opacity-40",
                )}
              >
                <StepIcon className="h-4 w-4" />
              </button>
            );
          })}
        </aside>

        <section className="space-y-4">
          <article className="glass-panel rounded-[1.9rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.18em] text-muted">
                  {STEP_LABELS[currentStep.id]}
                </p>
                <h2 className="display-font mt-2 text-3xl">{currentStep.title}</h2>
                <p className="mt-3 text-lg">{currentStep.prompt}</p>
                <p className="mt-2 text-sm text-muted">{currentStep.guidance}</p>
              </div>
              <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold">
                Step {currentStepIndex + 1} of {definition.steps.length}
              </div>
            </div>

            <div className="mt-6">
              <StepContent
                definition={definition}
                mode={mode}
                runtimeState={session.runtimeState}
                stepResponses={session.stepResponses}
                step={currentStep}
                trials={session.trialData}
                value={session.stepResponses[currentStep.id]?.value}
                onRuntimeStateChange={updateRuntimeState}
                onValueChange={(value) => updateResponse(currentStep.id, value)}
                onRunTrial={async (payload) => {
                  await appendTrialMutation.mutateAsync(payload);
                }}
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-5">
              <div className="text-sm text-muted">
                {session.completionState.requiresRerun
                  ? "Change detected in the plan. Re-run the scene before moving on."
                  : statusMessage}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!canRetreat}
                  onClick={() => setCurrentStepIndex(Math.max(currentStepIndex - 1, 0))}
                  className="inline-flex min-h-12 items-center rounded-full border border-[var(--border)] px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canAdvance || currentStepIndex === definition.steps.length - 1}
                  onClick={handleAdvance}
                  className="inline-flex min-h-12 items-center rounded-full bg-[var(--foreground)] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            </div>
          </article>

          {session.trialData.length > 0 ? (
            <article className="glass-panel rounded-[1.7rem] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                <h3 className="display-font text-2xl">Trial evidence</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="pb-2 pr-4">Trial</th>
                      <th className="pb-2 pr-4">Setup</th>
                      <th className="pb-2 pr-4">{getTrialOutcomeHeader(definition)}</th>
                      <th className="pb-2 pr-4">Time taken (s)</th>
                      <th className="pb-2 pr-4">Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.trialData.map((trial) => (
                      <tr key={trial.id} className="border-t border-[var(--border)] align-top">
                        <td className="py-3 pr-4 font-semibold">{trial.trialNumber}</td>
                        <td className="py-3 pr-4">{formatTrialSetup(trial)}</td>
                        <td className="py-3 pr-4 font-semibold">
                          {formatTrialOutcome(definition, trial)}
                        </td>
                        <td className="py-3 pr-4">{formatTrialTimeTaken(trial)}</td>
                        <td className="py-3 pr-4">{formatTrialObservations(trial)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="glass-panel rounded-[1.75rem] p-4">
            <h2 className="display-font text-2xl">Notebook</h2>
            {notebookAutoEntries.length > 0 ? (
              <div className="mt-4 space-y-3">
                {notebookAutoEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[1.35rem] border border-[var(--border)] bg-[rgba(42,157,143,0.08)] px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">{entry.label}</p>
                    <p className="mt-1 text-sm font-medium">{entry.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[1.35rem] border border-dashed border-[var(--border)] bg-white/60 px-4 py-3 text-sm text-muted">
                Auto-added decisions appear here each time you move to the next step.
              </p>
            )}
            <label className="mt-4 block text-sm font-semibold text-[var(--foreground)]">
              Your notes
            </label>
            <textarea
              value={session.notebookArtifacts.notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={8}
              placeholder="Add your own extra notes here."
              className="mt-2 w-full rounded-3xl border border-[var(--border)] bg-white/82 px-4 py-3"
            />
            {definition.recordingModes.includes("drawing") ? (
              <div className="mt-4">
                <DrawingPad onChange={setDrawing} />
              </div>
            ) : null}
          </div>

          <div className="glass-panel rounded-[1.75rem] p-4">
            <h3 className="display-font text-xl">Teacher tools</h3>
            <p className="mt-2 text-sm text-muted">
              Preview mode unlocks all steps. Export captures the notebook, trial evidence and scene state summary.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {mode === "teacher-preview" ? (
                <button
                  type="button"
                  onClick={() => {
                    replaceSession({
                      ...session,
                      stepResponses: {},
                      trialData: [],
                      runtimeState: {
                        sceneState: {},
                        interactionState: {},
                        effectState: {},
                        cameraState: {},
                      },
                      completionState: {
                        ...session.completionState,
                        currentStepIndex: 0,
                        completedSteps: [],
                        requiresRerun: false,
                      },
                      notebookArtifacts: {
                        autoEntries: [],
                        notes: "",
                        drawing: null,
                      },
                    });
                    setStatusMessage("Teacher demo reset.");
                  }}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-4 font-semibold"
                >
                  Reset demo
                </button>
              ) : null}
              <button
                type="button"
                onClick={exportNotebook}
                className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent-coral)] px-4 font-semibold text-white"
              >
                Export notebook
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StepContent({
  definition,
  mode,
  onRunTrial,
  onRuntimeStateChange,
  onValueChange,
  runtimeState,
  stepResponses,
  step,
  trials,
  value,
}: {
  definition: InvestigationDefinition;
  mode: InvestigationSession["mode"];
  step: InvestigationStep;
  value: unknown;
  runtimeState: InvestigationSession["runtimeState"];
  stepResponses: InvestigationSession["stepResponses"];
  trials: InvestigationSession["trialData"];
  onValueChange: (value: unknown) => void;
  onRuntimeStateChange: (runtimeState: Partial<InvestigationSession["runtimeState"]>) => void;
  onRunTrial: (payload: {
    label: string;
    variables: Record<string, string | number | boolean>;
    observedValues: Record<string, string | number | boolean>;
    runtimeSnapshot: Record<string, unknown>;
  }) => Promise<void>;
}) {
  if (step.responseType === "simulation") {
    if (definition.sceneConfig.family === "light_optics") {
      return (
        <PeriscopeDiagram
          definition={definition}
          runtimeState={runtimeState}
          mode={mode}
          onRuntimeStateChange={onRuntimeStateChange}
          onRunTrial={onRunTrial}
        />
      );
    }

    return (
      <SimulationLoader
        key={definition.slug}
        definition={definition}
        runtimeState={runtimeState}
        stepResponses={stepResponses}
        mode={mode}
        onRuntimeStateChange={onRuntimeStateChange}
        onRunTrial={onRunTrial}
      />
    );
  }

  if (step.responseType === "choice") {
    const selectedValues = Array.isArray(value)
      ? value.map(String)
      : typeof value === "string"
        ? [value]
        : [];

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {step.options?.map((option) => {
          const selected = selectedValues.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (step.allowMultiple) {
                  const nextValues = selected
                    ? selectedValues.filter((entry) => entry !== option.id)
                    : [...selectedValues, option.id];
                  onValueChange(nextValues);
                } else {
                  onValueChange(option.id);
                }
              }}
              className={cn(
                "rounded-[1.5rem] border p-4 text-left",
                selected
                  ? "border-[var(--accent-pond)] bg-[rgba(42,157,143,0.12)]"
                  : "border-[var(--border)] bg-white/82",
              )}
            >
              <span className="block font-semibold">{option.label}</span>
              {option.description ? (
                <span className="mt-2 block text-sm text-muted">{option.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step.id === "prediction" ? (
        <PredictionSetupPreview definition={definition} stepResponses={stepResponses} />
      ) : null}
      {step.sentenceStem ? (
        <p className="rounded-2xl bg-white/78 px-4 py-3 text-sm text-muted">
          Sentence stem: {step.sentenceStem}
        </p>
      ) : null}
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onValueChange(event.target.value)}
        rows={8}
        placeholder="Record your thinking here."
        className="w-full rounded-[1.5rem] border border-[var(--border)] bg-white/82 px-4 py-3"
      />
      {(step.id === "record" || step.id === "analyse") && trials.length > 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/72 p-4 text-sm text-muted">
          Use the live scene and the trial table below as evidence for this step.
        </div>
      ) : null}
    </div>
  );
}

function PredictionSetupPreview({
  definition,
  stepResponses,
}: {
  definition: InvestigationDefinition;
  stepResponses: InvestigationSession["stepResponses"];
}) {
  const planStep = definition.steps.find((step) => step.id === "plan");
  const selectedPlanLabels = planStep
    ? getSelectedOptionLabels(planStep, stepResponses.plan?.value)
    : [];
  const variablesToChange = selectedPlanLabels.filter((entry) => /^change\b/i.test(entry));
  const controls = selectedPlanLabels.filter((entry) => !/^change\b/i.test(entry));

  return (
    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[1.6rem] border border-[var(--border)] bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(230,243,248,0.9))] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Setup preview</p>
        <p className="mt-2 text-sm text-muted">
          Study the apparatus before you predict. The full interactive scene opens in the next step.
        </p>
        <div className="mt-4">
          <ScenePreviewArt definition={definition} />
        </div>
      </div>

      <div className="space-y-3">
        <PreviewFact
          icon={<ArrowRightLeft className="h-4 w-4" />}
          label="Variable to change"
          value={variablesToChange.join(", ") || "Choose this in the plan step first."}
        />
        <PreviewFact
          icon={<ClipboardList className="h-4 w-4" />}
          label="Keep the same"
          value={controls.join(", ") || "Select your control variables in the plan step."}
        />
        <PreviewFact
          icon={<Eye className="h-4 w-4" />}
          label="What you will see"
          value={getPreviewSummary(definition)}
        />
      </div>
    </section>
  );
}

function ScenePreviewArt({ definition }: { definition: InvestigationDefinition }) {
  if (definition.sceneFamily === "light_optics") {
    return (
      <div className="relative h-64 overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[linear-gradient(180deg,#edf8ff,#d9edf9)]">
        <svg viewBox="0 0 520 208" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <rect x="0" y="0" width="520" height="208" fill="#dfeaf2" />
          <rect x="0" y="160" width="520" height="48" fill="#ccb392" />

          <g transform="translate(36 -6) scale(0.5)">
            <path
              d="M 170 50 H 430 V 315 H 585 V 385 H 335 V 120 H 170 Z"
              fill="#f1efb3"
              stroke="#6e6e6e"
              strokeWidth="6"
              strokeLinejoin="miter"
            />

            <rect
              x="190"
              y="126"
              width="92"
              height="258"
              fill="url(#preview-brick-pattern)"
              stroke="#a7522a"
              strokeWidth="3"
            />

            <line x1="368.1" y1="60.1" x2="421.9" y2="113.9" stroke="#8b8b8b" strokeWidth="10" strokeLinecap="round" />
            <line x1="342.1" y1="313.1" x2="395.9" y2="366.9" stroke="#8b8b8b" strokeWidth="10" strokeLinecap="round" />

            <line x1="46" y1="87" x2="82" y2="87" stroke="#e45757" strokeWidth="10" strokeLinecap="round" />
            <circle cx="108" cy="87" r="32" fill="#e45757" stroke="#111111" strokeWidth="5" />

            <circle cx="694" cy="340" r="42" fill="#ffffff" stroke="#111111" strokeWidth="6" />
            <circle cx="654" cy="340" r="14" fill="#2b3b45" />
          </g>

          <defs>
            <pattern id="preview-brick-pattern" width="24" height="16" patternUnits="userSpaceOnUse">
              <rect width="24" height="16" fill="#ecd7cf" />
              <rect x="0" y="2" width="16" height="5" fill="#c76433" />
              <rect x="12" y="9" width="12" height="5" fill="#c76433" />
            </pattern>
          </defs>
        </svg>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold">
          <Compass className="h-4 w-4" />
          Mirror angles and target visibility
        </div>
      </div>
    );
  }

  if (definition.sceneFamily === "particles_mixtures") {
    return (
      <div className="relative h-52 overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[linear-gradient(180deg,#fbfdff,#e3f0fa)]">
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#d4b390]" />
        <div className="absolute left-[36%] top-[18%] h-28 w-24 rounded-b-[2rem] rounded-t-[1rem] border-4 border-white/80 bg-transparent" />
        <div className="absolute left-[38%] top-[34%] h-16 w-20 rounded-b-[1.4rem] bg-[#83d0ff]/80" />
        <div className="absolute left-[60%] top-[16%] h-20 w-2 rotate-12 rounded-full bg-[#cfd5db]" />
        <div className="absolute left-[42%] top-[44%] h-2 w-2 rounded-full bg-[#c6aa72]" />
        <div className="absolute left-[47%] top-[48%] h-2 w-2 rounded-full bg-[#c6aa72]" />
        <div className="absolute left-[52%] top-[45%] h-2 w-2 rounded-full bg-[#c6aa72]" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold">
          <Droplets className="h-4 w-4" />
          Beaker, water, particles and stirring
        </div>
      </div>
    );
  }

  if (definition.sceneFamily === "circuits_energy") {
    return (
      <div className="relative h-52 overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[linear-gradient(180deg,#f7fbff,#e1edf7)]">
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#d1bea1]" />
        <div className="absolute left-[14%] top-[48%] h-3 w-24 rounded-full bg-[#d8aa2f]" />
        <div className="absolute left-[14%] top-[42%] h-10 w-6 rounded-full bg-[#57c26e]" />
        <div className="absolute left-[24%] top-[42%] h-10 w-6 rounded-full bg-[#57c26e]" />
        <div className="absolute left-[45%] top-[44%] h-8 w-16 rounded-full bg-[#ef9f62]" />
        <div className="absolute right-[18%] top-[34%] h-12 w-12 rounded-full bg-[#ffd96f]/90 shadow-[0_0_40px_rgba(255,217,111,0.7)]" />
        <div className="absolute right-[26%] top-[50%] h-3 w-14 rounded-full bg-[#d8aa2f]" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold">
          <Cable className="h-4 w-4" />
          Cells, resistor and bulb brightness
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-52 overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[linear-gradient(180deg,#eff9ff,#dceefe)]">
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#a7d4a4]" />
      <div className="absolute left-[20%] top-[14%] h-28 w-8 bg-[#d9cbb4]" />
      <div className="absolute left-[18%] top-[10%] h-4 w-20 rounded-md bg-[#8b6b44]" />
      <div className="absolute left-[48%] top-[18%] h-10 w-16 rounded-full border-4 border-dashed border-[#f3b96f]" />
      <div className="absolute left-[54%] top-[32%] h-10 w-4 rounded-full bg-[#3a4f62]" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold">
        <Wind className="h-4 w-4" />
        Tower drop with changing parachute canopy
      </div>
    </div>
  );
}

function PreviewFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/80 p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function getPreviewSummary(definition: InvestigationDefinition) {
  if (definition.sceneFamily === "light_optics") {
    return "A target, a transparent periscope, two mirrors and an eyepiece so you can see whether the beam reaches the viewer.";
  }

  if (definition.sceneFamily === "particles_mixtures") {
    return "A beaker of water, moving particles and visible stirring so you can compare dissolving with settling.";
  }

  if (definition.sceneFamily === "circuits_energy") {
    return "A complete circuit with cells, wires and either a bulb or buzzer so you can see the full closed loop.";
  }

  if (definition.sceneFamily === "forces_motion") {
    return "A drop tower scene showing how canopy size changes the parachute descent.";
  }

  return "A procedural materials bench that shows how the selected surface reacts during testing.";
}

function formatTrialSetup(trial: TrialRecord) {
  const substance = asString(trial.variables.Substance);
  const temperature = asSentenceCase(trial.variables.Temperature);
  const stirring = asSentenceCase(trial.variables.Stirring);
  if (substance && temperature && stirring) {
    return `${substance} in ${temperature} with ${stirring}`;
  }

  const cells = asString(trial.variables.Cells);
  const output = asSentenceCase(trial.variables.Output);
  if (cells && output) {
    return `${cells} connected to a ${output}`;
  }

  const canopy = asString(trial.variables.Canopy);
  if (canopy) {
    return `${canopy} parachute setup`;
  }

  const material = asString(trial.variables.Material);
  if (material) {
    return `${material} material test`;
  }

  const mirrorAngle = asString(trial.variables.MirrorAngle);
  const target = asSentenceCase(trial.variables.Target);
  if (mirrorAngle && target) {
    return `${mirrorAngle} aimed at ${target}`;
  }

  return Object.entries(trial.variables)
    .map(([, value]) => String(value))
    .join(", ");
}

function getTrialOutcomeHeader(definition: InvestigationDefinition) {
  if (definition.sceneFamily === "particles_mixtures") {
    return "Dissolved";
  }

  if (definition.sceneFamily === "forces_motion") {
    return "Air resistance";
  }

  if (definition.sceneFamily === "circuits_energy") {
    return "Output";
  }

  if (definition.sceneFamily === "light_optics") {
    return "Target visible";
  }

  if (definition.sceneFamily === "materials_lab") {
    return "Absorbency";
  }

  return "Result";
}

function formatTrialDissolved(trial: TrialRecord) {
  const residueVisible = asBoolean(trial.observedValues.residueVisible);
  if (typeof residueVisible === "boolean") {
    return residueVisible ? "✗" : "✓";
  }

  const outcome = asString(trial.observedValues.outcome)?.toLowerCase();
  if (outcome?.includes("did not dissolve")) {
    return "✗";
  }
  if (typeof trial.observedValues.dissolveTimeSeconds === "number") {
    return "✓";
  }

  return "—";
}

function formatTrialOutcome(definition: InvestigationDefinition, trial: TrialRecord) {
  if (definition.sceneFamily === "particles_mixtures") {
    return formatTrialDissolved(trial);
  }

  if (definition.sceneFamily === "forces_motion") {
    const airResistanceLevel = asString(trial.observedValues.airResistanceLevel);
    return airResistanceLevel ? sentenceCase(airResistanceLevel) : "—";
  }

  if (definition.sceneFamily === "circuits_energy") {
    return asString(trial.observedValues.effectLabel) ?? "—";
  }

  if (definition.sceneFamily === "light_optics") {
    const targetVisible = asBoolean(trial.observedValues.targetVisible);
    return typeof targetVisible === "boolean" ? (targetVisible ? "✓" : "✗") : "—";
  }

  if (definition.sceneFamily === "materials_lab") {
    const drynessScore = trial.observedValues.drynessScore;
    return typeof drynessScore === "number" ? `${drynessScore}/5 dry` : "—";
  }

  return "—";
}

function formatTrialTimeTaken(trial: TrialRecord) {
  const timeKeys = [
    "dissolveTimeSeconds",
    "settlingTimeSeconds",
    "dropTimeSeconds",
    "measuredTimeSeconds",
  ] as const;

  for (const key of timeKeys) {
    const value = trial.observedValues[key];
    if (typeof value === "number") {
      return formatSeconds(value);
    }
  }

  return "—";
}

function formatTrialObservations(trial: TrialRecord) {
  const observations: string[] = [];
  const dissolved = formatTrialDissolved(trial);

  if (dissolved === "✓") {
    observations.push("The substance dissolved.");
  } else if (dissolved === "✗") {
    observations.push("The substance did not dissolve.");
  }

  for (const [key, value] of Object.entries(trial.observedValues)) {
    if (
      key === "dissolveTimeSeconds" ||
      key === "settlingTimeSeconds" ||
      key === "measuredTimeSeconds" ||
      key === "dropTimeSeconds" ||
      key === "residueVisible" ||
      key === "outcome"
    ) {
      continue;
    }

    observations.push(`${humanizeKey(key)}: ${formatObservedValue(value)}`);
  }

  return observations.join(" ");
}

function asString(value: string | number | boolean | undefined) {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: string | number | boolean | undefined) {
  return typeof value === "boolean" ? value : undefined;
}

function asSentenceCase(value: string | number | boolean | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return sentenceCase(value);
}

function formatSeconds(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatObservedValue(value: string | number | boolean) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value;
}

function humanizeKey(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function sentenceCase(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
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
