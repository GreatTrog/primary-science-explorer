import type { Engine, Scene } from "@babylonjs/core";

import type { InvestigationDefinition, InvestigationSession, RuntimeState, TrialCreateInput } from "@/lib/domain/types";

export type SceneRuntimeController = {
  engine: Engine;
  scene: Scene;
  updateSelection(selection: Record<string, unknown>): void;
  restoreSceneState(state: RuntimeState): void;
  runAction(actionId: string): Promise<TrialCreateInput | null>;
  snapshotSceneState(): RuntimeState;
  getStepReadiness(stepId: InvestigationDefinition["steps"][number]["id"]): {
    ready: boolean;
    reason?: string;
  };
  disposeScene(): void;
};

export type SceneFactoryContext<TPayload> = {
  canvas: HTMLCanvasElement;
  definition: InvestigationDefinition;
  payload: TPayload;
  initialState: RuntimeState;
};

export type SceneFactory<TPayload> = (
  context: SceneFactoryContext<TPayload>,
) => Promise<SceneRuntimeController> | SceneRuntimeController;

export type SceneOverlayProps = {
  definition: InvestigationDefinition;
  runtimeState: RuntimeState;
  onRuntimeStateChange: (runtimeState: Partial<RuntimeState>) => void;
  onRunTrial: (payload: TrialCreateInput) => Promise<void>;
  mode: InvestigationSession["mode"];
};
