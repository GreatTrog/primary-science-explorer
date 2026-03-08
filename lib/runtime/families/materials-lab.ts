import { MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core";

import { createBaseScene, createBench, createGround, createSolidMaterial, tween } from "@/lib/runtime/babylon-helpers";
import type { SceneFactory } from "@/lib/runtime/types";

type Payload = {
  apparatusLabel: string;
  materials: Array<{
    id: string;
    label: string;
    color: string;
    absorbency: number;
    roughness: number;
  }>;
};

export const createMaterialsLabScene: SceneFactory<Payload> = ({ canvas, definition, payload, initialState }) => {
  const { engine, scene, camera } = createBaseScene(canvas, {
    cameraPreset: definition.cameraPreset,
    lightingPreset: definition.lightingPreset,
  });

  createGround(scene, "#d9e5ef");
  createBench(scene);

  const rig = new TransformNode("materials-rig", scene);
  const bench = MeshBuilder.CreateBox("material-sheet", { width: 3.1, depth: 2.2, height: 0.2 }, scene);
  bench.position = new Vector3(0, 1.32, 0);
  bench.parent = rig;

  const droplet = MeshBuilder.CreateSphere("droplet", { diameter: 0.55 }, scene);
  droplet.position = new Vector3(0, 3.5, 0);
  droplet.parent = rig;
  droplet.material = createSolidMaterial(scene, "#79d8ff", 0.15);

  let selected = payload.materials[0];

  function applySelection(id: string, force = false) {
    const nextSelection = payload.materials.find((item) => item.id === id) ?? payload.materials[0];
    if (!force && nextSelection.id === selected.id) {
      return;
    }

    selected = nextSelection;
    bench.material = createSolidMaterial(scene, selected.color, selected.roughness);
  }

  applySelection(String(initialState.sceneState.materialId ?? selected.id), true);

  return {
    engine,
    scene,
    updateSelection(selection) {
      if (typeof selection.materialId === "string") {
        applySelection(selection.materialId);
      }
    },
    restoreSceneState(state) {
      if (typeof state.sceneState.materialId === "string") {
        applySelection(state.sceneState.materialId);
      }
    },
    async runAction() {
      droplet.position.y = 3.5;
      await tween(1600, (progress) => {
        droplet.position.y = 3.5 - progress * 2.05;
        droplet.scaling.y = 1 - progress * selected.absorbency * 0.35;
        droplet.scaling.x = 1 + progress * 0.16;
        droplet.scaling.z = 1 + progress * 0.16;
      });

      return {
        label: selected.label,
        variables: { Material: selected.label },
        observedValues: {
          drynessScore: Math.max(1, Math.round(5 - selected.absorbency * 4)),
        },
        runtimeSnapshot: {
          materialId: selected.id,
          cameraAlpha: camera.alpha,
          cameraRadius: camera.radius,
        },
      };
    },
    snapshotSceneState() {
      return {
        sceneState: {
          materialId: selected.id,
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
