"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
} from '../lib/rental-contract-types';
import { buildRentalContractVariables } from '@/app/lib/rental-contract-vars';
import {
  renderTemplateToDocx,
  uploadDocxToStorage,
  sendDocxViaTelegram,
} from '../lib/docx-capability';
import {
  checkFranchizeCarsAvailability as checkFranchizeCarsAvailabilityRuntime,
  getFranchizeRentalCard as getFranchizeRentalCardRuntime,
  getFranchizeSuccessfulRentals as getFranchizeSuccessfulRentalsRuntime,
  reconcileRentalContractVerifierAttachment as reconcileRentalContractVerifierAttachmentRuntime,
} from "@/app/franchize/actions-runtime";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Export types
export type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
};

// ============================================================================
// checkRentalOwnershipForQr
// ============================================================================

interface RentalOwnershipInput {
  bikeId: string;
  docSha256: string;
  actorTelegramUserId: string;
}

interface RentalOwnershipResult {
  success: true;
  isOwner: boolean;
  rentalId?: string;
  crewSlug?: string;
}

interface RentalOwnershipError {
  success: false;
  error: string;
}

export async function checkRentalOwnershipForQr(
  input: RentalOwnershipInput
): Promise<RentalOwnershipResult | RentalOwnershipError> {
  const { bikeId, docSha256, actorTelegramUserId } = input;

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    const { data: bike } = await supabase
      .from('cars')
      .select('crew_id')
      .eq('id', bikeId)
      .single();

    if (!bike) {
      return { success: true, isOwner: false };
    }

    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', actorTelegramUserId)
      .eq('crew_id', bike.crew_id)
      .maybeSingle();

    const isOwner = crewMember?.role === 'owner';

    if (!isOwner) {
      return { success: true, isOwner: false };
    }

    const { data: crew } = await supabase
      .from('crews')
      .select('slug')
      .eq('id', bike.crew_id)
      .single();

    if (!crew) {
      return { success: true, isOwner: false };
    }

    const { data: rental } = await supabase
      .from('rentals')
      .select('rental_id')
      .eq('metadata->>contract_key', docSha256)
      .maybeSingle();

    if (!rental) {
      return { success: true, isOwner: true, crewSlug: crew.slug };
    }

    return {
      success: true,
      isOwner: true,
      rentalId: rental.rental_id,
      crewSlug: crew.slug,
    };
  } catch (error) {
    console.error('[checkRentalOwnershipForQr] Error:', error);
    return { success: false, error: 'Failed to check ownership' };
  }
}

// ============================================================================
// submitContractDraft
// ============================================================================

