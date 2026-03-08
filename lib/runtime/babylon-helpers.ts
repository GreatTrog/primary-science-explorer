import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

export function createBaseScene(
  canvas: HTMLCanvasElement,
  options: {
    clearColor?: string;
    cameraPreset: "bench-close" | "tower-drop" | "circuit-lab" | "optics-focus" | "mixtures-bench";
    lightingPreset: "bright-lab" | "warm-lab" | "demo-stage";
  },
) {
  const engine = new Engine(canvas, true, {
    antialias: true,
    adaptToDeviceRatio: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(options.clearColor ?? "#eef5ff");

  const cameraTargets = {
    "bench-close": { alpha: -1.15, beta: 1.08, radius: 12, target: new Vector3(0, 1.8, 0) },
    "tower-drop": { alpha: -1.45, beta: 1.12, radius: 20, target: new Vector3(0, 5.8, 0) },
    "circuit-lab": { alpha: -1.2, beta: 1.0, radius: 14, target: new Vector3(0, 1.7, 0) },
    "optics-focus": { alpha: -1.18, beta: 1.2, radius: 11, target: new Vector3(0, 1.3, 0) },
    "mixtures-bench": { alpha: -1.08, beta: 1.12, radius: 11, target: new Vector3(0, 1.7, 0) },
  } as const;

  const preset = cameraTargets[options.cameraPreset];
  const camera = new ArcRotateCamera(
    "camera",
    preset.alpha,
    preset.beta,
    preset.radius,
    preset.target,
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = preset.radius * 0.65;
  camera.upperRadiusLimit = preset.radius * 1.4;
  camera.wheelDeltaPercentage = 0.02;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  const dir = new DirectionalLight("dir", new Vector3(-1, -2, 1), scene);
  dir.position = new Vector3(10, 14, -8);

  if (options.lightingPreset === "bright-lab") {
    hemi.intensity = 1.05;
    dir.intensity = 1.2;
  } else if (options.lightingPreset === "warm-lab") {
    hemi.intensity = 0.95;
    hemi.diffuse = Color3.FromHexString("#fff1d0");
    dir.intensity = 0.95;
  } else {
    hemi.intensity = 0.72;
    dir.intensity = 1.45;
  }

  engine.setHardwareScalingLevel(
    typeof navigator !== "undefined" && navigator.hardwareConcurrency < 8 ? 1.35 : 1,
  );

  engine.runRenderLoop(() => {
    scene.render();
  });

  return {
    engine,
    scene,
    camera,
  };
}

export function createGround(scene: Scene, color: string, width = 28, depth = 28) {
  const ground = MeshBuilder.CreateGround("ground", { width, height: depth }, scene);
  const material = new PBRMaterial("ground-material", scene);
  material.albedoColor = Color3.FromHexString(color);
  material.roughness = 1;
  ground.material = material;
  return ground;
}

export function createBench(scene: Scene, color = "#d7c1a6") {
  const benchTop = MeshBuilder.CreateBox(
    "bench-top",
    { width: 9.5, depth: 4.2, height: 0.35 },
    scene,
  );
  benchTop.position.y = 1;

  const topMaterial = new PBRMaterial("bench-material", scene);
  topMaterial.albedoColor = Color3.FromHexString(color);
  topMaterial.roughness = 0.9;
  benchTop.material = topMaterial;

  const legMaterial = new PBRMaterial("bench-leg-material", scene);
  legMaterial.albedoColor = Color3.FromHexString("#8e6e49");
  legMaterial.roughness = 1;

  [
    [-4.2, 0.4, -1.7],
    [4.2, 0.4, -1.7],
    [-4.2, 0.4, 1.7],
    [4.2, 0.4, 1.7],
  ].forEach(([x, y, z], index) => {
    const leg = MeshBuilder.CreateBox(`bench-leg-${index}`, { width: 0.25, depth: 0.25, height: 1.1 }, scene);
    leg.position.set(x, y, z);
    leg.material = legMaterial;
  });

  return benchTop;
}

export function createGlassMaterial(scene: Scene, color = "#8fd0ff") {
  const material = new PBRMaterial("glass-material", scene);
  material.albedoColor = Color3.FromHexString(color);
  material.alpha = 0.28;
  material.metallic = 0;
  material.roughness = 0.08;
  return material;
}

export function createEmissiveMaterial(scene: Scene, color: string) {
  const material = new StandardMaterial(`emissive-${color.replace("#", "")}`, scene);
  material.emissiveColor = Color3.FromHexString(color);
  material.diffuseColor = Color3.Black();
  return material;
}

export function createSolidMaterial(scene: Scene, color: string, roughness = 0.8) {
  const material = new PBRMaterial(`solid-${color.replace("#", "")}`, scene);
  material.albedoColor = Color3.FromHexString(color);
  material.roughness = roughness;
  return material;
}

export function tween(durationMs: number, onUpdate: (progress: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      onUpdate(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}
