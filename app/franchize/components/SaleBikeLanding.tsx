import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { SaleBikeLandingClient } from "@/app/franchize/components/SaleBikeLandingClient";
import { buildSaleBuySectionId } from "@/app/franchize/lib/sale-anchors";

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
    <section
      id={buildSaleBuySectionId(item.id)}
      className="min-h-screen scroll-mt-24 pb-28 pt-3 sm:pt-6"
    >
      <SaleBikeLandingClient
        crew={crew}
        item={item}
        vsItem={vsItem}
        otherSaleBikes={otherSaleBikes}
      />
    </section>
  );
}
