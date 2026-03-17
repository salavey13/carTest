Purpose
Provide a simple event bus for simulation and alerts.

Tasks
- Implement event emitter with:
  - `emit(event)`
  - `subscribe(type)`
- Define basic event types:
  - plant_dry
  - plant_watered
  - simulation_tick
- Greenbox plugin listens to events to update UI.

Constraints
- Lightweight implementation.
- Avoid external dependencies.