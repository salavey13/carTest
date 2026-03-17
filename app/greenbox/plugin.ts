export const plugin = {
  name: "greenbox",
  description:
    "Korean-level 3D hydroponic Tamagotchi for mom — already running before you even sign up",
  version: "1.1",
  uses: ["core.registry", "core.garden", "gateway.telegram", "infrastructure.supabase"],
  exports: ["greenboxPage", "greenboxLayout", "createGardenAction", "seedGardenAction", "plantJitterCron"],
  capabilities: [
    "instant-3d-korean-garden",
    "bathroom-test-onboarding",
    "genie-lamp-fake-doors",
    "greenbox-integration-preparation",
  ],
};
