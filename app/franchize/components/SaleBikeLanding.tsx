import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { SaleBikeLandingClient } from "@/app/franchize/components/SaleBikeLandingClient";

export function SaleBikeLanding({ crew, item }: { crew: FranchizeCrewVM; item: CatalogItemVM }) {
  return (
    <section className="min-h-screen pb-28 pt-3 sm:pt-6">
      <h1 className="sr-only">{item.title}</h1>
      <SaleBikeLandingClient crew={crew} item={item} />
    </section>
  );
}
