import type { Metadata } from "next";
import { FranchizeAdminClient } from "@/app/franchize/components/FranchizeAdminClient";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeSlugAdminPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Админ-панель экипажа",
    sectionDescription: "Операторская панель настройки франшизной витрины, каталога, заказов и отзывов.",
    pathSuffix: "/admin",
  });
}

export default async function FranchizeSlugAdminPage({ params, searchParams }: FranchizeSlugAdminPageProps) {
  const { slug } = await params;
  const { edit } = await searchParams;

  return <FranchizeAdminClient initialSlug={slug} editId={edit} />;
}
