import { getFranchizeBySlug } from '../../actions'
import { CrewFooter } from '../../components/CrewFooter'
import { CrewHeader } from '../../components/CrewHeader'
import { crewPaletteForSurface } from '../../lib/theme'
import { ConfiguratorClient } from './ConfiguratorClient'

interface ConfiguratorPageProps {
  params: Promise<{ slug: string }>
}

export default async function ConfiguratorPage({ params }: ConfiguratorPageProps) {
  const { slug } = await params
  const { crew, items } = await getFranchizeBySlug(slug)
  const surface = crewPaletteForSurface(crew.theme)

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/configurator`} groupLinks={items.map((item) => item.category)} />
      <ConfiguratorClient crew={crew} slug={slug} />
      {/* <CrewFooter crew={crew} />*/}
    </main>
  )
}
