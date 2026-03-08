import { MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core";

import {
  createBaseScene,
  createBench,
  createGlassMaterial,
  createGround,
  createSolidMaterial,
  tween,
} from "@/lib/runtime/babylon-helpers";
import type { RuntimeState } from "@/lib/domain/types";
import type { SceneFactory } from "@/lib/runtime/types";

type Payload = {
  substances: Array<{
    id: string;
    label: string;
    color: string;
    dissolves: boolean;
    baseDissolveSeconds: number;
    residueColor?: string;
  }>;
  temperatures: Array<{
    id: string;
    label: string;
    multiplier: number;
    tint: string;
  }>;
  stirringLevels: Array<{
    id: string;
    label: string;
    multiplier: number;
  }>;
};

export const createParticlesMixturesScene: SceneFactory<Payload> = ({
  canvas,
  definition,
  payload,
  initialState,
}) => {
  const { engine, scene, camera } = createBaseScene(canvas, {
    cameraPreset: definition.cameraPreset,
    lightingPreset: definition.lightingPreset,
    clearColor: "#eef8ff",
  });

  createGround(scene, "#dce7f0");
  createBench(scene);

  const benchSurfaceY = 1.175;
  const beakerHeight = 3.2;
  const beakerBottomY = benchSurfaceY + 0.04;
  const beakerCenterY = beakerBottomY + beakerHeight / 2;
  const waterHeight = 2.32;
  const waterBottomY = beakerBottomY + 0.06;
  const waterCenterY = waterBottomY + waterHeight / 2;

  const beakerOuter = MeshBuilder.CreateCylinder("beaker-outer", { diameter: 2.3, height: beakerHeight, tessellation: 48 }, scene);
  beakerOuter.position = new Vector3(0, beakerCenterY, 0);
  beakerOuter.material = createGlassMaterial(scene);

  const beakerBase = MeshBuilder.CreateCylinder("beaker-base", { diameter: 2.02, height: 0.06, tessellation: 48 }, scene);
  beakerBase.position = new Vector3(0, beakerBottomY + 0.03, 0);
  beakerBase.material = createGlassMaterial(scene, "#d6e8f5");

  const water = MeshBuilder.CreateCylinder("water", { diameter: 2.05, height: waterHeight, tessellation: 48 }, scene);
  water.position = new Vector3(0, waterCenterY, 0);
  water.material = createGlassMaterial(scene, "#7ec9ff");

  const spoon = MeshBuilder.CreateCylinder("spoon", { diameter: 0.12, height: 3.3 }, scene);
  spoon.position = new Vector3(0.42, beakerBottomY + 1.78, 0.12);
  spoon.rotation.z = 0.06;
  spoon.material = createSolidMaterial(scene, "#cfd5db", 0.2);
  const spoonRestPosition = spoon.position.clone();
  const spoonRestRotationZ = 0.06;

  const granuleRig = new TransformNode("granule-rig", scene);
  const granules = Array.from({ length: 24 }, (_, index) => {
    const particle = MeshBuilder.CreateSphere(`granule-${index}`, { diameter: 0.12 + (index % 3) * 0.02 }, scene);
    particle.parent = granuleRig;
    particle.position = new Vector3(
      ((index % 6) - 2.5) * 0.14,
      waterBottomY + 0.12 + Math.floor(index / 6) * 0.09,
      ((index % 4) - 1.5) * 0.12,
    );
    return particle;
  });
  const initialGranulePositions = granules.map((granule) => granule.position.clone());

  let selectedSubstance = payload.substances[0];
  let selectedTemperature = payload.temperatures[1];
  let selectedStir = payload.stirringLevels[1];
  let lastTime = 0;

  function applySelection() {
    const granuleMaterial = createSolidMaterial(scene, selectedSubstance.color, 0.55);
    granules.forEach((granule) => {
      granule.material = granuleMaterial;
      granule.scaling.setAll(1);
      granule.isVisible = true;
      granule.visibility = 1;
    });
    granules.forEach((granule, index) => {
      granule.position.copyFrom(initialGranulePositions[index]);
    });
    water.material = createGlassMaterial(scene, selectedTemperature.tint);
    spoon.position.copyFrom(spoonRestPosition);
    spoon.rotation.y = 0;
    spoon.rotation.z = spoonRestRotationZ;
  }

  function calculateTime() {
    return Math.round(
      selectedSubstance.baseDissolveSeconds *
        selectedTemperature.multiplier *
        selectedStir.multiplier *
        10,
    ) / 10;
  }

  if (typeof initialState.sceneState.substanceId === "string") {
    selectedSubstance =
      payload.substances.find((substance) => substance.id === initialState.sceneState.substanceId) ??
      selectedSubstance;
  }
  if (typeof initialState.sceneState.temperatureId === "string") {
    selectedTemperature =
      payload.temperatures.find((entry) => entry.id === initialState.sceneState.temperatureId) ??
      selectedTemperature;
  }
  if (typeof initialState.sceneState.stirId === "string") {
    selectedStir =
      payload.stirringLevels.find((entry) => entry.id === initialState.sceneState.stirId) ?? selectedStir;
  }
  applySelection();

  function restoreSelection(state: RuntimeState) {
    let changed = false;
    if (typeof state.sceneState.substanceId === "string") {
      const nextSubstance =
        payload.substances.find((substance) => substance.id === state.sceneState.substanceId) ??
        selectedSubstance;
      if (nextSubstance.id !== selectedSubstance.id) {
        selectedSubstance = nextSubstance;
        changed = true;
      }
    }
    if (typeof state.sceneState.temperatureId === "string") {
      const nextTemperature =
        payload.temperatures.find((entry) => entry.id === state.sceneState.temperatureId) ??
        selectedTemperature;
      if (nextTemperature.id !== selectedTemperature.id) {
        selectedTemperature = nextTemperature;
        changed = true;
      }
    }
    if (typeof state.sceneState.stirId === "string") {
      const nextStir =
        payload.stirringLevels.find((entry) => entry.id === state.sceneState.stirId) ?? selectedStir;
      if (nextStir.id !== selectedStir.id) {
        selectedStir = nextStir;
        changed = true;
      }
    }
    if (changed) {
      applySelection();
    }
  }

  return {
    engine,
    scene,
    updateSelection(selection) {
      let changed = false;
      if (typeof selection.substanceId === "string") {
        const nextSubstance =
          payload.substances.find((substance) => substance.id === selection.substanceId) ?? selectedSubstance;
        if (nextSubstance.id !== selectedSubstance.id) {
          selectedSubstance = nextSubstance;
          changed = true;
        }
      }
      if (typeof selection.temperatureId === "string") {
        const nextTemperature =
          payload.temperatures.find((entry) => entry.id === selection.temperatureId) ?? selectedTemperature;
        if (nextTemperature.id !== selectedTemperature.id) {
          selectedTemperature = nextTemperature;
          changed = true;
        }
      }
      if (typeof selection.stirId === "string") {
        const nextStir =
          payload.stirringLevels.find((entry) => entry.id === selection.stirId) ?? selectedStir;
        if (nextStir.id !== selectedStir.id) {
          selectedStir = nextStir;
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
      const measuredTimeSeconds = calculateTime();
      const visualDuration = measuredTimeSeconds * 1000;
      const dissolves = selectedSubstance.dissolves;
      const isStill = selectedStir.id === "still";
      const stirRateHz =
        selectedStir.id === "fast" ? 1.45 : selectedStir.id === "gentle" ? 0.9 : 0;

      await tween(visualDuration, (progress) => {
        const elapsedSeconds = measuredTimeSeconds * progress;
        const stirAngle = elapsedSeconds * Math.PI * 2 * stirRateHz;
        const settleStart = dissolves ? 1 : 0.82;
        const settleProgress =
          progress > settleStart ? (progress - settleStart) / (1 - settleStart) : 0;
        const swirlProgress = settleProgress > 0 ? 1 : progress / Math.max(settleStart, 0.001);

        if (isStill) {
          spoon.position.copyFrom(spoonRestPosition);
          spoon.rotation.y = 0;
          spoon.rotation.z = spoonRestRotationZ;
        } else {
          spoon.position.x = spoonRestPosition.x + Math.cos(stirAngle) * 0.16;
          spoon.position.z = spoonRestPosition.z + Math.sin(stirAngle) * 0.18;
          spoon.position.y = spoonRestPosition.y + Math.sin(stirAngle * 2) * 0.03;
          spoon.rotation.y = stirAngle + Math.PI / 2;
          spoon.rotation.z = 0.16 + Math.cos(stirAngle) * 0.05;
        }
        granules.forEach((granule, index) => {
          const origin = initialGranulePositions[index];
          const angle = stirAngle + index * 0.62;
          const swirlX = isStill
            ? origin.x
            : origin.x * 0.32 + Math.sin(angle) * (0.18 + (index % 3) * 0.03);
          const swirlZ = isStill
            ? origin.z
            : origin.z * 0.3 + Math.cos(angle * 1.1) * (0.14 + (Math.floor(index / 6) % 2) * 0.03);
          const swirlY = isStill
            ? origin.y
            : waterBottomY +
              0.2 +
              Math.floor(index / 6) * 0.07 +
              Math.sin(angle * 1.4) * 0.11 +
              swirlProgress * 0.05;

          if (dissolves) {
            granule.position.x = swirlX;
            granule.position.z = swirlZ;
            granule.position.y = isStill
              ? origin.y - progress * 0.02
              : swirlY;
            granule.scaling.setAll(Math.max(0.05, 1 - progress));
            granule.visibility = Math.max(0.05, 1 - progress);
          } else {
            const targetX = ((index % 6) - 2.5) * 0.055;
            const targetZ = (Math.floor(index / 6) - 1.5) * 0.055;
            const targetY = waterBottomY + 0.035 + (index % 5) * 0.004;

            granule.position.x = isStill
              ? origin.x * (1 - progress) + targetX * progress
              : swirlX * (1 - settleProgress) + targetX * settleProgress;
            granule.position.z = isStill
              ? origin.z * (1 - progress) + targetZ * progress
              : swirlZ * (1 - settleProgress) + targetZ * settleProgress;
            granule.position.y = isStill
              ? origin.y * (1 - progress) + targetY * progress
              : swirlY * (1 - settleProgress) + targetY * settleProgress;
            granule.scaling.setAll(1);
            granule.visibility = 1;
          }
        });
      });

      lastTime = measuredTimeSeconds;
      const observedValues: Record<string, string | number | boolean> = dissolves
        ? {
            dissolveTimeSeconds: measuredTimeSeconds,
            residueVisible: false,
          }
        : {
            outcome: "did not dissolve",
            settlingTimeSeconds: measuredTimeSeconds,
            residueVisible: true,
          };

      return {
        label: `${selectedSubstance.label} in ${selectedTemperature.label}`,
        variables: {
          Substance: selectedSubstance.label,
          Temperature: selectedTemperature.label,
          Stirring: selectedStir.label,
        },
        observedValues,
        runtimeSnapshot: {
          substanceId: selectedSubstance.id,
          temperatureId: selectedTemperature.id,
          stirId: selectedStir.id,
          measuredTimeSeconds,
          cameraRadius: camera.radius,
        },
      };
    },
    snapshotSceneState() {
      return {
        sceneState: {
          substanceId: selectedSubstance.id,
          temperatureId: selectedTemperature.id,
          stirId: selectedStir.id,
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
        ready: Boolean(selectedSubstance && selectedTemperature && selectedStir),
      };
    },
    disposeScene() {
      scene.dispose();
      engine.dispose();
    },
  };
};
