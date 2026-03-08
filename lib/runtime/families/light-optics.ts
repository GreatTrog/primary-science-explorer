import { Color3, Mesh, MeshBuilder, Vector3 } from "@babylonjs/core";

import type { RuntimeState } from "@/lib/domain/types";
import {
  createBaseScene,
  createEmissiveMaterial,
  createSolidMaterial,
  tween,
} from "@/lib/runtime/babylon-helpers";
import type { SceneFactory } from "@/lib/runtime/types";

type Payload = {
  mirrorAngles: Array<{
    id: string;
    label: string;
    degrees: number;
  }>;
  targets: Array<{
    id: string;
    label: string;
    color: string;
  }>;
};

type Point2 = {
  x: number;
  y: number;
};

type TraceResult = {
  visible: boolean;
  incomingPath: Vector3[];
  downPath: Vector3[] | null;
  outgoingPath: Vector3[] | null;
  missPath: Vector3[] | null;
};

const Z_PANEL = 0;
const Z_BODY = 0.08;
const Z_MIRROR = 0.16;
const Z_BEAM = 0.22;

const PANEL_CENTER = new Vector3(0, 2.75, Z_PANEL);
const TOP_OPENING_Y = 4.1;
const BOTTOM_OPENING_Y = 1.6;
const SHAFT_X = -0.55;
const LEFT_SOURCE_X = -3.15;
const RIGHT_EYE_X = 2.9;
const TOP_MIRROR_CENTER: Point2 = { x: SHAFT_X, y: TOP_OPENING_Y };
const BOTTOM_MIRROR_CENTER: Point2 = { x: SHAFT_X, y: BOTTOM_OPENING_Y };
const SOURCE_POINT: Point2 = { x: LEFT_SOURCE_X, y: TOP_OPENING_Y };
const EYE_POINT: Point2 = { x: RIGHT_EYE_X, y: BOTTOM_OPENING_Y };
const MIRROR_HALF_LENGTH = 0.34;
const BOUNDS = {
  minX: -4.3,
  maxX: 4.3,
  minY: 0.35,
  maxY: 5.2,
};

