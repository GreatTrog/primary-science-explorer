import { Color3, MeshBuilder, Vector3 } from "@babylonjs/core";

import type { RuntimeState } from "@/lib/domain/types";
import {
  createBaseScene,
  createBench,
  createEmissiveMaterial,
  createGround,
  createSolidMaterial,
  tween,
} from "@/lib/runtime/babylon-helpers";
import type { SceneFactory } from "@/lib/runtime/types";

type Payload = {
  cells: Array<{
    id: string;
    label: string;
    voltage: number;
  }>;
  outputs: Array<{
    id: string;
    label: string;
    kind: "bulb" | "buzzer";
    color: string;
  }>;
};

export const createCircuitsEnergyScene: SceneFactory<Payload> = ({
  canvas,
  definition,
  payload,
  initialState,
}) => {
  const { engine, scene, camera } = createBaseScene(canvas, {
    cameraPreset: definition.cameraPreset,
    lightingPreset: definition.lightingPreset,
    clearColor: "#f1f8ff",
  });

  createGround(scene, "#dde9f2");
  createBench(scene, "#d1bea1");

  const board = MeshBuilder.CreateBox("circuit-board", { width: 8.4, depth: 4.2, height: 0.18 }, scene);
  board.position = new Vector3(0, 1.28, 0);
  board.material = createSolidMaterial(scene, "#32404c", 0.95);

  const batteryTray = MeshBuilder.CreateBox("battery-tray", { width: 4.4, depth: 1.2, height: 0.18 }, scene);
  batteryTray.position = new Vector3(-1.95, 1.42, 0);
  batteryTray.material = createSolidMaterial(scene, "#465561", 0.92);

  const cellCenters = [-3.2, -1.95, -0.7];
  const cellMeshes = payload.cells.map((cell, index) => {
    const shell = MeshBuilder.CreateCylinder(`cell-${cell.id}`, { diameter: 0.46, height: 1.1 }, scene);
    shell.rotation.z = Math.PI / 2;
    shell.position = new Vector3(cellCenters[index], 1.68, 0);
    shell.material = createSolidMaterial(scene, "#57c26e", 0.55);

    const capA = MeshBuilder.CreateCylinder(`cell-cap-a-${cell.id}`, { diameter: 0.48, height: 0.08 }, scene);
    capA.rotation.z = Math.PI / 2;
    capA.position = new Vector3(shell.position.x - 0.56, 1.68, 0);
    capA.material = createSolidMaterial(scene, "#d7d9dc", 0.25);

    const capB = MeshBuilder.CreateCylinder(`cell-cap-b-${cell.id}`, { diameter: 0.48, height: 0.08 }, scene);
    capB.rotation.z = Math.PI / 2;
    capB.position = new Vector3(shell.position.x + 0.56, 1.68, 0);
    capB.material = createSolidMaterial(scene, "#c7ab3e", 0.25);

    return [shell, capA, capB];
  });

  const bulbBase = MeshBuilder.CreateCylinder("bulb-base", { diameter: 0.72, height: 0.34 }, scene);
  bulbBase.position = new Vector3(2.55, 1.58, -0.75);
  bulbBase.material = createSolidMaterial(scene, "#8f8e87", 0.38);
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.88 }, scene);
  bulb.position = new Vector3(2.55, 2.04, -0.75);
  const bulbMaterial = createEmissiveMaterial(scene, "#282828");
  bulb.material = bulbMaterial;

  const buzzerBody = MeshBuilder.CreateCylinder("buzzer-body", { diameter: 1.1, height: 0.44 }, scene);
  buzzerBody.position = new Vector3(2.35, 1.66, 0.9);
  const buzzerTop = MeshBuilder.CreateCylinder("buzzer-top", { diameter: 0.82, height: 0.12 }, scene);
  buzzerTop.position = new Vector3(2.35, 1.95, 0.9);
  buzzerBody.material = createSolidMaterial(scene, "#2f404d", 0.5);
  buzzerTop.material = createSolidMaterial(scene, "#7fd6ff", 0.22);

  const soundRings = Array.from({ length: 3 }, (_, index) => {
    const ring = MeshBuilder.CreateTorus(`sound-ring-${index}`, { diameter: 0.8 + index * 0.45, thickness: 0.04 }, scene);
    ring.position = new Vector3(2.35, 2.1, 0.9);
    ring.rotation.x = Math.PI / 2;
    ring.material = createEmissiveMaterial(scene, "#7fd6ff");
    ring.isVisible = false;
    return ring;
  });

  const wireMaterial = createSolidMaterial(scene, "#d8aa2f", 0.38);
  let bulbWire = MeshBuilder.CreateTube(
    "bulb-wire",
    { path: [new Vector3(-3.76, 1.68, 0), new Vector3(-3.76, 1.68, 0.01)], radius: 0.07 },
    scene,
  );
  bulbWire.material = wireMaterial;

  let buzzerWire = MeshBuilder.CreateTube(
    "buzzer-wire",
    { path: [new Vector3(-3.76, 1.68, 0), new Vector3(-3.76, 1.68, 0.01)], radius: 0.07 },
    scene,
  );
  buzzerWire.material = wireMaterial;

  let pulsePathBulb = [new Vector3(-3.76, 1.68, 0), new Vector3(-3.76, 1.68, 0.01)];
  let pulsePathBuzzer = [new Vector3(-3.76, 1.68, 0), new Vector3(-3.76, 1.68, 0.01)];

  const pulses = Array.from({ length: 5 }, (_, index) => {
    const pulse = MeshBuilder.CreateSphere(`pulse-${index}`, { diameter: 0.14 }, scene);
    pulse.material = createEmissiveMaterial(scene, "#7fd6ff");
    pulse.position = pulsePathBulb[0].clone();
    return pulse;
  });

  let selectedCell = payload.cells[0];
  let selectedOutput = payload.outputs[0];
  let lastStrength = 0;

  function buildBulbPath(activeCellCount: number) {
    const startX = cellCenters[0] - 0.6;
    const endX = cellCenters[activeCellCount - 1] + 0.6;

    return [
      new Vector3(startX, 1.68, 0),
      new Vector3(startX, 1.34, -1.3),
      new Vector3(2.55, 1.34, -1.3),
      new Vector3(2.55, 1.58, -0.75),
      new Vector3(2.55, 1.34, -1.3),
      new Vector3(3.2, 1.34, -1.3),
      new Vector3(3.2, 1.34, 1.55),
      new Vector3(endX, 1.34, 1.55),
      new Vector3(endX, 1.68, 0),
    ];
  }

  function buildBuzzerPath(activeCellCount: number) {
    const startX = cellCenters[0] - 0.6;
    const endX = cellCenters[activeCellCount - 1] + 0.6;

    return [
      new Vector3(startX, 1.68, 0),
      new Vector3(startX, 1.34, 1.4),
      new Vector3(2.35, 1.34, 1.4),
      new Vector3(2.35, 1.66, 0.9),
      new Vector3(2.35, 1.34, 1.4),
      new Vector3(3.2, 1.34, 1.4),
      new Vector3(3.2, 1.34, -1.45),
      new Vector3(endX, 1.34, -1.45),
      new Vector3(endX, 1.68, 0),
    ];
  }

  function rebuildWires(activeCellCount: number) {
    bulbWire.dispose();
    buzzerWire.dispose();

    pulsePathBulb = buildBulbPath(activeCellCount);
    pulsePathBuzzer = buildBuzzerPath(activeCellCount);

    bulbWire = MeshBuilder.CreateTube(
      "bulb-wire",
      {
        path: pulsePathBulb,
        radius: 0.07,
      },
      scene,
    );
    bulbWire.material = wireMaterial;

    buzzerWire = MeshBuilder.CreateTube(
      "buzzer-wire",
      {
        path: pulsePathBuzzer,
        radius: 0.07,
      },
      scene,
    );
    buzzerWire.material = wireMaterial;
  }

  function applySelection() {
    const activeCellCount = payload.cells.indexOf(selectedCell) + 1;
    cellMeshes.forEach((parts, index) => {
      parts.forEach((mesh) => {
        mesh.isVisible = index < activeCellCount;
      });
    });
    rebuildWires(activeCellCount);

    bulbWire.visibility = selectedOutput.kind === "bulb" ? 1 : 0.2;
    buzzerWire.visibility = selectedOutput.kind === "buzzer" ? 1 : 0.2;
    bulbBase.visibility = selectedOutput.kind === "bulb" ? 1 : 0.45;
    bulb.visibility = selectedOutput.kind === "bulb" ? 1 : 0.3;
    buzzerBody.visibility = selectedOutput.kind === "buzzer" ? 1 : 0.45;
    buzzerTop.visibility = selectedOutput.kind === "buzzer" ? 1 : 0.45;
  }

  function getEffectStrength() {
    return payload.cells.indexOf(selectedCell) + 1;
  }

  function restoreSelection(state: RuntimeState, force = false) {
    let changed = force;
    if (typeof state.sceneState.cellId === "string") {
      const nextCell = payload.cells.find((cell) => cell.id === state.sceneState.cellId) ?? selectedCell;
      if (nextCell.id !== selectedCell.id) {
        selectedCell = nextCell;
        changed = true;
      }
    }
    if (typeof state.sceneState.outputId === "string") {
      const nextOutput =
        payload.outputs.find((output) => output.id === state.sceneState.outputId) ?? selectedOutput;
      if (nextOutput.id !== selectedOutput.id) {
        selectedOutput = nextOutput;
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
      if (typeof selection.cellId === "string") {
        const nextCell = payload.cells.find((cell) => cell.id === selection.cellId) ?? selectedCell;
        if (nextCell.id !== selectedCell.id) {
          selectedCell = nextCell;
          changed = true;
        }
      }
      if (typeof selection.outputId === "string") {
        const nextOutput =
          payload.outputs.find((output) => output.id === selection.outputId) ?? selectedOutput;
        if (nextOutput.id !== selectedOutput.id) {
          selectedOutput = nextOutput;
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
      const strength = getEffectStrength();
      const pulsePath = selectedOutput.kind === "bulb" ? pulsePathBulb : pulsePathBuzzer;
      const glowOn = Color3.FromHexString("#ffd96f");
      const glowOff = Color3.FromHexString("#202020");

      bulbMaterial.emissiveColor = glowOff;
      soundRings.forEach((ring) => {
        ring.isVisible = false;
        ring.scaling.setAll(0.4);
      });

      await tween(1800, (progress) => {
        pulses.forEach((pulse, index) => {
          const phase = (progress + index * 0.15) % 1;
          pulse.position.copyFrom(samplePolyline(pulsePath, phase));
        });

        if (selectedOutput.kind === "bulb") {
          bulbMaterial.emissiveColor = Color3.Lerp(glowOff, glowOn, Math.min(progress * (strength / 3) * 1.2, 1));
        } else {
          buzzerTop.position.y = 1.95 + Math.sin(progress * Math.PI * (5 + strength * 2)) * 0.06;
          soundRings.forEach((ring, index) => {
            ring.isVisible = true;
            const ringProgress = (progress * 1.25 + index * 0.15) % 1;
            ring.scaling.setAll(0.45 + ringProgress * (0.9 + strength * 0.15));
            ring.position.y = 2.08 + ringProgress * 0.08;
            ring.visibility = 1 - ringProgress * 0.75;
          });
        }
      });

      lastStrength = strength;
      const effectLabel =
        selectedOutput.kind === "bulb"
          ? ["dim bulb", "bright bulb", "very bright bulb"][strength - 1]
          : ["quiet buzzer", "louder buzzer", "loud buzzer"][strength - 1];

      return {
        label: `${selectedCell.label} / ${selectedOutput.label}`,
        variables: {
          Cells: selectedCell.label,
          Output: selectedOutput.label,
        },
        observedValues: {
          cellsCount: strength,
          effectLabel,
          effectStrength: strength,
        },
        runtimeSnapshot: {
          cellId: selectedCell.id,
          outputId: selectedOutput.id,
          effectStrength: strength,
          cameraAlpha: camera.alpha,
        },
      };
    },
    snapshotSceneState() {
      return {
        sceneState: {
          cellId: selectedCell.id,
          outputId: selectedOutput.id,
          lastStrength,
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
        ready: Boolean(selectedCell && selectedOutput),
        reason: "Choose a cell count and an output device, then close the complete circuit.",
      };
    },
    disposeScene() {
      scene.dispose();
      engine.dispose();
    },
  };
};

function samplePolyline(path: Vector3[], progress: number) {
  const segmentLengths = [];
  let totalLength = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const length = Vector3.Distance(path[index], path[index + 1]);
    segmentLengths.push(length);
    totalLength += length;
  }

  let distance = totalLength * progress;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (distance <= segmentLength) {
      return Vector3.Lerp(path[index], path[index + 1], segmentLength === 0 ? 0 : distance / segmentLength);
    }
    distance -= segmentLength;
  }

  return path[path.length - 1].clone();
}
