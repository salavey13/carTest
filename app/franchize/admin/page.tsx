import { redirect } from "next/navigation";

interface FranchizeAdminRedirectPageProps {
  searchParams: Promise<{ slug?: string; edit?: string }>;
}

export default async function FranchizeAdminRedirectPage({ searchParams }: FranchizeAdminRedirectPageProps) {
  const { slug, edit } = await searchParams;
  const targetSlug = slug?.trim() || "vip-bike";
  const editSuffix = edit ? `?edit=${encodeURIComponent(edit)}` : "";
  redirect(`/franchize/${targetSlug}/admin${editSuffix}`);
}