export const createLightOpticsScene: SceneFactory<Payload> = ({
  canvas,
  definition,
  payload,
  initialState,
}) => {
  const { engine, scene, camera } = createBaseScene(canvas, {
    cameraPreset: definition.cameraPreset,
    lightingPreset: definition.lightingPreset,
    clearColor: "#f6fbff",
  });

  camera.setTarget(new Vector3(0, 2.75, 0));
  camera.setPosition(new Vector3(0, 2.75, -9));
  camera.lowerRadiusLimit = 9;
  camera.upperRadiusLimit = 9;
  camera.wheelDeltaPercentage = 0;

  const panelMaterial = createSolidMaterial(scene, "#f5f5f5", 0.98);
  const bodyMaterial = createSolidMaterial(scene, "#111111", 0.92);
  const channelMaterial = createSolidMaterial(scene, "#ffffff", 0.98);
  const mirrorMaterial = createSolidMaterial(scene, "#9a9a9a", 0.2);
  const beamMaterial = createEmissiveMaterial(scene, "#f1c40f");
  const missMaterial = createEmissiveMaterial(scene, "#ff9f6e");
  const eyeGlowMaterial = createEmissiveMaterial(scene, "#1f1f1f");

  const panel = MeshBuilder.CreateBox(
    "optics-panel",
    { width: 8.9, height: 5.7, depth: 0.06 },
    scene,
  );
  panel.position = PANEL_CENTER;
  panel.material = panelMaterial;

  buildChannelSegment(
    scene,
    "top",
    new Vector3(-1.85, TOP_OPENING_Y, Z_BODY),
    { width: 3.65, height: 0.95 },
    bodyMaterial,
    channelMaterial,
  );
  buildChannelSegment(
    scene,
    "shaft",
    new Vector3(SHAFT_X, 2.85, Z_BODY),
    { width: 0.95, height: 3.45 },
    bodyMaterial,
    channelMaterial,
  );
  buildChannelSegment(
    scene,
    "bottom",
    new Vector3(0.55, BOTTOM_OPENING_Y, Z_BODY),
    { width: 3.1, height: 0.95 },
    bodyMaterial,
    channelMaterial,
  );

  const topMirror = MeshBuilder.CreateBox(
    "top-mirror",
    { width: MIRROR_HALF_LENGTH * 2, height: 0.09, depth: 0.1 },
    scene,
  );
  topMirror.position = new Vector3(TOP_MIRROR_CENTER.x, TOP_MIRROR_CENTER.y, Z_MIRROR);
  topMirror.material = mirrorMaterial;

  const bottomMirror = MeshBuilder.CreateBox(
    "bottom-mirror",
    { width: MIRROR_HALF_LENGTH * 2, height: 0.09, depth: 0.1 },
    scene,
  );
  bottomMirror.position = new Vector3(BOTTOM_MIRROR_CENTER.x, BOTTOM_MIRROR_CENTER.y, Z_MIRROR);
  bottomMirror.material = mirrorMaterial;

  const targetPole = MeshBuilder.CreateBox(
    "target-pole",
    { width: 0.06, height: 0.95, depth: 0.08 },
    scene,
  );
  targetPole.position = new Vector3(LEFT_SOURCE_X - 0.22, TOP_OPENING_Y - 0.55, Z_BODY);
  targetPole.material = createSolidMaterial(scene, "#6f553d", 0.82);

  const targetFlag = MeshBuilder.CreateBox(
    "target-flag",
    { width: 0.72, height: 0.42, depth: 0.08 },
    scene,
  );
  targetFlag.position = new Vector3(LEFT_SOURCE_X, TOP_OPENING_Y, Z_BODY);

  const eyeRing = MeshBuilder.CreateTorus(
    "eye-ring",
    { diameter: 1.02, thickness: 0.08, tessellation: 48 },
    scene,
  );
  eyeRing.position = new Vector3(EYE_POINT.x, EYE_POINT.y, Z_BODY);
  eyeRing.material = createSolidMaterial(scene, "#111111", 0.45);

  const eyePupil = MeshBuilder.CreateSphere("eye-pupil", { diameter: 0.24 }, scene);
  eyePupil.position = new Vector3(EYE_POINT.x - 0.42, EYE_POINT.y, Z_MIRROR);
  eyePupil.material = eyeGlowMaterial;

  let beamIn: Mesh | null = null;
  let beamDown: Mesh | null = null;
  let beamOut: Mesh | null = null;
  let beamMiss: Mesh | null = null;

  let selectedAngle = payload.mirrorAngles[0];
  let selectedTarget = payload.targets[0];
  let currentTrace: TraceResult | null = null;
  let lastVisible = false;

  function rebuildTrace() {
    currentTrace = calculateTrace(selectedAngle.degrees);
    beamIn = rebuildBeam(scene, "beam-in", beamIn, currentTrace.incomingPath, beamMaterial);
    beamDown = currentTrace.downPath
      ? rebuildBeam(scene, "beam-down", beamDown, currentTrace.downPath, currentTrace.visible ? beamMaterial : missMaterial)
      : disposeBeam(beamDown);
    beamOut = currentTrace.outgoingPath
      ? rebuildBeam(scene, "beam-out", beamOut, currentTrace.outgoingPath, beamMaterial)
      : disposeBeam(beamOut);
    beamMiss = currentTrace.missPath
      ? rebuildBeam(scene, "beam-miss", beamMiss, currentTrace.missPath, missMaterial)
      : disposeBeam(beamMiss);
  }

  function applySelection() {
    targetFlag.material = createSolidMaterial(scene, selectedTarget.color, 0.34);
    topMirror.rotation.z = (-selectedAngle.degrees * Math.PI) / 180;
    bottomMirror.rotation.z = (-selectedAngle.degrees * Math.PI) / 180;
    eyeGlowMaterial.emissiveColor = Color3.FromHexString("#1f1f1f");
    rebuildTrace();
  }

  function restoreSelection(state: RuntimeState, force = false) {
    let changed = force;
    if (typeof state.sceneState.angleId === "string") {
      const nextAngle =
        payload.mirrorAngles.find((angle) => angle.id === state.sceneState.angleId) ?? selectedAngle;
      if (nextAngle.id !== selectedAngle.id) {
        selectedAngle = nextAngle;
        changed = true;
      }
    }
    if (typeof state.sceneState.targetId === "string") {
      const nextTarget =
        payload.targets.find((entry) => entry.id === state.sceneState.targetId) ?? selectedTarget;
      if (nextTarget.id !== selectedTarget.id) {
        selectedTarget = nextTarget;
        changed = true;
      }
    }
    if (changed) {
      applySelection();
    }
  }

  restoreSelection(initialState, true);

  return {
    engine,
    scene,
    updateSelection(selection) {
      let changed = false;
      if (typeof selection.angleId === "string") {
        const nextAngle =
          payload.mirrorAngles.find((angle) => angle.id === selection.angleId) ?? selectedAngle;
        if (nextAngle.id !== selectedAngle.id) {
          selectedAngle = nextAngle;
          changed = true;
        }
      }
      if (typeof selection.targetId === "string") {
        const nextTarget =
          payload.targets.find((entry) => entry.id === selection.targetId) ?? selectedTarget;
        if (nextTarget.id !== selectedTarget.id) {
          selectedTarget = nextTarget;
          changed = true;
        }
      }
      if (changed) {
        applySelection();
      }
    },
    restoreSceneState(state) {
      restoreSelection(state);
    },
    async runAction() {
      if (!currentTrace || !beamIn) {
        return null;
      }

      const visible = currentTrace.visible;
      const eyeOn = Color3.FromHexString("#9af5a5");
      const eyeOff = Color3.FromHexString("#1f1f1f");

      [beamIn, beamDown, beamOut, beamMiss].forEach((beam) => {
        if (beam) {
          beam.isVisible = false;
        }
      });

      await tween(1200, (progress) => {
        beamIn!.isVisible = progress > 0.05;
        if (beamDown) {
          beamDown.isVisible = progress > 0.32;
        }
        if (visible && beamOut) {
          beamOut.isVisible = progress > 0.62;
          eyeGlowMaterial.emissiveColor = Color3.Lerp(
            eyeOff,
            eyeOn,
            Math.max(0, Math.min((progress - 0.62) * 2.2, 1)),
          );
        } else if (!visible && beamMiss) {
          beamMiss.isVisible = progress > 0.62;
          eyeGlowMaterial.emissiveColor = eyeOff;
        }
      });

      eyeGlowMaterial.emissiveColor = visible ? eyeOn : eyeOff;
      lastVisible = visible;

      return {
        label: `${selectedAngle.label} / ${selectedTarget.label}`,
        variables: {
          MirrorAngle: selectedAngle.label,
          Target: selectedTarget.label,
        },
        observedValues: {
          targetVisible: visible,
          mirrorAngleDegrees: selectedAngle.degrees,
        },
        runtimeSnapshot: {
          angleId: selectedAngle.id,
          targetId: selectedTarget.id,
          visible,
          cameraRadius: camera.radius,
        },
      };
    },
    snapshotSceneState() {
      return {
        sceneState: {
          angleId: selectedAngle.id,
          targetId: selectedTarget.id,
          lastVisible,
        },
        interactionState: {},
        effectState: {},
        cameraState: {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
        },
      };
    },
    getStepReadiness() {
      return {
        ready: Boolean(selectedAngle && selectedTarget),
        reason: "Choose a mirror angle and trace whether the beam reaches the eyepiece.",
      };
    },
    disposeScene() {
      scene.dispose();
      engine.dispose();
    },
  };
};

