import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewHeader } from "../../components/CrewHeader";
import { crewPaletteForSurface } from "../../lib/theme";
import { ConfiguratorClient } from "./ConfiguratorClient";
import Link from "next/link";
import { buildFranchizeSectionMetadata } from "../metadata";

interface ConfiguratorPageProps {
  params: Promise<{ slug: string }>;
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Конфигуратор электробайка",
    sectionDescription: "Сборка электромотоцикла под райдера: сценарий, комплектация и заявка экипажу.",
    pathSuffix: "/configurator",
  });
}

export default async function ConfiguratorPage({
  params,
}: ConfiguratorPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${crew.slug || slug}/configurator`}
        groupLinks={items.map((item) => item.category)}
      />
      <ConfiguratorClient crew={crew} slug={slug} />
    </main>
  );
}
