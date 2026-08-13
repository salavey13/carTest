// app/franchize/[slug]/commissions/page.tsx
import { Suspense } from "react";
import { CommissionsClient } from "./CommissionsClient";
import { getFranchizeBySlug } from "../../actions";

interface CommissionsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CommissionsPage({ params }: CommissionsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
        <CommissionsClient slug={slug} crew={crew} />
      </Suspense>
    </div>
  );
}
