import { redirect } from "next/navigation";

interface FranchizeOrderRedirectPageProps {
  params: Promise<{ id: string }>;
}

export default async function FranchizeOrderRedirectPage({ params }: FranchizeOrderRedirectPageProps) {
  const { id } = await params;
  redirect(`/franchize/vip-bike/order/${id}`);
}
