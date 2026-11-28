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
    // task227b: страница всегда тёмная (#0B0C10 = фолбэк ui-переменных формы).
    // Раньше: bg-slate-100 + тёмное только под .dark — на /franchize/create
    // класса .dark нет, форма валилась в «светло-тёмный винегрет».
    <main className="min-h-screen bg-[#0B0C10] px-4 py-6 text-[#F2F2F3] md:px-6">
      <CreateFranchizeForm initialSlug={initialSlug} />
    </main>
  );
}
