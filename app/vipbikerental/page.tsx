import { getFranchizeBySlug } from "@/app/franchize/actions";
import { VipBikeRentalClient } from "./VipBikeRentalClient";

export default async function HomePage() {
  // Use full franchize system to get crew data and items
  const { crew, items } = await getFranchizeBySlug("vip-bike");
  return <VipBikeRentalClient crew={crew} items={items} theme={crew.theme} />;
}
