import { getFranchizeBySlug } from "@/app/franchize/actions";
import { VipBikeRentalClient } from "./VipBikeRentalClient";

export default async function HomePage() {
  const { crew } = await getFranchizeBySlug("vip-bike");
  return <VipBikeRentalClient items={[]} theme={crew.theme} />;
}
