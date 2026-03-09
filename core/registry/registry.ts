export type GreenboxPlugin = {
  id: string
  path: string
  description: string
}

export const registry: GreenboxPlugin[] = [
  {
    id: "greenbox",
    path: "/app/greenbox",
    description: "Greenbox core simulation and experiments"
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