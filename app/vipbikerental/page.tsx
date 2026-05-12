import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import { VipBikeRentalClient } from "./VipBikeRentalClient";

export default async function HomePage() {
  const theme = await getCrewPaletteBySlug("vip-bike");
  return <VipBikeRentalClient items={[]} theme={theme} />;
}
