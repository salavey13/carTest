Purpose
Greenbox is the experimental simulation environment for hydroponic systems.

Public Interface

The module exposes:

- simulation state
- plant model
- sensor model

Other modules may depend on these exports.

Stable APIs

simulation.start()
simulation.stop()
simulation.getState()

Constraints

- Do not directly access database.
- All persistence goes through /infrastructure/supabase.
- External communication goes through /gateway modules.

Allowed Changes

Agents may:

- add simulation features
- extend sensor models
- improve visualization

Agents must NOT:

- change API names without updating registry.