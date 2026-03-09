export type GreenboxPlugin = {
  id: string
  path: string
  description: string
}

export const registry: GreenboxPlugin[] = [
  {
    id: "greenbox",
  path: "/app/greenbox",
  description: "Korean 3D 24/360 Tamagotchi garden that’s already running when you open the app — magic moment first"
},
  {
    id: "franchize",
    path: "/app/franchize",
    description: "Franchize ecosystem tools"
  },
  {
    id: "strikeball",
    path: "/app/strikeball",
    description: "Strikeball project"
  }
]