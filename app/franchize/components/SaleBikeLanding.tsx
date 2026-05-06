import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { SaleBikeLandingClient } from "@/app/franchize/components/SaleBikeLandingClient";

export function SaleBikeLanding({
  crew,
  item,
  vsItem = null,
  otherSaleBikes = [],
}: {
  crew: FranchizeCrewVM;
  item: CatalogItemVM;
  vsItem?: CatalogItemVM | null;
  otherSaleBikes?: CatalogItemVM[];
}) {
  return (
    <section className="min-h-screen pb-28 pt-3 sm:pt-6">
      <h1 className="sr-only">{item.title}</h1>
      <SaleBikeLandingClient
        crew={crew}
        item={item}
        vsItem={vsItem}
        otherSaleBikes={otherSaleBikes}
      />
    </section>
  );
}