function buildChannelSegment(
  scene: import("@babylonjs/core").Scene,
  name: string,
  center: Vector3,
  size: { width: number; height: number },
  bodyMaterial: Mesh["material"],
  channelMaterial: Mesh["material"],
) {
  const outer = MeshBuilder.CreateBox(
    `${name}-outer`,
    { width: size.width, height: size.height, depth: 0.12 },
    scene,
  );
  outer.position.copyFrom(center);
  outer.material = bodyMaterial;

  const inner = MeshBuilder.CreateBox(
    `${name}-inner`,
    { width: Math.max(0.2, size.width - 0.26), height: Math.max(0.2, size.height - 0.26), depth: 0.08 },
    scene,
  );
  inner.position.copyFrom(center);
  inner.position.z = Z_BODY + 0.01;
  inner.material = channelMaterial;
}

function rebuildBeam(
  scene: import("@babylonjs/core").Scene,
  name: string,
  current: Mesh | null,
  path: Vector3[],
  material: Mesh["material"],
) {
  current?.dispose();
  const beam = MeshBuilder.CreateTube(
    name,
    {
      path: path.map((point) => point.clone()),
      radius: 0.04,
    },
    scene,
  );
  beam.material = material;
  beam.isVisible = false;
  return beam;
}

function disposeBeam(current: Mesh | null) {
  current?.dispose();
  return null;
}

