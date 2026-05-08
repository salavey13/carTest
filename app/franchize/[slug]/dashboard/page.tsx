import type { Metadata } from "next";

import { FranchizeCloserDashboardClient } from "@/app/franchize/components/FranchizeCloserDashboardClient";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeSlugDashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FranchizeSlugDashboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Operator closer dashboard",
    sectionDescription:
      "Отдельная панель горячих franchize leads, Telegram replies и ручных closing actions.",
    pathSuffix: "/dashboard",
  });
}

export default async function FranchizeSlugDashboardPage({
  params,
}: FranchizeSlugDashboardPageProps) {
  const { slug } = await params;
  return <FranchizeCloserDashboardClient initialSlug={slug} />;
}
