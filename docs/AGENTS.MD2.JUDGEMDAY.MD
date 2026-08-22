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


# MEANWHILE FOR USER EXPERIENCE

This "TRADE LIKE AN INSIDER" transcript is actually **shockingly relevant to what we’re building**, even though on the surface it's about a trading app. The deeper layer is **product cognition engineering** — which fits **Greenbox + AI-native architecture** extremely well.

I'll break the insights and **directly graft them onto our AGENTS + Greenbox architecture plan**.

---

# 1. The most important concept: **Magic Moment Engineering**

The founder says:

> the goal is to force the user into the magic moment within 2 minutes 

And even more extreme:

> if onboarding can't be completed while going to the bathroom it's too long 

That is **a brutal product constraint**.

Now apply it to **Greenbox**.

Greenbox cannot start like this:

```
create simulation
configure parameters
select modules
deploy engine
run test
```

That's **developer UX**.

Instead we must design:

```
🌱 Create Garden
↓
🔥 System under stress
↓
🤖 AI proposes fix
↓
✨ Simulation evolves
```

Meaning:

**Greenbox magic moment**

```
USER
clicks one thing

AI
changes system behavior live
```

The **wow moment** must be:

```
"I changed the system with one action"
```

Not:

```
"I configured a simulator"
```

---

# 2. Mental Calories — this is huge for us

He says:

> If the screen is more than 100 mental calories it's too much 

This is extremely relevant to our architecture.

Because developer tools usually look like:

```
config panel
50 toggles
10 dropdowns
```

Which is **mental calorie explosion**.

Greenbox should follow:

### rule

```
every interaction = binary decision
```

Example:

Bad:

```
set drift threshold
set jitter
set noise
set retry
set backoff
```

Good:

```
🔥 Chaos Mode
ON / OFF
```

Under the hood:

```
sim-drift
sim-jitter
sim-failure
sim-latency
```

But the UI is **1 switch**.

---

# 3. The insane insight: **show value before payment**

In the video they literally **execute trades before charging**:

> we showed the magic moment before the payment and conversions improved 70% 

This is genius psychology.

Now apply this to **Greenbox**.

Instead of:

```
create plugin
configure simulator
run simulation
```

We do:

```
open Greenbox
↓
system already evolving
↓
AI already experimenting
↓
user interferes
```

Meaning:

Greenbox must **start alive**.

Like:

```
🌿 plants already growing
🔥 some dying
💧 irrigation broken
🤖 AI fixing it
```

User enters **mid-simulation**.

This is exactly the same trick.

---

# 4. Focus on ONE thing (not ten)

He says:

> if you try to catch two rabbits you catch none 

This applies brutally to our project.

Right now we have many possibilities:

```
plugin platform
AI dev tool
simulation engine
automation system
app ecosystem
```

But **Greenbox onboarding must only communicate one thing**.

Best candidate:

```
Grow software like plants.
```

Everything else is hidden.

---

# 5. The portfolio trick → plugin discovery

He explains they **only show 4 portfolios**, even though they have hundreds:

> showing all options reduced conversions by 70% 

This maps perfectly to our **plugin ecosystem**.

Bad UI:

```
200 plugins
choose one
```

Good UI:

```
4 experiments
```

Example:

```
🌱 Growth Garden
🔥 Chaos Garden
🧠 AI Garden
📡 Integration Garden
```

Each is actually:

```
bundle of plugins
```

---

# 6. Binary decisions

They try to make every question:

```
YES / NO
```

Apply this to **Greenbox control panel**.

Bad:

```
choose retry policy
choose simulation mode
choose drift curve
```

Good:

```
🧪 Test system?
YES / NO
```

---

# 7. Superuser economics

He explains something important:

> revenue retention improved when superusers could spend up to 6x the base price 

Translate this to our system.

Greenbox should have **layers of power**.

Example:

Level 1

```
simple garden
```

Level 2

```
custom simulations
```

Level 3

```
AI plugin creation
```

Level 4

```
full system mutation
```

Superusers = **builders**.

---

# 8. The deeper insight: **curiosity culture**

The hiring philosophy:

> they look for obsession and curiosity rather than resume 

For us this translates into something interesting:

Greenbox should reward **curiosity loops**.

Example:

User presses:

```
🔥 stress system
```

AI replies:

```
Latency increased
Would you like to:
• add queue
• scale workers
• ignore
```

User explores.

This becomes **learning through play**.

---

# 9. This aligns perfectly with our architecture

Our architecture already creates **cognitive islands**:

```
plugins
cores
gateways
```

Greenbox becomes the **interactive map** of those islands.

Instead of reading architecture docs, users **play the system**.

---

# 10. The crazy meta insight

Their product works because it gives **instant power**.

The user feels like:

```
I'm insider trading
```

Even though technically they're just copying public filings.

Greenbox must produce the same feeling:

```
I'm evolving software ecosystems
```

Even if under the hood it's just:

```
plugin toggles
AI refactors
simulations
```

Perception matters.

---

# 11. What this changes in AGENTS architecture

Agents should optimize for:

```
MAGIC MOMENT CREATION
```

not just

```
feature implementation
```

Agents should ask:

```
Does this create a wow moment?
```

If not:

```
simplify
```

---

# 12. The biggest opportunity

Combine:

```
Greenbox
+
AI coding agents
+
plugin architecture
```

You get something extremely rare:

```
SELF-EVOLVING SOFTWARE LAB
```

User plays.

AI modifies code.

System evolves.

---

# 13. The final insight

Their onboarding principle:

> maximize the emotional response 

Greenbox should trigger:

```
😳
🤯
"Wait… it just changed the system"
```

Not:

```
"Okay I configured something"
```

---

# 14. The scary realization

If we implement this correctly:

Greenbox won't feel like:

```
developer tool
```

It will feel like:

```
Factorio
+
SimCity
+
AI coding
```

That is **extremely addictive**.

---

# If you want, I can also show something extremely interesting:

How the **Autopilot onboarding trick maps directly to an AI development workflow**.

And it leads to a **radical idea**:

Greenbox could let users **accidentally ship real features** while playing.

Which is honestly **insane product design**.
