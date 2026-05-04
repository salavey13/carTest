import { getFranchizeBySlug } from '../../actions'
import { CrewFooter } from '../../components/CrewFooter'
import { CrewHeader } from '../../components/CrewHeader'
import { crewPaletteForSurface } from '../../lib/theme'
import { ConfiguratorClient } from './ConfiguratorClient'
import Link from 'next/link'

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
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
        <div className="rounded-3xl border border-white/15 bg-black/30 p-5 backdrop-blur-sm sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Configurator onboarding</p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Как оформить заказ электромотоцикла без ошибок</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/75 sm:text-base">
            Сначала прочитай вводную по сценариям, затем собери конфиг и только потом переходи к корзине и оформлению.
            Для тест-драйва лучше начать с аренды, для покупки — продолжать здесь в режиме продажи.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
              <p className="text-white">1) Вводная</p>
              <p className="mt-1">Сравни аренду и покупку, чтобы выбрать подходящий сценарий.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
              <p className="text-white">2) Конфигурация</p>
              <p className="mt-1">Выбери модель, батарею, мощность, подвеску, допы и экип.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
              <p className="text-white">3) Корзина и заказ</p>
              <p className="mt-1">Проверь состав, стоимость и отправь заказ на подтверждение.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="inline-flex rounded-xl border border-white/30 px-3 py-2 text-sm text-white hover:bg-white hover:text-black" href={`/franchize/${crew.slug || slug}/electro-enduro`}>
              Открыть Electro-Enduro раздел
            </Link>
            <Link className="inline-flex rounded-xl border border-white/30 px-3 py-2 text-sm text-white hover:bg-white hover:text-black" href={`/franchize/${crew.slug || slug}`}>
              Перейти в аренду (тест-драйв)
            </Link>
          </div>
        </div>
      </section>
      <ConfiguratorClient crew={crew} slug={slug} />
      <CrewFooter crew={crew} />
    </main>
  )
}
