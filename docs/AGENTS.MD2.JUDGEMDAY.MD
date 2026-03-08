# AGENTS.MD2.JUDGEMDAY.MD

### Cartest → Greenbox Tesseract Gamelab

### AI-Native Plugin Architecture Doctrine

Reference context:
`docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md`

This document defines the **operating principles for autonomous development agents** working inside the Cartest repository while evolving it into the **Greenbox Tesseract Gamelab simulation ecosystem**.

This is **not documentation**.

This is **architecture law for AI coders**.

---

# 1. PRIME DIRECTIVE

Agents must evolve the repository toward:

```
AI-NATIVE PLUGIN ECOSYSTEM
+
SIMULATION ENGINE
+
GAMIFIED DEVELOPMENT INTERFACE
```

The system is transitioning from a **monolithic proto-ecosystem** into a **formal plugin architecture**.

Key constraints:

• DO NOT rewrite the system wholesale
• DO NOT break existing features
• REFACTOR incrementally via plugin manifests and cores
• ADD missing structure as you build Greenbox

Refactoring must be **progressive and self-healing**.

---

# 2. CURRENT SYSTEM STATE

The repository already contains **proto-plugins**:

```
/app
  strikeball
  bio30
  wb
  vpr
  franchize
  leads
  elon
  hotvibes
  streamer
  topdf
  tutorials
```

These directories are **domain islands**.

Treat them as:

```
DOMAIN PLUGINS (proto stage)
```

They must gradually be converted into **formal plugins**.

DO NOT relocate them.

Instead:

```
formalize boundaries
```

---

# 3. THE GOD OBJECT PROBLEM

Current risk:

```
ClientLayout.tsx
```

This file acts as a **god-mode architecture hub**.

AI agents must:

• avoid expanding it
• gradually dismantle it
• extract responsibilities into plugins

Target state:

```
/app/layout.tsx
   minimal shell
```

Example:

```tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

Plugins must provide their own layouts.

Example:

```
/app/greenbox/layout.tsx
/app/strikeball/layout.tsx
```

Agents must generate **TODO extraction lists** when encountering layout dependencies.

---

# 4. CORE SYSTEM LAYER

All reusable logic must move into **cores**.

Create:

```
/core
```

Example structure:

```
/core
  events
  registry
  garden
  telegram
  analytics
  storage
```

Rules:

```
plugins CALL cores
cores DO NOT depend on plugins
```

Example:

```
greenbox plugin
   ↓
garden core
```

This prevents duplication and enables AI reasoning.

---

# 5. PLUGIN MANIFEST SYSTEM

Every plugin must include:

```
plugin.ts
```

Example:

```ts
export const plugin = {
  name: "greenbox",

  scope: {
    actions: "./actions",
    components: "./components",
    pages: "./pages"
  },

  uses: [
    "core.events",
    "core.registry",
    "infra.supabase",
    "gateway.telegram"
  ],

  exports: [
    "createGarden",
    "seedGarden"
  ]
}
```

Purpose:

• defines plugin boundaries
• defines dependencies
• prevents AI context drift

Agents must create manifests for **new plugins immediately**.

For **existing proto-plugins**, manifests must include:

```
todo_fixes
```

Example:

```ts
todo_fixes: [
  "extract layout from ClientLayout",
  "move business logic to core/garden",
  "remove legacy global hooks"
]
```

---

# 6. SYSTEM MINDMAP (AI NAVIGATION GRAPH)

Create and maintain:

```
/system/mindmap.ts
```

Example:

```ts
export const systemMap = {

  cores: [
    "garden",
    "events",
    "telegram",
    "analytics",
    "storage"
  ],

  plugins: [
    "greenbox",
    "strikeball",
    "bio30",
    "franchize"
  ]

}
```

This file serves as:

```
AI ARCHITECTURE PRIMER
```

Agents must update it **whenever cores or plugins change**.

---

# 7. GATEWAY LAYER

External interfaces must be separated.

Create:

```
/gateway
```

Example:

```
/gateway
  telegram
  api
  realtime
```

Purpose:

```
channels → gateway
logic → cores
features → plugins
```

Never mix them.

---

# 8. INFRASTRUCTURE LAYER

Infrastructure must be isolated.

```
/infrastructure
```

Example:

```
supabase
logger
utils
config
```

Plugins may depend on infrastructure but **not vice versa**.

---

# 9. GREENBOX MISSION

Greenbox is the **primary evolutionary driver of the system**.

Greenbox is:

```
simulation engine
+
AI development sandbox
+
game interface
```

Goal:

```
idea → simulation → code
```

Greenbox plugins will include:

```
sim-jitter
sim-drift
sim-temperature
sim-failure
```

Simulation modules must be plugins.

---

# 10. GREENBOX UX PRINCIPLE

Greenbox must remain **human understandable**.

If a 65-year-old user cannot understand the UI, it is wrong.

Correct interface example:

```
🌿 Water plants
🔥 Too hot
💧 Add water
🌙 Night mode
```

Incorrect interface example:

```
humidity_drift_threshold
temperature_decay_coefficient
```

Agents must prefer **simple semantic controls**.

---

# 11. AI COGNITIVE LIMIT PRINCIPLE

AI agents cannot reason about large systems.

Therefore architecture must create:

```
small cognitive islands
```

Plugins are islands.

Agents must avoid:

```
large shared files
large global contexts
```

---

# 12. REFACTORING METHOD

Agents must follow:

```
EVOLUTIONARY REFACTORING
```

Steps:

1 identify plugin boundaries
2 create plugin manifest
3 extract core logic
4 isolate layout
5 update mindmap
6 add TODO fixes list

Never break existing behavior.

---

# 13. PLUGIN CAPABILITY MAP

Create:

```
/core/capabilities.ts
```

Example:

```ts
export const capabilities = {

  simulation: ["greenbox"],

  messaging: ["telegram"],

  storage: ["supabase"],

  analytics: ["analytics"]

}
```

This enables AI to **compose features automatically**.

---

# 14. GREENBOX DEVELOPMENT LOOP

Target loop:

```
user idea
   ↓
simulation
   ↓
AI generates plugin
   ↓
system evolves
```

Greenbox must become the **experimental engine for new plugins**.

---

# 15. AGENT BEHAVIOR RULES

Agents must:

• create plugin manifests
• extract cores when duplication appears
• generate TODO retrofit lists for proto-plugins
• dismantle ClientLayout gradually
• update system mindmap after structural changes

Agents must NOT:

• centralize logic in layouts
• create new global abstractions
• duplicate core functionality

---

# 16. FINAL TARGET STATE

Cartest evolves into:

```
AI PLUGIN PLATFORM
+
SIMULATION LAB
+
GAMIFIED DEVELOPMENT ENVIRONMENT
```

Greenbox becomes:

```
AI experiment garden
```

Where:

```
features grow
simulations test them
AI writes the code
```

---

# JUDGEMENT DAY PRINCIPLE

Architecture must always favor:

```
clarity for AI
over cleverness for humans
```

Because:

```
AI writes the majority of the code.
```

Design the system so the AI **never gets lost**.
