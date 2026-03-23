import CreateFranchizeForm from "@/app/franchize/create/CreateFranchizeForm";

export default async function FranchizeCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ slug?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-[#07080C] dark:text-white md:px-6">
      <CreateFranchizeForm initialSlug={resolvedSearchParams.slug || ""} />
    </main>
  );
}
