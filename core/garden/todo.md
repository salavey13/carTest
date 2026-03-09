Purpose
Provide reusable plant/garden logic used by the Greenbox plugin.

Tasks
- Implement plant state model:
  - health
  - water
  - growth stage
- Provide functions:
  - `createPlant()`
  - `waterPlant()`
  - `applySimulationEvent()`
- Store plant stats through storage core.

Constraints
- Must be simulation-safe.
- No UI logic.