import { redirect } from "next/navigation";

interface LegacyAdminFranchizeRedirectPageProps {
  searchParams: Promise<{ slug?: string; edit?: string }>;
}

export default async function AdminFranchizeRedirectPage({ searchParams }: LegacyAdminFranchizeRedirectPageProps) {
  const { slug, edit } = await searchParams;
  const targetSlug = slug?.trim() || "vip-bike";
  const editSuffix = edit ? `?edit=${encodeURIComponent(edit)}` : "";
  redirect(`/franchize/${targetSlug}/admin${editSuffix}`);
}
