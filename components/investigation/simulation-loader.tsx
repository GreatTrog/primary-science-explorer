"use client";

import { Beaker, Cable, Compass, MoveDown, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { InvestigationDefinition, InvestigationSession } from "@/lib/domain/types";
import { createSceneController } from "@/lib/runtime/registry";
import type { SceneRuntimeController } from "@/lib/runtime/types";

type SelectionState = Record<string, string>;

export function SimulationLoader({
  definition,
  runtimeState,
  stepResponses,
  onRuntimeStateChange,
  onRunTrial,
  mode,
}: {
  definition: InvestigationDefinition;
  runtimeState: InvestigationSession["runtimeState"];
  stepResponses: InvestigationSession["stepResponses"];
  onRuntimeStateChange: (runtimeState: Partial<InvestigationSession["runtimeState"]>) => void;
  onRunTrial: (payload: {
    label: string;
    variables: Record<string, string | number | boolean>;
    observedValues: Record<string, string | number | boolean>;
    runtimeSnapshot: Record<string, unknown>;
  }) => Promise<void>;
  mode: InvestigationSession["mode"];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<SceneRuntimeController | null>(null);
  const initialRuntimeRef = useRef(runtimeState);
  const [selection, setSelection] = useState<SelectionState>(() => deriveInitialSelection(definition, runtimeState));
  const selectionRef = useRef(selection);
  const lastRestoredSceneStateRef = useRef<SelectionState>(deriveInitialSelection(definition, runtimeState));
  const lastEmittedSceneStateRef = useRef<SelectionState>(deriveInitialSelection(definition, runtimeState));
  const [readinessMessage, setReadinessMessage] = useState<string>("Choose your variables, then run the scene.");
  const [busy, setBusy] = useState(false);
  const fieldConstraints = useMemo(
    () => getFieldConstraints(definition, stepResponses, selection),
    [definition, selection, stepResponses],
  );

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    const sceneCanvas = canvasRef.current;
    if (!sceneCanvas) {
      return;
    }
    const canvas = sceneCanvas;

    let cancelled = false;

    async function mountScene() {
      const controller = await createSceneController(
        canvas,
        definition,
        initialRuntimeRef.current,
      );
      if (cancelled) {
        controller.disposeScene();
        return;
      }
      controllerRef.current = controller;
      controller.restoreSceneState(initialRuntimeRef.current);
      const initialSelection = deriveInitialSelection(definition, initialRuntimeRef.current);
      controller.updateSelection(initialSelection);
      lastRestoredSceneStateRef.current = initialSelection;
      lastEmittedSceneStateRef.current = initialSelection;
      setReadinessMessage(controller.getStepReadiness("simulation").reason ?? "Scene ready.");
    }

    void mountScene();

    function handleResize() {
      controllerRef.current?.engine.resize();
    }

    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      controllerRef.current?.disposeScene();
      controllerRef.current = null;
    };
  }, [definition]);

  useEffect(() => {
    const nextSelection = deriveInitialSelection(definition, runtimeState);
    const constrainedSelection = applyFieldConstraints(nextSelection, fieldConstraints);
    const isExternalRuntimeUpdate = !isSameSelection(
      constrainedSelection,
      lastEmittedSceneStateRef.current,
    );

    if (isExternalRuntimeUpdate) {
      if (!isSameSelection(selectionRef.current, constrainedSelection)) {
        queueMicrotask(() => {
          setSelection(constrainedSelection);
        });
      }
      if (!isSameSelection(lastRestoredSceneStateRef.current, constrainedSelection)) {
        controllerRef.current?.restoreSceneState(runtimeState);
        lastRestoredSceneStateRef.current = constrainedSelection;
      }
    }

    if (controllerRef.current) {
      const nextMessage =
        controllerRef.current.getStepReadiness("simulation").reason ?? "Scene ready.";
      queueMicrotask(() => {
        setReadinessMessage(nextMessage);
      });
    }
  }, [definition, fieldConstraints, runtimeState]);

  useEffect(() => {
    const constrainedSelection = applyFieldConstraints(selectionRef.current, fieldConstraints);
    if (!isSameSelection(selectionRef.current, constrainedSelection)) {
      queueMicrotask(() => {
        setSelection(constrainedSelection);
      });
    }
  }, [fieldConstraints]);

  useEffect(() => {
    if (!controllerRef.current) {
      return;
    }
    controllerRef.current.updateSelection(selection);
    lastRestoredSceneStateRef.current = selection;
    if (!isSameSelection(lastEmittedSceneStateRef.current, selection)) {
      lastEmittedSceneStateRef.current = selection;
      onRuntimeStateChange({
        sceneState: {
          ...selection,
        },
      });
    }
  }, [onRuntimeStateChange, selection]);

  const overlay = useMemo(() => {
    switch (definition.sceneConfig.family) {
      case "particles_mixtures":
        return (
          <>
            <SelectField
              label="Substance"
              icon={<Beaker className="h-4 w-4" />}
              value={selection.substanceId ?? definition.sceneConfig.payload.substances[0].id}
              disabled={fieldConstraints.substanceId?.disabled}
              helperText={fieldConstraints.substanceId?.reason}
              options={definition.sceneConfig.payload.substances.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, substanceId: value }))}
            />
            <SelectField
              label="Water temperature"
              icon={<Waves className="h-4 w-4" />}
              value={selection.temperatureId ?? definition.sceneConfig.payload.temperatures[0].id}
              disabled={fieldConstraints.temperatureId?.disabled}
              helperText={fieldConstraints.temperatureId?.reason}
              options={definition.sceneConfig.payload.temperatures.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, temperatureId: value }))}
            />
            <SelectField
              label="Stirring"
              icon={<MoveDown className="h-4 w-4" />}
              value={selection.stirId ?? definition.sceneConfig.payload.stirringLevels[0].id}
              disabled={fieldConstraints.stirId?.disabled}
              helperText={fieldConstraints.stirId?.reason}
              options={definition.sceneConfig.payload.stirringLevels.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, stirId: value }))}
            />
          </>
        );
      case "forces_motion":
        return (
          <SelectField
            label="Canopy size"
            icon={<MoveDown className="h-4 w-4" />}
            value={selection.parachuteId ?? definition.sceneConfig.payload.parachutes[0].id}
            options={definition.sceneConfig.payload.parachutes.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            onChange={(value) => setSelection((current) => ({ ...current, parachuteId: value }))}
          />
        );
      case "circuits_energy":
        return (
          <>
            <SelectField
              label="Cells"
              icon={<Cable className="h-4 w-4" />}
              value={selection.cellId ?? definition.sceneConfig.payload.cells[0].id}
              options={definition.sceneConfig.payload.cells.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, cellId: value }))}
            />
            <SelectField
              label="Output device"
              icon={<Cable className="h-4 w-4" />}
              value={selection.outputId ?? definition.sceneConfig.payload.outputs[0].id}
              options={definition.sceneConfig.payload.outputs.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, outputId: value }))}
            />
          </>
        );
      case "light_optics":
        return (
          <>
            <SelectField
              label="Mirror angle"
              icon={<Compass className="h-4 w-4" />}
              value={selection.angleId ?? definition.sceneConfig.payload.mirrorAngles[0].id}
              options={definition.sceneConfig.payload.mirrorAngles.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, angleId: value }))}
            />
            <SelectField
              label="Target"
              icon={<Compass className="h-4 w-4" />}
              value={selection.targetId ?? definition.sceneConfig.payload.targets[0].id}
              options={definition.sceneConfig.payload.targets.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              onChange={(value) => setSelection((current) => ({ ...current, targetId: value }))}
            />
          </>
        );
      default:
        return (
          <SelectField
            label="Material"
            icon={<Beaker className="h-4 w-4" />}
            value={selection.materialId ?? definition.sceneConfig.payload.materials[0].id}
            options={definition.sceneConfig.payload.materials.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            onChange={(value) => setSelection((current) => ({ ...current, materialId: value }))}
          />
        );
    }
  }, [definition.sceneConfig, fieldConstraints, selection]);

  async function runScene() {
    if (!controllerRef.current) {
      return;
    }
    const readiness = controllerRef.current.getStepReadiness("simulation");
    if (!readiness.ready) {
      setReadinessMessage(readiness.reason ?? "Complete the scene setup first.");
      return;
    }

    setBusy(true);
    const trial = await controllerRef.current.runAction("primary");
    const snapshot = controllerRef.current.snapshotSceneState();
    onRuntimeStateChange(snapshot);
    setBusy(false);

    if (trial) {
      await onRunTrial({
        ...trial,
        runtimeSnapshot: {
          ...trial.runtimeSnapshot,
          ...snapshot.sceneState,
        },
      });
      setReadinessMessage("Trial captured from the scene.");
    }
  }

  const familyTitles: Record<InvestigationDefinition["sceneFamily"], string> = {
    materials_lab: "Materials lab scene",
    forces_motion: "Forces scene",
    circuits_energy: "Complete circuit scene",
    light_optics: "Periscope reflection scene",
    particles_mixtures: "Mixtures scene",
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-white/82 p-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        {overlay}
        <button
          type="button"
          onClick={runScene}
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-pond)] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Running scene..." : mode === "teacher-preview" ? "Demo scene" : "Run experiment"}
        </button>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(234,242,248,0.86))] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <p className="display-font text-2xl">{familyTitles[definition.sceneFamily]}</p>
            <p className="text-sm text-muted">{readinessMessage}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Procedural Babylon.js runtime
          </p>
        </div>
        <div className="overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[#dfeffd]">
          <canvas ref={canvasRef} className="block h-[420px] w-full" aria-label={definition.title} />
        </div>
      </div>
    </div>
  );
}

