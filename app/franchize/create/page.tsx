import CreateFranchizeForm from "@/app/franchize/create/CreateFranchizeForm";

export default async function FranchizeCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ slug?: string | string[] }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawSlug = Array.isArray(resolvedSearchParams.slug)
    ? resolvedSearchParams.slug[0]
    : resolvedSearchParams.slug;
  const initialSlug = typeof rawSlug === "string" ? rawSlug : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-[#07080C] dark:text-white md:px-6">
      <CreateFranchizeForm initialSlug={initialSlug} />
    </main>
  );
}
