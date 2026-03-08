import { Mesh, MeshBuilder, Quaternion, Scene, TransformNode, Vector3 } from "@babylonjs/core";

import {
  createBaseScene,
  createGround,
  createSolidMaterial,
  tween,
} from "@/lib/runtime/babylon-helpers";
import type { SceneFactory } from "@/lib/runtime/types";

type Payload = {
  towerHeightMeters: number;
  parachutes: Array<{
    id: string;
    label: string;
    canopyRadius: number;
    dropTimeSeconds: number;
    color: string;
  }>;
};

export const createForcesMotionScene: SceneFactory<Payload> = ({
  canvas,
  definition,
  payload,
  initialState,
}) => {
  const { engine, scene, camera } = createBaseScene(canvas, {
    cameraPreset: definition.cameraPreset,
    lightingPreset: definition.lightingPreset,
    clearColor: "#dfeeff",
  });

  createGround(scene, "#a7d4a4", 34, 34);

  const tower = MeshBuilder.CreateBox("tower", { width: 2, depth: 2, height: 12 }, scene);
  tower.position = new Vector3(-4.5, 6, 0);
  tower.material = createSolidMaterial(scene, "#d9cbb4");

  const rig = new TransformNode("parachute-rig", scene);
  const payloadStartY = -1.45;
  const launchMarkerY = 12.05;
  const launchPosition = new Vector3(-0.55, launchMarkerY - payloadStartY, 0);
  rig.position.copyFrom(launchPosition);

  const canopy = MeshBuilder.CreateSphere(
    "canopy",
    { diameter: 2.8, segments: 24, slice: 0.5 },
    scene,
  );
  canopy.position = Vector3.Zero();
  canopy.parent = rig;

  const payloadMesh = MeshBuilder.CreateSphere("payload", { diameter: 0.5 }, scene);
  payloadMesh.parent = rig;
  payloadMesh.material = createSolidMaterial(scene, "#3a4f62");

  const strings = createStrings(1.4, payloadStartY, rig, scene);
  canopy.material = createSolidMaterial(scene, payload.parachutes[0].color, 0.45);

  let selected = payload.parachutes[0];
  let currentPayloadY = payloadStartY;
  let lastTime = 0;

  function resetRigPosition() {
    rig.position.copyFrom(launchPosition);
    canopy.position.y = 0;
    canopy.rotation.z = 0;
    payloadMesh.rotation.z = 0;
    payloadMesh.rotationQuaternion = null;
    canopy.scaling.x = selected.canopyRadius / 1.4;
    canopy.scaling.y = 0.48 * (selected.canopyRadius / 1.4);
    canopy.scaling.z = selected.canopyRadius / 1.4;
    strings.forEach((line) => {
      line.visibility = 1;
    });
  }

  function applySelection(id: string, force = false) {
    const nextSelection = payload.parachutes.find((item) => item.id === id) ?? payload.parachutes[0];
    const payloadY = payloadStartY;

    if (!force && nextSelection.id === selected.id && Math.abs(payloadY - currentPayloadY) < 0.001) {
      return;
    }

    selected = nextSelection;
    currentPayloadY = payloadY;
    canopy.material = createSolidMaterial(scene, selected.color, 0.4);
    payloadMesh.position = new Vector3(0, payloadY, 0);
    updateStrings(strings, selected.canopyRadius, payloadY);
    resetRigPosition();
  }

  applySelection(String(initialState.sceneState.parachuteId ?? selected.id), true);

  return {
    engine,
    scene,
    updateSelection(selection) {
      if (typeof selection.parachuteId === "string") {
        applySelection(selection.parachuteId);
      }
    },
    restoreSceneState(state) {
      if (typeof state.sceneState.parachuteId === "string") {
        applySelection(state.sceneState.parachuteId);
      }
    },
    async runAction() {
      resetRigPosition();
      const groundContactY = 0.25;
      const dropDistance = launchPosition.y - (groundContactY - payloadMesh.position.y);
      const visualDuration = selected.dropTimeSeconds * 700;

      await tween(visualDuration, (progress) => {
        rig.position.y = launchPosition.y - progress * dropDistance;
        rig.position.x = launchPosition.x + Math.sin(progress * Math.PI * 2) * 0.32;
        canopy.rotation.z = Math.sin(progress * Math.PI * 10) * 0.08;
        payloadMesh.rotation.z = Math.sin(progress * Math.PI * 7) * 0.18;
      });

      await tween(420, (progress) => {
        canopy.position.y = progress * (payloadMesh.position.y + 0.26);
        canopy.scaling.x = (selected.canopyRadius / 1.4) * (1 + progress * 0.18);
        canopy.scaling.y = 0.48 * (selected.canopyRadius / 1.4) * (1 - progress * 0.42);
        canopy.scaling.z = (selected.canopyRadius / 1.4) * (1 + progress * 0.08);
        canopy.rotation.z = 0.24 * progress;
        strings.forEach((line) => {
          line.visibility = Math.max(0, 1 - progress * 2.4);
        });
      });

      strings.forEach((line) => {
        line.visibility = 0;
      });
      lastTime = selected.dropTimeSeconds;

      return {
        label: selected.label,
        variables: {
          Canopy: selected.label,
        },
        observedValues: {
          dropTimeSeconds: selected.dropTimeSeconds,
          airResistanceLevel:
            selected.canopyRadius > 1.4
              ? "higher"
              : selected.canopyRadius < 1.1
                ? "lower"
                : "medium",
        },
        runtimeSnapshot: {
          parachuteId: selected.id,
          lastTime: selected.dropTimeSeconds,
          cameraAlpha: camera.alpha,
        },
      };
    },
    snapshotSceneState() {
      return {
        sceneState: {
          parachuteId: selected.id,
          lastTime,
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
        ready: Boolean(selected),
      };
    },
    disposeScene() {
      scene.dispose();
      engine.dispose();
    },
  };
};

function createStrings(
  canopyRadius: number,
  payloadY: number,
  rig: TransformNode,
  scene: Scene,
) {
  return getStringPoints(canopyRadius, payloadY).map((points, index) => {
    const stringMesh = MeshBuilder.CreateCylinder(
      `string-${index}`,
      { height: 1, diameter: 0.035 },
      scene,
    );
    stringMesh.parent = rig;
    stringMesh.material = createSolidMaterial(scene, "#f5f5f5", 0.25);
    updateStringMesh(stringMesh, points[0], points[1]);
    return stringMesh;
  });
}

function updateStrings(
  strings: Mesh[],
  canopyRadius: number,
  payloadY: number,
) {
  getStringPoints(canopyRadius, payloadY).forEach((points, index) => {
    const current = strings[index];
    if (current) {
      updateStringMesh(current, points[0], points[1]);
    }
  });
}

function getStringPoints(canopyRadius: number, payloadY: number) {
  const canopyAnchorX = canopyRadius * 0.56;
  const canopyAnchorZ = 0.18;
  const payloadAnchorX = 0.12;
  const payloadAnchorY = payloadY + 0.22;
  const payloadAnchorZ = 0.08;

  return [
    [
      new Vector3(-canopyAnchorX, -0.02, -canopyAnchorZ),
      new Vector3(-payloadAnchorX, payloadAnchorY, -payloadAnchorZ),
    ],
    [
      new Vector3(canopyAnchorX, -0.02, -canopyAnchorZ),
      new Vector3(payloadAnchorX, payloadAnchorY, -payloadAnchorZ),
    ],
    [
      new Vector3(-canopyAnchorX, -0.02, canopyAnchorZ),
      new Vector3(-payloadAnchorX, payloadAnchorY, payloadAnchorZ),
    ],
    [
      new Vector3(canopyAnchorX, -0.02, canopyAnchorZ),
      new Vector3(payloadAnchorX, payloadAnchorY, payloadAnchorZ),
    ],
  ];
}

function updateStringMesh(stringMesh: Mesh, start: Vector3, end: Vector3) {
  const direction = end.subtract(start);
  const length = direction.length();
  const midpoint = start.add(end).scale(0.5);
  const normalized = direction.normalize();
  const rotation = new Quaternion();

  Quaternion.FromUnitVectorsToRef(Vector3.Up(), normalized, rotation);
  stringMesh.position.copyFrom(midpoint);
  stringMesh.scaling.set(1, length, 1);
  stringMesh.rotationQuaternion = rotation;
}