function deriveInitialSelection(
  definition: InvestigationDefinition,
  runtimeState: InvestigationSession["runtimeState"],
): SelectionState {
  const sceneState = runtimeState.sceneState;

  if (definition.sceneConfig.family === "particles_mixtures") {
    return {
      substanceId: String(sceneState.substanceId ?? definition.sceneConfig.payload.substances[0].id),
      temperatureId: String(sceneState.temperatureId ?? definition.sceneConfig.payload.temperatures[1]?.id ?? definition.sceneConfig.payload.temperatures[0].id),
      stirId: String(sceneState.stirId ?? definition.sceneConfig.payload.stirringLevels[1]?.id ?? definition.sceneConfig.payload.stirringLevels[0].id),
    };
  }

  if (definition.sceneConfig.family === "forces_motion") {
    return {
      parachuteId: String(sceneState.parachuteId ?? definition.sceneConfig.payload.parachutes[0].id),
    };
  }

  if (definition.sceneConfig.family === "circuits_energy") {
    return {
      cellId: String(sceneState.cellId ?? definition.sceneConfig.payload.cells[0].id),
      outputId: String(sceneState.outputId ?? definition.sceneConfig.payload.outputs[0].id),
    };
  }

  if (definition.sceneConfig.family === "light_optics") {
    return {
      angleId: String(sceneState.angleId ?? definition.sceneConfig.payload.mirrorAngles[0].id),
      targetId: String(sceneState.targetId ?? definition.sceneConfig.payload.targets[0].id),
    };
  }

  return {
    materialId: String(sceneState.materialId ?? definition.sceneConfig.payload.materials[0].id),
  };
}

