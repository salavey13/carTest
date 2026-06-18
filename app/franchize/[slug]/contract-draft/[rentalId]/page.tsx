// /app/franchize/[slug]/contract-draft/[rentalId]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from '@supabase/supabase-js';
import { ContractDraftReview } from "@/app/franchize/components/ContractDraftReview";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import type { FranchizeTheme } from "@/app/franchize/actions";

interface ContractDraftPageProps {
  params: {
    slug: string;
    rentalId: string;
  };
}

export default async function ContractDraftPage({ params }: ContractDraftPageProps) {
  const { slug, rentalId } = params;
  const resolvedSlug = await Promise.resolve(slug);
  const resolvedRentalId = await Promise.resolve(rentalId);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch rental with draft and vehicle
  const { data: rental } = await supabase
    .from('rentals')
    .select('*, vehicle:cars(*), crew:crews(*)')
    .eq('rental_id', resolvedRentalId)
    .single();

  if (!rental || rental.crew?.slug !== resolvedSlug) {
    notFound();
  }

  const draft = rental.metadata?.contract_draft;
  if (!draft) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Договор не найден</h1>
        <p className="text-sm text-gray-500 mt-2">
          Черновик договора не найден для этой аренды.
        </p>
      </div>
    );
  }

  // Fetch contract artifact if approved
  const contractKey = rental.metadata?.contract_key;
  let downloadUrl: string | undefined;
  if (draft.status === 'approved' && contractKey) {
    // Get storage path from rental_contract_artifacts
    const { data: artifact } = await supabase
      .from('rental_contract_artifacts')
      .select('storage_path')
      .eq('contract_key', contractKey)
      .maybeSingle();

    if (artifact?.storage_path) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('rental-contracts')
        .getPublicUrl(artifact.storage_path);
      downloadUrl = publicUrl;
    }
  }

  // Fetch crew secrets for preview
  const { data: crewSecrets } = await supabase
    .schema('private')
    .from('crew_secrets')
    .select('contract_defaults')
    .eq('crew_slug', resolvedSlug)
    .maybeSingle();

  const orgSecrets = crewSecrets?.contract_defaults
    ? (typeof crewSecrets.contract_defaults === 'string'
        ? JSON.parse(crewSecrets.contract_defaults)
        : crewSecrets.contract_defaults)
    : {};

  const theme: FranchizeTheme = (rental.crew?.metadata?.franchize?.theme)
    ? rental.crew.metadata.franchize.theme
    : DEFAULT_FRANCHIZE_THEME;

  return (
    <ContractDraftReview
      rental={rental}
      draft={draft}
      bike={rental.vehicle}
      crewSlug={resolvedSlug}
      orgSecrets={orgSecrets}
      theme={theme}
      contractKey={contractKey}
      downloadUrl={downloadUrl}
    />
  );
}
