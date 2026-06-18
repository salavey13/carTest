// /app/franchize/[slug]/contract-draft/[rentalId]/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from '@supabase/supabase-js';
import { ContractDraftReview } from "@/app/franchize/components/ContractDraftReview";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";
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

  // Verify user authentication
  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE);
  const userId = verifyTelegramActorCookieValue(actorCookie?.value);

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

  // Access control: only renter or crew owner can view
  let isAuthorized = false;
  if (userId) {
    // Check if user is the renter
    if (rental.user_id === userId) {
      isAuthorized = true;
    }
    // Check if user is crew owner
    if (!isAuthorized && rental.crew?.owner_id) {
      const { data: crewMember } = await supabase
        .from('crew_members')
        .select('user_id, role')
        .eq('user_id', userId)
        .eq('crew_id', rental.crew.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (crewMember) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Доступ запрещен</h1>
        <p className="text-sm text-gray-500 mt-2">
          У вас нет прав для просмотра этого договора.
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
      .schema('private')
      .from('rental_contract_artifacts')
      .select('storage_path')
      .eq('contract_key', contractKey)
      .maybeSingle();

    if (artifact?.storage_path) {
      // Create signed URL for private storage
      const { data: { signedUrl } } = await supabase
        .storage
        .from('rental-contracts')
        .createSignedUrl(artifact.storage_path, 60 * 60); // 1 hour expiry
      downloadUrl = signedUrl;
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