function SelectField({
  disabled,
  helperText,
  icon,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  helperText?: string;
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/84 px-4 disabled:cursor-not-allowed disabled:bg-[rgba(230,235,239,0.9)] disabled:text-muted"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <span className="text-xs text-muted">{helperText}</span> : null}
    </label>
  );
}

function isSameSelection(left: SelectionState, right: SelectionState) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function getFieldConstraints(
  definition: InvestigationDefinition,
  stepResponses: InvestigationSession["stepResponses"],
  currentSelection: SelectionState,
) {
  if (definition.sceneConfig.family !== "particles_mixtures") {
    return {};
  }

  const selectedQuestion = String(stepResponses.question?.value ?? "");
  const planValues = Array.isArray(stepResponses.plan?.value)
    ? stepResponses.plan.value.map(String)
    : [];
  const defaultTemperatureId =
    definition.sceneConfig.payload.temperatures[1]?.id ??
    definition.sceneConfig.payload.temperatures[0].id;
  const defaultStirId =
    definition.sceneConfig.payload.stirringLevels[1]?.id ??
    definition.sceneConfig.payload.stirringLevels[0].id;
  const defaultSubstanceId = definition.sceneConfig.payload.substances[0].id;

  return {
    substanceId: planValues.includes("same-substance")
      ? {
          disabled: true,
          forcedValue: currentSelection.substanceId ?? defaultSubstanceId,
          reason: "Locked because your plan keeps the substance the same.",
        }
      : undefined,
    temperatureId:
      selectedQuestion === "stirring"
        ? {
            disabled: true,
            forcedValue: defaultTemperatureId,
            reason: "Held steady while you investigate stirring.",
          }
        : undefined,
    stirId:
      selectedQuestion === "temperature"
        ? {
            disabled: true,
            forcedValue: defaultStirId,
            reason: "Held steady while you investigate temperature.",
          }
        : undefined,
  };
}

function applyFieldConstraints(
  selection: SelectionState,
  fieldConstraints: Record<string, { disabled: boolean; forcedValue?: string } | undefined>,
) {
  const nextSelection = { ...selection };

  for (const [key, constraint] of Object.entries(fieldConstraints)) {
    if (constraint?.disabled && constraint.forcedValue) {
      nextSelection[key] = constraint.forcedValue;
    }
  }

  return nextSelection;
}