export async function submitContractDraft(
  input: SubmitContractDraftInput
): Promise<SubmitContractDraftResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const draftId = `draft-${input.rentalId}-${Date.now()}`;

  try {
    // Fetch rental with vehicle
    const { data: rental } = await supabase
      .from('rentals')
      .select('*, vehicle:cars(*)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    // Fetch crew through vehicle
    const { data: crew } = await supabase
      .from('crews')
      .select('id, owner_id, slug')
      .eq('id', rental.vehicle?.crew_id)
      .maybeSingle();

    if (!crew) {
      return { success: false, error: `Crew not found for vehicle` };
    }

    if (rental.user_id !== input.actorTelegramUserId) {
      return { success: false, error: 'Only the renter can submit contract drafts' };
    }

    const contractDraft: ContractDraftData = {
      status: 'pending',
      submitted_at: new Date().toISOString(),
      submitted_by: input.actorTelegramUserId,
      renterData: input.renterData,
      equipmentData: input.equipmentData,
      pickupData: input.pickupData,
    };

    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...(rental.metadata || {}),
          contract_draft: contractDraft,
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      return { success: false, error: `Failed to save draft: ${updateError.message}` };
    }

    const crewOwnerChatId = crew.owner_id;

    if (crewOwnerChatId) {
      const draftDetailsUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/franchize/${input.crewSlug}/contract-draft/${input.rentalId}`;

      const message = `
📄 <b>Запрос на утверждение договора аренды</b>

<b>Арендатор:</b> ${input.renterData.full_name}
<b>Паспорт:</b> ${input.renterData.passport}
<b>Дата начала:</b> ${rental.requested_start_date || rental.agreed_start_date}
<b>Дата окончания:</b> ${rental.requested_end_date || rental.agreed_end_date}

<b>Оборудование:</b>
• Ключи: ${input.equipmentData.keys_count} шт.
• Шлемы: ${input.equipmentData.helmets_count} шт.
${input.equipmentData.charger ? '• Зарядка\n' : ''}${input.equipmentData.lock ? '• Замок\n' : ''}

<b>Примечания при выдаче:</b>
${input.pickupData.damage_notes_at_delivery}

—
Откройте в браузере для подробностей:
${draftDetailsUrl}
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📄 Открыть в браузере', url: draftDetailsUrl },
          ],
          [
            { text: '✓ Утвердить', callback_data: `approve_contract:${input.rentalId}:${draftId}` },
            { text: '✗ Отклонить', callback_data: `decline_contract:${input.rentalId}:${draftId}` },
          ],
        ],
      };

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: crewOwnerChatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }),
      });

      if (!response.ok) {
        console.error('[submitContractDraft] Failed to send Telegram message');
      }
    }

    return {
      success: true,
      draftId,
      approvalRequestSent: Boolean(crewOwnerChatId),
    };

  } catch (error) {
    console.error('[submitContractDraft] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// approveContract
// ============================================================================

function formatDateRu(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatTimeRu(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export async function approveContract(
  input: ApproveContractInput
): Promise<ApproveContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const contractKey = `rental-${input.bikeId || input.rentalId}-${Date.now()}`;

  try {
    const { data: crew } = await supabase
      .from('crews')
      .select('id')
      .eq('slug', input.crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: `Crew not found: ${input.crewSlug}` };
    }

    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', input.actorTelegramUserId)
      .eq('crew_id', crew.id)
      .maybeSingle();

    if (!crewMember || crewMember.role !== 'owner') {
      return { success: false, error: 'Only crew owner can approve contracts' };
    }

    const { data: rental } = await supabase
      .from('rentals')
      .select('*, vehicle:cars(*), crew:crews(*)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    const { data: crewSecretsRow } = await supabase
      .schema('private')
      .from('crew_secrets')
      .select('contract_defaults')
      .eq('crew_slug', input.crewSlug)
      .maybeSingle();

    const orgSecrets = crewSecretsRow?.contract_defaults
      ? (typeof crewSecretsRow.contract_defaults === 'string'
          ? JSON.parse(crewSecretsRow.contract_defaults)
          : crewSecretsRow.contract_defaults)
      : {};

    const bike = rental.vehicle;

    // ── Map web-app data shapes → canonical builder inputs ──

    // Dates → RentalPeriod
    const period = {
      startDate: formatDateRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      startTime: formatTimeRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      endDate: formatDateRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
      endTime: formatTimeRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
    };

    // Passport: "4509 123456" → series "4509" + number "123456"
    const passportParts = (draft.renterData.passport || '').trim().split(/\s+/);

    // CrewSecrets from orgSecrets (contract_defaults JSON)
    const crewSecretsForBuilder = {
      legalAddress: orgSecrets.legalAddress || 'г. Нижний Новгород',
      returnAddress: orgSecrets.returnAddress || '',
      issuerName: orgSecrets.issuerName || 'Менеджер',
      issuerRepresentative: orgSecrets.issuerRepresentative || '',
      signatoryRole: orgSecrets.signatoryRole || 'Менеджер Мотосалона',
      organizationRepresentative: orgSecrets.organizationRepresentative || '',
      organizationName: orgSecrets.organizationName || 'ИП Воробьева Р.В.',
      organizationShort: orgSecrets.organizationShort || 'ИП Воробьева Р.В.',
      ogrnip: orgSecrets.ogrnip || '326527500025145',
      inn: orgSecrets.inn || '525813643035',
      bankAccount: orgSecrets.bankAccount || '40802810942710013083',
      bankName: orgSecrets.bankName || 'Волго-Вятский Банк ПАО Сбербанк',
      bankCity: orgSecrets.bankCity || 'г. Нижний Новгород',
      bankCorrAccount: orgSecrets.bankCorrAccount || '30101810900000000603',
      email: orgSecrets.email || '',
      // Pass through the raw contract_defaults so getContractDefault can read overage/etc.
      contractDefaults: orgSecrets,
    };

    const templateVars = buildRentalContractVariables({
      renter: {
        fullName: draft.renterData.full_name,
        birthDate: draft.renterData.birth_date || '',
        phone: draft.renterData.phone,
        email: draft.renterData.email,
        passportSeries: passportParts[0] || '',
        passportNumber: passportParts.length > 1 ? passportParts.slice(1).join(' ') : passportParts[0] || '',
        passportIssueDate: draft.renterData.passport_issue_date || '',
        registration: draft.renterData.registration || '',
        address: draft.renterData.address || draft.renterData.registration || '',
        driverLicenseNumber: draft.renterData.driver_license || '',
      },
      bike: {
        id: bike.id,
        make: bike.make,
        model: bike.model,
        specs: bike.specs || {},
        type: bike.type,
      },
      period,
      crewSecrets: crewSecretsForBuilder,
      meta: {
        contractNumber: contractKey,
        signatureFingerprint: 'web-app-approved',
        renterSignature: 'электронное согласие',
        documentKey: contractKey,
      },
      equipment: {
        helmets: draft.equipmentData.helmets_count || 0,
        gloves: draft.equipmentData.gloves_count || 0,
        jacket: draft.equipmentData.jacket || false,
        boots: draft.equipmentData.boots || false,
        net: draft.equipmentData.net || false,
        backpack: draft.equipmentData.backpack || false,
        bag: draft.equipmentData.bag || false,
        charger: draft.equipmentData.charger || false,
      },
      odometerBefore: draft.pickupData.odometer_km || 0,
    });

    const dates = { start: period.startDate, end: period.endDate };

    const { buffer, sha256 } = await renderTemplateToDocx(
      templateVars as unknown as Record<string, string>
    );

    const { storagePath, downloadUrl } = await uploadDocxToStorage({
      crewSlug: input.crewSlug,
      contractKey,
      buffer,
      metadata: { crew_id: crewMember.crew_id },
    });

    const { error: artifactError } = await supabase
      .schema('private')
      .from('rental_contract_artifacts')
      .insert({
        contract_key: contractKey,
        requested_bike_id: rental.vehicle_id,
        resolved_bike_id: bike.id,
        telegram_chat_id: draft.submitted_by,
        renter_full_name: draft.renterData.full_name,
        rent_start_date: dates.start,
        rent_end_date: dates.end,
        original_sha256: sha256,
        rental_id: input.rentalId,
        storage_path: storagePath,
        crew_id: crewMember.crew_id,
      });

    if (artifactError) {
      console.error('[approveContract] Failed to save artifact:', artifactError);
    }

    const filename = `rental-contract-${bike.make}-${bike.model}-${dates.start}.docx`;
    const caption = `✅ <b>Договор аренды утвержден</b>\n${bike.make} ${bike.model}\n${dates.start} — ${dates.end}\n\nСкачать: ${downloadUrl}`;

    await sendDocxViaTelegram({
      buffer,
      filename,
      chatIds: [draft.submitted_by, input.actorTelegramUserId],
      caption,
    });

    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'approved' as const },
          contract_key: contractKey,
          contract_sha256: sha256,
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      console.error('[approveContract] Failed to update rental metadata:', updateError);
    }

    return {
      success: true,
      downloadUrl,
      storagePath,
      contractKey,
      sha256,
    };

  } catch (error) {
    console.error('[approveContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// declineContract
// ============================================================================

export async function declineContract(
  input: DeclineContractInput
): Promise<DeclineContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  try {
    // First fetch rental to get crew_id
    const { data: rental } = await supabase
      .from('rentals')
      .select('metadata, user_id, crew_id')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    // Now check if user is owner of THIS rental's crew
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', input.actorTelegramUserId)
      .eq('crew_id', rental.crew_id)
      .eq('role', 'owner')
      .maybeSingle();

    if (!crewMember) {
      return { success: false, error: 'Only crew owner can decline contracts' };
    }

    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'declined' as const },
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      return { success: false, error: `Failed to update draft: ${updateError.message}` };
    }

    const message = `
❌ <b>Запрос на договор отклонен</b>

${input.reason ? `<b>Причина:</b> ${input.reason}` : ''}

Пожалуйста, свяжитесь с владельцем техники для уточнения деталей.
`.trim();

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: rental.user_id,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error('[declineContract] Failed to send Telegram message');
    }

    return { success: true };

  } catch (error) {
    console.error('[declineContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============================================================================
// sendRentalMessage — send a message from renter to crew owner via TG bot
// ============================================================================

export async function sendRentalMessage(
  rentalId: string,
  message: string,
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!message?.trim()) {
      return { success: false, error: "Сообщение не может быть пустым" };
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: rental, error } = await supabaseAdmin
      .from("rentals")
      .select("owner_id, rental_id")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (error || !rental) {
      return { success: false, error: "Аренда не найдена" };
    }

    const ownerChatId = rental.owner_id;
    if (!ownerChatId) {
      return { success: false, error: "Владелец не найден" };
    }

    const forwardApiUrl =
      process.env.FORWARD_TELEGRAM_API ||
      "https://v0-car-test.vercel.app/api/forward-telegram";

    const resp = await fetch(forwardApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ownerChatId,
        method: "sendMessage",
        payload: {
          text: `📩 Сообщение по аренде #${rentalId.slice(0, 8)}:\n\n${message.trim()}`,
          parse_mode: "Markdown",
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[sendRentalMessage] forward-telegram error:", errText);
      return { success: false, error: "Не удалось отправить сообщение" };
    }

    return { success: true };
  } catch (error) {
    console.error("[sendRentalMessage] Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// Legacy runtime exports
// ============================================================================

export async function reconcileRentalContractVerifierAttachment(input: {
  rentalId: string;
  actorTelegramUserId?: string;
}) {
  return reconcileRentalContractVerifierAttachmentRuntime(input);
}

export async function checkFranchizeCarsAvailability(input: unknown) {
  return checkFranchizeCarsAvailabilityRuntime(input);
}

export async function getFranchizeRentalCard(slug: string, rentalId: string) {
  return getFranchizeRentalCardRuntime(slug, rentalId);
}

export async function getFranchizeSuccessfulRentals(input: unknown) {
  return getFranchizeSuccessfulRentalsRuntime(input);
}
