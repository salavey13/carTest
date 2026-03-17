export const plugin = {
  name: "greenbox",
  description: "Korean-level 3D hydroponic Tamagotchi for mom — already running before you even sign up",
  version: "1.0",
  uses: [
    "core.registry",
    "core.garden",
    "gateway.telegram",
    "infrastructure.supabase"
  ],
  exports: [
    "createGardenAction",
    "seedGardenAction",
    "plantJitterCron",
    "magicMomentDemo"
  ],
  capabilities: ["instant-3d-korean-garden", "genie-lamp-fake-doors", "bathroom-test-onboarding", "demon-evolution-magic"]
}