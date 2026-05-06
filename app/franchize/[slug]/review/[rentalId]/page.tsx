import { getFranchizeBySlug, getRentalReviewContext } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import { crewPaletteForSurface } from "../../../lib/theme";
import { ReviewForm } from "./ReviewForm";

interface RentalReviewPageProps {
  params: Promise<{ slug: string; rentalId: string }>;
}

export default async function RentalReviewPage({ params }: RentalReviewPageProps) {
  const { slug, rentalId } = await params;
  const [{ crew, items }, context] = await Promise.all([
    getFranchizeBySlug(slug),
    getRentalReviewContext({ slug, rentalId }),
  ]);
  const surface = crewPaletteForSurface(crew.theme);
  const rental = context.rental;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} groupLinks={items.map((item) => item.category)} />
      <section className="px-4 py-8">
        {rental ? (
          <ReviewForm
            slug={crew.slug || slug}
            rentalId={rental.rentalId}
            bikeTitle={rental.bikeTitle}
            status={rental.status}
            renterUserId={rental.userId}
            theme={crew.theme}
            existingReview={rental.existingReview}
          />
        ) : (
          <div className="mx-auto max-w-xl rounded-3xl border p-5" style={surface.card}>
            <h1 className="text-xl font-semibold">Отзыв недоступен</h1>
            <p className="mt-2 text-sm" style={surface.mutedText}>{context.error || "Проверьте ссылку аренды."}</p>
          </div>
        )}
      </section>
      <CrewFooter crew={crew} />
    </main>
  );
}
