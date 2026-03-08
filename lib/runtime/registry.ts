import type { InvestigationDefinition } from "@/lib/domain/types";
import { createCircuitsEnergyScene } from "@/lib/runtime/families/circuits-energy";
import { createForcesMotionScene } from "@/lib/runtime/families/forces-motion";
import { createLightOpticsScene } from "@/lib/runtime/families/light-optics";
import { createMaterialsLabScene } from "@/lib/runtime/families/materials-lab";
import { createParticlesMixturesScene } from "@/lib/runtime/families/particles-mixtures";
import type { SceneRuntimeController } from "@/lib/runtime/types";

export async function createSceneController(
  canvas: HTMLCanvasElement,
  definition: InvestigationDefinition,
  initialState: import("@/lib/domain/types").RuntimeState,
): Promise<SceneRuntimeController> {
  const family = definition.sceneConfig.family;

  if (family === "materials_lab") {
    return createMaterialsLabScene({
      canvas,
      definition,
      payload: definition.sceneConfig.payload,
      initialState,
    });
  }

  if (family === "forces_motion") {
    return createForcesMotionScene({
      canvas,
      definition,
      payload: definition.sceneConfig.payload,
      initialState,
    });
  }

  if (family === "circuits_energy") {
    return createCircuitsEnergyScene({
      canvas,
      definition,
      payload: definition.sceneConfig.payload,
      initialState,
    });
  }

  if (family === "light_optics") {
    return createLightOpticsScene({
      canvas,
      definition,
      payload: definition.sceneConfig.payload,
      initialState,
    });
  }

  return createParticlesMixturesScene({
    canvas,
    definition,
    payload: definition.sceneConfig.payload,
    initialState,
  });
}
