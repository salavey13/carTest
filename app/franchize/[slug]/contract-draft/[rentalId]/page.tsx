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

  // Fetch rental with draft
  const { data: rental } = await supabase
    .from('rentals')
    .select('*, vehicle:cars(*), crew:crews(*)')
    .eq('rental_id', resolvedRentalId)
    .single();

  if (!rental || rental.crew?.slug !== resolvedSlug) {
    notFound();
  }

  const draft = rental.metadata?.contract_draft;
  if (!draft || draft.status !== 'pending') {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Договор не найден или уже обработан</h1>
      </div>
    );
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
    />
  );
}
