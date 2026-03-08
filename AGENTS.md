# Primary Science Explorer Notes

## Trial Evidence Panel

- Keep the trial evidence table scene-specific. Do not reuse a generic outcome heading such as `Dissolved` for every investigation.
- When adding a new experiment, define a meaningful third-column label and matching value for that scene. Examples:
  - `particles_mixtures`: `Dissolved`
  - `forces_motion`: `Air resistance`
  - `circuits_energy`: `Output`
  - `light_optics`: `Target visible`
  - `materials_lab`: `Absorbency`
- Prefer natural language in the `Setup` and `Observations` columns rather than raw variable dumps.
- Update the shared evidence table helpers in `components/investigation/investigation-shell.tsx` when adding a new scene family:
  - `getTrialOutcomeHeader`
  - `formatTrialOutcome`
  - `formatTrialSetup`
  - `formatTrialObservations`

## Scene Rendering Choice

- Do not assume every experiment should use Babylon or a 3D scene.
- If the experiment is mainly a teaching diagram, cut-through, ray path, process chart, or other flat explanatory model, prefer an SVG-based scene instead of 3D.
- SVG is a good fit when you need:
  - crisp labelled geometry
  - simple mirror/beam/path animations
  - easy control over line direction and visibility
  - a clearer schematic view than a spatial model can provide
- Keep Babylon for experiments where depth, camera movement, or object manipulation is central to understanding the phenomenon.
