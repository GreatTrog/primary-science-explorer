"use client";

import { Compass } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { InvestigationDefinition, InvestigationSession } from "@/lib/domain/types";

type SelectionState = {
  angleId: string;
  targetId: string;
};

type TraceState = {
  visible: boolean;
  incomingPaths: string[];
  middlePaths: string[];
  outgoingPaths: string[];
  missPaths: string[];
};

type Point = {
  x: number;
  y: number;
};

type LightOpticsPayload = Extract<
  InvestigationDefinition["sceneConfig"],
  { family: "light_optics" }
>["payload"];

const DIAGRAM = {
  bodyPath: "M 170 50 H 430 V 315 H 585 V 385 H 335 V 120 H 170 Z",
  sourceX: 42,
  sourceY: 80,
  sourceWidth: 52,
  sourceHeight: 52,
  topMirrorCenter: { x: 395, y: 87 },
  bottomMirrorCenter: { x: 369, y: 340 },
  mirrorHalf: 38,
  shaftLeftWallX: 335,
  shaftRightWallX: 430,
  topSegmentRightWallX: 430,
  topSegmentBottomY: 120,
  eye: { x: 694, y: 340 },
  barrier: { x: 190, y: 126, width: 92, height: 258 },
};

export function PeriscopeDiagram({
  definition,
  runtimeState,
  onRuntimeStateChange,
  onRunTrial,
  mode,
}: {
  definition: InvestigationDefinition;
  runtimeState: InvestigationSession["runtimeState"];
  onRuntimeStateChange: (runtimeState: Partial<InvestigationSession["runtimeState"]>) => void;
  onRunTrial: (payload: {
    label: string;
    variables: Record<string, string | number | boolean>;
    observedValues: Record<string, string | number | boolean>;
    runtimeSnapshot: Record<string, unknown>;
  }) => Promise<void>;
  mode: InvestigationSession["mode"];
}) {
  const { mirrorAngles, targets } = definition.sceneConfig.payload as LightOpticsPayload;
  const [selection, setSelection] = useState<SelectionState>(() =>
    deriveSelection(runtimeState, mirrorAngles[0].id, targets[0].id),
  );
  const [traceStage, setTraceStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const selectionRef = useRef(selection);
  const lastEmittedRef = useRef(selection);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    const nextSelection = deriveSelection(runtimeState, mirrorAngles[0].id, targets[0].id);
    if (!isSameSelection(nextSelection, lastEmittedRef.current) && !isSameSelection(nextSelection, selectionRef.current)) {
      queueMicrotask(() => {
        setSelection(nextSelection);
        setTraceStage(0);
      });
    }
  }, [mirrorAngles, runtimeState, targets]);

  useEffect(() => {
    if (!isSameSelection(selection, lastEmittedRef.current)) {
      lastEmittedRef.current = selection;
      queueMicrotask(() => {
        setTraceStage(0);
      });
      onRuntimeStateChange({
        sceneState: {
          ...selection,
        },
      });
    }
  }, [onRuntimeStateChange, selection]);

  const selectedAngle = mirrorAngles.find((entry) => entry.id === selection.angleId) ?? mirrorAngles[0];
  const selectedTarget = targets.find((entry) => entry.id === selection.targetId) ?? targets[0];
  const trace = getTraceForAngle(selectedAngle.degrees);
  const topMirror = mirrorLine(
    DIAGRAM.topMirrorCenter.x,
    DIAGRAM.topMirrorCenter.y,
    selectedAngle.degrees,
    DIAGRAM.mirrorHalf,
  );
  const bottomMirror = mirrorLine(
    DIAGRAM.bottomMirrorCenter.x,
    DIAGRAM.bottomMirrorCenter.y,
    selectedAngle.degrees,
    DIAGRAM.mirrorHalf,
  );

  async function runScene() {
    setBusy(true);
    setTraceStage(1);
    await delay(220);
    if (trace.middlePaths.length > 0) {
      setTraceStage(2);
      await delay(220);
    }
    setTraceStage(3);
    setBusy(false);

    onRuntimeStateChange({
      sceneState: {
        ...selection,
        visible: trace.visible,
      },
    });

    await onRunTrial({
      label: `${selectedAngle.label} / ${selectedTarget.label}`,
      variables: {
        MirrorAngle: selectedAngle.label,
        Target: selectedTarget.label,
      },
      observedValues: {
        targetVisible: trace.visible,
        mirrorAngleDegrees: selectedAngle.degrees,
      },
      runtimeSnapshot: {
        angleId: selectedAngle.id,
        targetId: selectedTarget.id,
        visible: trace.visible,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-white/82 p-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <SvgSelectField
          label="Mirror angle"
          value={selection.angleId}
          options={mirrorAngles.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(value) => setSelection((current) => ({ ...current, angleId: value }))}
        />
        <SvgSelectField
          label="Target"
          value={selection.targetId}
          options={targets.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(value) => setSelection((current) => ({ ...current, targetId: value }))}
        />
        <button
          type="button"
          onClick={runScene}
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-pond)] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Tracing beam..." : mode === "teacher-preview" ? "Demo scene" : "Run experiment"}
        </button>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(236,242,247,0.9))] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <p className="display-font text-2xl">Periscope cut-through</p>
            <p className="text-sm text-muted">Choose a mirror angle and trace whether the beam reaches the eye.</p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Interactive SVG diagram</p>
        </div>
        <div className="overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[#eef2f4]">
          <svg viewBox="0 0 800 420" className="block h-[420px] w-full" aria-label={definition.title}>
            <rect x="0" y="0" width="800" height="420" fill="#efefef" />

            <defs>
              <pattern id="brickPattern" width="28" height="18" patternUnits="userSpaceOnUse">
                <rect width="28" height="18" fill="#ecd7cf" />
                <rect x="0" y="2" width="18" height="6" fill="#c76433" />
                <rect x="14" y="10" width="14" height="6" fill="#c76433" />
              </pattern>
            </defs>

            <path d={DIAGRAM.bodyPath} fill="#f1efb3" stroke="#6e6e6e" strokeWidth="5" strokeLinejoin="miter" />
            <rect
              x={DIAGRAM.barrier.x}
              y={DIAGRAM.barrier.y}
              width={DIAGRAM.barrier.width}
              height={DIAGRAM.barrier.height}
              fill="url(#brickPattern)"
              stroke="#a7522a"
              strokeWidth="2"
            />

            <line x1={topMirror.x1} y1={topMirror.y1} x2={topMirror.x2} y2={topMirror.y2} stroke="#8b8b8b" strokeWidth="8" strokeLinecap="round" />
            <line x1={bottomMirror.x1} y1={bottomMirror.y1} x2={bottomMirror.x2} y2={bottomMirror.y2} stroke="#8b8b8b" strokeWidth="8" strokeLinecap="round" />

            <line
              x1={DIAGRAM.sourceX + 4}
              y1={DIAGRAM.sourceY}
              x2={DIAGRAM.sourceX + 40}
              y2={DIAGRAM.sourceY}
              stroke={selectedTarget.color}
              strokeWidth="8"
              strokeLinecap="round"
            />
            {renderTargetMarker(selectedTarget)}

            <circle cx={DIAGRAM.eye.x} cy={DIAGRAM.eye.y} r="42" fill="#ffffff" stroke="#111111" strokeWidth="6" />
            <circle
              cx={DIAGRAM.eye.x - 40}
              cy={DIAGRAM.eye.y}
              r="14"
              fill={trace.visible && traceStage >= 3 ? "#111111" : "#2b3b45"}
            />

            {traceStage >= 1
              ? trace.incomingPaths.map((path, index) => (
                  <path
                    key={`in-${index}`}
                    d={path}
                    fill="none"
                    stroke="#d56a36"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    markerEnd="url(#rayArrow)"
                  />
                ))
              : null}
            {traceStage >= 2
              ? trace.middlePaths.map((path, index) => (
                  <path
                    key={`mid-${index}`}
                    d={path}
                    fill="none"
                    stroke={trace.visible ? "#d56a36" : "#d56a36"}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    markerEnd="url(#rayArrow)"
                  />
                ))
              : null}
            {traceStage >= 3
              ? trace.outgoingPaths.map((path, index) => (
                  <path
                    key={`out-${index}`}
                    d={path}
                    fill="none"
                    stroke="#d56a36"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    markerEnd="url(#rayArrow)"
                  />
                ))
              : null}
            {traceStage >= 3
              ? trace.missPaths.map((path, index) => (
                  <path
                    key={`miss-${index}`}
                    d={path}
                    fill="none"
                    stroke="#d56a36"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    markerEnd="url(#rayArrow)"
                  />
                ))
              : null}

            <defs>
              <marker id="rayArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#d56a36" />
              </marker>
            </defs>

            <text x={DIAGRAM.barrier.x} y="410" fontSize="16" fill="#5b5b5b" textAnchor="start">BARRIER</text>
            <text x={topMirror.x2 + 26} y={topMirror.y1 - 6} fontSize="14" fill="#5b5b5b">MIRROR</text>
            <text x={bottomMirror.x1 - 18} y="410" fontSize="14" fill="#5b5b5b">MIRROR</text>
            <text x={DIAGRAM.eye.x - 12} y="410" fontSize="16" fill="#5b5b5b" textAnchor="middle">EYE</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

function SvgSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Compass className="h-4 w-4" />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/84 px-4"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function deriveSelection(
  runtimeState: InvestigationSession["runtimeState"],
  defaultAngleId: string,
  defaultTargetId: string,
): SelectionState {
  return {
    angleId: String(runtimeState.sceneState.angleId ?? defaultAngleId),
    targetId: String(runtimeState.sceneState.targetId ?? defaultTargetId),
  };
}

function getTraceForAngle(angleDegrees: number): TraceState {
  const rayOffsets = [-24, -12, 0, 12, 24];
  const topMirror = DIAGRAM.topMirrorCenter;
  const bottomMirror = DIAGRAM.bottomMirrorCenter;
  const eyeX = DIAGRAM.eye.x - 44;

  const incomingPaths: string[] = [];
  const middlePaths: string[] = [];
  const outgoingPaths: string[] = [];
  const missPaths: string[] = [];

  if (angleDegrees === 45) {
    const alignedRayXs = [370, 376, 382, 388, 394];

    for (const hitX of alignedRayXs) {
      const hitTop = {
        x: hitX,
        y: topMirror.y + (hitX - topMirror.x),
      };
      const hitBottom = {
        x: hitX,
        y: bottomMirror.y + (hitX - bottomMirror.x),
      };
      const source = { x: DIAGRAM.sourceX, y: hitTop.y };
      incomingPaths.push(linePath(source, hitTop));
      middlePaths.push(linePath(hitTop, hitBottom));
      outgoingPaths.push(linePath(hitBottom, { x: eyeX, y: hitBottom.y }));
    }

    return {
      visible: true,
      incomingPaths,
      middlePaths,
      outgoingPaths,
      missPaths,
    };
  }

  for (const offset of rayOffsets) {
    const hitTop = pointOnMirror(topMirror, angleDegrees, offset);
    const source = { x: DIAGRAM.sourceX, y: hitTop.y };
    incomingPaths.push(linePath(source, hitTop));

    const reflection = reflectDirection({ x: 1, y: 0 }, angleDegrees);
    const missEnd =
      angleDegrees < 45
        ? intersectVertical(hitTop, reflection, DIAGRAM.topSegmentRightWallX)
        : intersectVertical(hitTop, reflection, DIAGRAM.shaftLeftWallX);
    missPaths.push(linePath(hitTop, missEnd ?? rayFallback(hitTop, reflection)));
  }

  return {
    visible: angleDegrees === 45,
    incomingPaths,
    middlePaths,
    outgoingPaths,
    missPaths,
  };
}

