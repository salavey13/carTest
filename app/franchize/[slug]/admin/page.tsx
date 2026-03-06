import { FranchizeAdminClient } from "@/app/franchize/components/FranchizeAdminClient";

interface FranchizeSlugAdminPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function FranchizeSlugAdminPage({ params, searchParams }: FranchizeSlugAdminPageProps) {
  const { slug } = await params;
  const { edit } = await searchParams;

  return <FranchizeAdminClient initialSlug={slug} editId={edit} />;
}
