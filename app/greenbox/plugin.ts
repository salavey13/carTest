export const plugin = {
  name: "greenbox",

  description: "Hydroponic simulation interface",

  uses: [
    "core.garden",
    "core.events",
    "gateway.telegram"
  ],

  exports: [
    "createGarden",
    "seedGarden"
  ]
}