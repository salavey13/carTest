import type { Metadata } from "next";
import { buildFranchizeSectionMetadata } from "../metadata";
import { FranchizeProfileClient } from "./ProfileClient";

interface FranchizeProfilePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Профиль райдера",
    sectionDescription: "Персональный профиль франшизы: достижения, активность, сохранённые данные и быстрые переходы к арендам.",
    pathSuffix: "/profile",
  });
}

export default function FranchizeProfilePage() {
  return <FranchizeProfileClient />;
}