function renderTargetMarker(target: LightOpticsPayload["targets"][number]) {
  const markerX = DIAGRAM.sourceX + 40;
  const markerY = DIAGRAM.sourceY;
  const isBuoy = /buoy/i.test(target.id) || /buoy/i.test(target.label);

  if (isBuoy) {
    const radius = DIAGRAM.sourceHeight / 2;
    return (
      <circle
        cx={markerX + radius}
        cy={markerY}
        r={radius}
        fill={target.color}
        stroke="#111111"
        strokeWidth="3"
      />
    );
  }

  return (
    <rect
      x={markerX}
      y={markerY - DIAGRAM.sourceHeight / 2}
      width={DIAGRAM.sourceWidth}
      height={DIAGRAM.sourceHeight}
      rx="4"
      fill={target.color}
      stroke="#111111"
      strokeWidth="3"
    />
  );
}

function mirrorLine(cx: number, cy: number, degrees: number, half: number) {
  const radians = (degrees * Math.PI) / 180;
  const dx = Math.cos(radians) * half;
  const dy = Math.sin(radians) * half;
  return {
    x1: cx - dx,
    y1: cy - dy,
    x2: cx + dx,
    y2: cy + dy,
  };
}

function linePath(start: Point, end: Point) {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function pointOnMirror(center: Point, degrees: number, offset: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * offset,
    y: center.y + Math.sin(radians) * offset,
  };
}

function reflectDirection(direction: Point, mirrorDegrees: number) {
  const radians = (mirrorDegrees * Math.PI) / 180;
  const tangent = {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
  const dot = direction.x * tangent.x + direction.y * tangent.y;
  return normalizePoint({
    x: 2 * dot * tangent.x - direction.x,
    y: 2 * dot * tangent.y - direction.y,
  });
}

function intersectVertical(origin: Point, direction: Point, x: number) {
  if (Math.abs(direction.x) < 0.0001) {
    return null;
  }

  const t = (x - origin.x) / direction.x;
  if (t <= 0) {
    return null;
  }

  return {
    x,
    y: origin.y + direction.y * t,
  };
}

function rayFallback(origin: Point, direction: Point) {
  return {
    x: origin.x + direction.x * 80,
    y: origin.y + direction.y * 80,
  };
}

function normalizePoint(point: Point) {
  const length = Math.hypot(point.x, point.y) || 1;
  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function isSameSelection(left: SelectionState, right: SelectionState) {
  return left.angleId === right.angleId && left.targetId === right.targetId;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