function calculateTrace(angleDegrees: number): TraceResult {
  const topMirrorAngle = (-angleDegrees * Math.PI) / 180;
  const bottomMirrorAngle = (-angleDegrees * Math.PI) / 180;
  const incomingDirection = { x: 1, y: 0 };

  const topReflection = reflectAcrossMirror(incomingDirection, topMirrorAngle);
  const bottomHit = intersectRayWithMirror(
    TOP_MIRROR_CENTER,
    topReflection,
    BOTTOM_MIRROR_CENTER,
    bottomMirrorAngle,
    MIRROR_HALF_LENGTH,
  );

  if (!bottomHit) {
    return {
      visible: false,
      incomingPath: vectorPath(SOURCE_POINT, TOP_MIRROR_CENTER),
      downPath: null,
      outgoingPath: null,
      missPath: vectorPath(TOP_MIRROR_CENTER, rayToBounds(TOP_MIRROR_CENTER, topReflection)),
    };
  }

  const bottomReflection = reflectAcrossMirror(topReflection, bottomMirrorAngle);
  const eyeIntersection = intersectWithVerticalLine(bottomHit, bottomReflection, EYE_POINT.x);
  const reachesEye =
    eyeIntersection &&
    eyeIntersection.t > 0 &&
    Math.abs(eyeIntersection.y - EYE_POINT.y) <= 0.16;

  return {
    visible: Boolean(reachesEye),
    incomingPath: vectorPath(SOURCE_POINT, TOP_MIRROR_CENTER),
    downPath: vectorPath(TOP_MIRROR_CENTER, bottomHit),
    outgoingPath: reachesEye ? vectorPath(bottomHit, EYE_POINT) : null,
    missPath: reachesEye ? null : vectorPath(bottomHit, rayToBounds(bottomHit, bottomReflection)),
  };
}

function reflectAcrossMirror(direction: Point2, angleRadians: number) {
  const mirrorDirection = {
    x: Math.cos(angleRadians),
    y: Math.sin(angleRadians),
  };
  const dot = direction.x * mirrorDirection.x + direction.y * mirrorDirection.y;
  return normalize({
    x: 2 * dot * mirrorDirection.x - direction.x,
    y: 2 * dot * mirrorDirection.y - direction.y,
  });
}

function intersectRayWithMirror(
  origin: Point2,
  direction: Point2,
  center: Point2,
  angleRadians: number,
  halfLength: number,
) {
  const segmentDirection = {
    x: Math.cos(angleRadians),
    y: Math.sin(angleRadians),
  };
  const diff = subtract(center, origin);
  const denominator = cross(direction, segmentDirection);

  if (Math.abs(denominator) < 0.0001) {
    return null;
  }

  const rayDistance = cross(diff, segmentDirection) / denominator;
  const segmentOffset = cross(diff, direction) / denominator;

  if (rayDistance <= 0 || Math.abs(segmentOffset) > halfLength) {
    return null;
  }

  return add(origin, scale(direction, rayDistance));
}

function intersectWithVerticalLine(origin: Point2, direction: Point2, x: number) {
  if (Math.abs(direction.x) < 0.0001) {
    return null;
  }

  const t = (x - origin.x) / direction.x;
  if (t <= 0) {
    return null;
  }

  return {
    t,
    y: origin.y + direction.y * t,
  };
}

function rayToBounds(origin: Point2, direction: Point2) {
  const intersections: Point2[] = [];

  if (Math.abs(direction.x) > 0.0001) {
    const leftT = (BOUNDS.minX - origin.x) / direction.x;
    const rightT = (BOUNDS.maxX - origin.x) / direction.x;
    if (leftT > 0) {
      intersections.push({ x: BOUNDS.minX, y: origin.y + direction.y * leftT });
    }
    if (rightT > 0) {
      intersections.push({ x: BOUNDS.maxX, y: origin.y + direction.y * rightT });
    }
  }

  if (Math.abs(direction.y) > 0.0001) {
    const bottomT = (BOUNDS.minY - origin.y) / direction.y;
    const topT = (BOUNDS.maxY - origin.y) / direction.y;
    if (bottomT > 0) {
      intersections.push({ x: origin.x + direction.x * bottomT, y: BOUNDS.minY });
    }
    if (topT > 0) {
      intersections.push({ x: origin.x + direction.x * topT, y: BOUNDS.maxY });
    }
  }

  const valid = intersections.filter(
    (point) =>
      point.x >= BOUNDS.minX - 0.01 &&
      point.x <= BOUNDS.maxX + 0.01 &&
      point.y >= BOUNDS.minY - 0.01 &&
      point.y <= BOUNDS.maxY + 0.01,
  );

  valid.sort((left, right) => distanceSquared(origin, left) - distanceSquared(origin, right));
  return valid[0] ?? add(origin, scale(direction, 1.5));
}

function vectorPath(start: Point2, end: Point2) {
  return [toVector(start), toVector(end)];
}

function toVector(point: Point2) {
  return new Vector3(point.x, point.y, Z_BEAM);
}

function add(left: Point2, right: Point2) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
  };
}

function subtract(left: Point2, right: Point2) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
  };
}

function scale(point: Point2, amount: number) {
  return {
    x: point.x * amount,
    y: point.y * amount,
  };
}

function normalize(point: Point2) {
  const length = Math.hypot(point.x, point.y) || 1;
  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function cross(left: Point2, right: Point2) {
  return left.x * right.y - left.y * right.x;
}

function distanceSquared(left: Point2, right: Point2) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}
