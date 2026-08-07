"use server";

import { supabaseAdmin, createInvoice } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { sendComplexMessage } from "../webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { Database } from "@/types/database.types";
import { sendTelegramInvoice } from "@/app/actions";
import { CrewWithCounts, CrewDetails, CommandDeckData, MapPreset, VehicleWithStatus, VehicleCalendar, RentalDetails, UserRentalDashboard, TopFleet, TopCrew } from '@/lib/types';
import type { BookingInput, BookingResult } from './types';
import { cookies } from "next/headers";
import { notifyAdmin } from "@/app/actions";

type Vehicle = Database['public']['Tables']['cars']['Row'];

type MinimalRental = {
  rental_id: string;
  status: string;
};

type RentalLifecycleEvent = "rental_archived" | "pickup_confirmed" | "return_confirmed";

const RENTAL_EVENT_LABELS: Record<RentalLifecycleEvent, string> = {
  rental_archived: "Бронь отменена и перенесена в архив",
  pickup_confirmed: "Выдача техники подтверждена",
  return_confirmed: "Возврат техники подтверждён",
};

async function notifyRentalLifecycle(rentalId: string, event: RentalLifecycleEvent): Promise<void> {
  const { data: rental, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, owner_id, status, payment_status")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (error || !rental) return;

  const userIds = [rental.user_id, rental.owner_id].filter((id): id is string => typeof id === "string" && id.length > 0);
  if (!userIds.length) return;

  const { data: recipients } = await supabaseAdmin
    .from("profiles")
    .select("user_id, telegram_id")
    .in("user_id", userIds);

  const eventLabel = RENTAL_EVENT_LABELS[event] ?? event;
  const text = [
    "🚦 Обновление аренды",
    `#${rental.rental_id}`,
    `Событие: ${eventLabel}`,
    `Текущий статус: ${rental.status}`,
    `Оплата: ${rental.payment_status}`,
  ].join("\n");
  const notifyTargets = Array.from(
    new Set(
      (recipients ?? [])
        .map((profile) => String(profile.telegram_id || "").trim())
        .filter(Boolean),
    ),
  );

  await Promise.allSettled(notifyTargets.map((chatId) => sendComplexMessage(chatId, text)));
}

/**
 * БЕЗОПАСНО и ЭФФЕКТИВНО получает минимальный список аренд для UI индикаторов.
 * Использует существующую RPC функцию с флагом p_minimal: true.
 */
export async function getMinimalRentalsForIndicator(userId: string, crewIds: string[]): Promise<{ 
  success: boolean; 
  data?: MinimalRental[]; 
  error?: string; 
}> {
    noStore(); // Гарантирует получение свежих данных
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }

    try {
        const { data, error } = await supabaseAdmin.rpc("get_user_rentals_dashboard", {
            p_user_id: userId,
            p_owned_crew_ids: crewIds.length > 0 ? crewIds : null,
            p_minimal: true // <--- Ключевой параметр для легковесности
        });

        if (error) {
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }

        return { success: true, data: data as MinimalRental[] };

    } catch (e) {
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        logger.error(`[getMinimalRentalsForIndicator] Critical failure for user ${userId}:`, e);
        return { success: false, error: message };
    }
}

/**
 * Получает список всех публичных команд с подсчетом участников и техники.
 */
export async function getAllPublicCrews(): Promise<{ 
    success: boolean; 
    data?: CrewWithCounts[];
    error?: string; 
}> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_public_crews');
        if (error) {
            logger.error("Error calling get_public_crews RPC:", error);
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error("Critical failure in getAllPublicCrews action:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred fetching crews." };
    }
}

/**
 * Получает ПОЛНУЮ И АКТУАЛЬНУЮ информацию об одной команде, включая живые статусы участников.
 */
export async function getCrewLiveDetails(slug: string): Promise<{
    success: boolean;
    data?: CrewDetails;
    error?: string;
}> {
    noStore();
    if (!slug) {
        logger.warn("getCrewLiveDetails called without a slug.");
        return { success: false, error: "No slug provided." };
    }

    try {
        const { data, error } = await supabaseAdmin
            .rpc('get_crew_live_details', { p_slug: slug })
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                logger.warn(`[Data Core] Crew with slug '${slug}' not found in DB.`);
                return { success: false, error: "Экипаж не найден." };
            }
            logger.error(`[Data Core] Error calling get_crew_live_details RPC for slug: ${slug}`, error);
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }

        if (!data) {
            logger.warn(`[Data Core] No data returned for crew slug '${slug}', though no error was thrown.`);
            return { success: false, error: "Экипаж не найден (нет данных)." };
        }

        return { success: true, data: data as CrewDetails };

    } catch (error) {
        logger.error(`[Data Core] CRITICAL failure in getCrewLiveDetails for slug: ${slug}`, error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred fetching crew details." };
    }
}

type MapBounds = { top: number; bottom: number; left: number; right: number; };
type PointOfInterest = { id: string; name: string; type: 'point' | 'path' | 'loop'; icon: string; color: string; coords: [number, number][]; };

export async function getUserCrewCommandDeck(userId: string): Promise<{ success: boolean; data?: CommandDeckData | null; error?: string; }> {
    noStore();
    if (!userId) return { success: false, error: "User ID is required." };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_user_crew_command_deck', { p_user_id: userId });
        if (error) throw error;
        const commandDeckData = data && data.length > 0 ? data[0] : null;
        return { success: true, data: commandDeckData };
    } catch (error) {
        logger.error(`[getUserCrewCommandDeck] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVehiclesWithStatus(): Promise<{ success: boolean; data?: VehicleWithStatus[]; error?: string }> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_vehicles_with_status');
        if (error) {
            logger.error('Error calling get_vehicles_with_status RPC:', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        logger.error("Exception in getVehiclesWithStatus action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVehicleCalendar(vehicleId: string): Promise<{ success: boolean; data?: VehicleCalendar[]; error?: string }> {
    noStore();
    if (!vehicleId) return { success: false, error: "Vehicle ID is required." };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_vehicle_calendar', { p_vehicle_id: vehicleId });
        if (error) {
            logger.error(`Error calling get_vehicle_calendar RPC for ${vehicleId}:`, error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        logger.error(`Exception in getVehicleCalendar for ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function createBooking(userId: string, vehicleId: string, startDate: Date, endDate: Date, totalPrice: number) {
    noStore();
    try {
        const { data: vehicle, error: vehicleError } = await supabaseAdmin.from('cars').select('owner_id, crew_id, make, model, image_url').eq('id', vehicleId).single();
        if(vehicleError || !vehicle) throw new Error("Vehicle not found or error fetching owner.");

        const { data, error } = await supabaseAdmin.from('rentals').insert({
            user_id: userId, vehicle_id: vehicleId, owner_id: vehicle.owner_id, crew_id: vehicle.crew_id || null,
            status: 'pending_confirmation',
            payment_status: 'pending', requested_start_date: startDate.toISOString(), requested_end_date: endDate.toISOString(),
            total_cost: totalPrice, interest_amount: Math.ceil(totalPrice * 0.1)
        }).select('rental_id, interest_amount').single();
        
        if (error) throw error;
        if (!data) throw new Error("Booking creation failed to return data.");
        
        const interestAmount = data.interest_amount || 1000;
        const invoiceId = `rental_interest_${data.rental_id}`;
        
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        // 1. Передаем "0" как ID подписки по умолчанию для аренды, чтобы избежать ошибки NOT NULL.
        // 2. В `metadata` ОБЯЗАТЕЛЬНО добавляем `car_id` и `rental_id` для вебхука.
        await createInvoice("car_rental", invoiceId, userId, interestAmount, "0", {
            rental_id: data.rental_id,
            car_id: vehicleId, // <--- КРИТИЧЕСКОЕ ДОБАВЛЕНИЕ
            booking: true,
            car_make: vehicle.make,
            car_model: vehicle.model,
            image_url: vehicle.image_url,
        });

        const description = `Бронь: ${vehicle.make} ${vehicle.model}\nДаты: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\nСумма залога: ${interestAmount} ₽`;
        
        // Примечание: Telegram ожидает сумму в копейках/центах, поэтому делим на 100
        await sendTelegramInvoice(userId, "Подтверждение бронирования", description, invoiceId, interestAmount / 100, 0, vehicle.image_url);
        
        await sendComplexMessage(vehicle.owner_id!, `Новый запрос на бронирование для вашего транспорта (ID: ${vehicleId}) с ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}. Ожидается оплата залога от арендатора.`);

        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating booking for vehicle ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create booking." };
    }
}

export async function getRentalDetails(rentalId: string, userId: string): Promise<{ success: boolean; data?: RentalDetails; error?: string }> {
    noStore();
    if (!rentalId) return { success: false, error: "Missing rental ID." };
    if (!userId) return { success: false, error: "Unauthorized." };
    try {
        const { data, error } = await supabaseAdmin.from('rentals').select(`*, vehicle:cars(*), renter:users!rentals_user_id_fkey(*), owner:users!rentals_owner_id_fkey(*)`).eq('rental_id', rentalId).single();
        if (error) throw error;
        if (data.user_id !== userId && data.owner_id !== userId) return { success: false, error: "Unauthorized access to rental details." };
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching rental details for ${rentalId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function uploadSingleImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string; }> {
    const file = formData.get("file") as File;
    const bucketName = formData.get("bucketName") as string;
    if (!file || !bucketName) return { success: false, error: "File and bucket name are required." };
    try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabaseAdmin.storage.from(bucketName).upload(filePath, file, { cacheControl: '604800', upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
        if (!urlData?.publicUrl) throw new Error("Could not get public URL after upload.");
        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown upload error";
        logger.error(`Failed to upload single file to ${bucketName}:`, errorMsg);
        return { success: false, error: errorMsg };
    }
}

export async function getUserRentals(userId: string): Promise<{ success: boolean; data?: UserRentalDashboard[]; error?: string }> {
    noStore();
    if (!userId) return { success: false, error: "User ID is required." };
    try {
        const { data: ownedCrews, error: crewError } = await supabaseAdmin.from('crews').select('id').eq('owner_id', userId);
        if (crewError) throw crewError;
        const ownedCrewIds = ownedCrews?.map(c => c.id) || [];
        const { data, error } = await supabaseAdmin.rpc('get_user_rentals_dashboard', { p_user_id: userId, p_owned_crew_ids: ownedCrewIds.length > 0 ? ownedCrewIds : null });
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        logger.error(`[getUserRentals] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getFranchizeSlugForVehicle(vehicleId: string): Promise<{ success: boolean; slug?: string; error?: string }> {
    noStore();
    if (!vehicleId) return { success: false, error: "Vehicle ID is required." };

    try {
        const { data: vehicle, error: vehicleError } = await supabaseAdmin
            .from('cars')
            .select('crew_id')
            .eq('id', vehicleId)
            .maybeSingle();

        if (vehicleError) throw vehicleError;
        if (!vehicle?.crew_id) return { success: true, slug: 'vip-bike' };

        const { data: crew, error: crewError } = await supabaseAdmin
            .from('crews')
            .select('slug')
            .eq('id', vehicle.crew_id)
            .maybeSingle();

        if (crewError) throw crewError;

        return { success: true, slug: crew?.slug || 'vip-bike' };
    } catch (error) {
        logger.error(`[getFranchizeSlugForVehicle] Failed for vehicle ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getFranchizeSlugForRental(rentalId: string): Promise<{ success: boolean; slug?: string; error?: string }> {
    noStore();
    if (!rentalId) return { success: false, error: "Rental ID is required." };

    try {
        const { data: rental, error: rentalError } = await supabaseAdmin
            .from('rentals')
            .select('vehicle_id')
            .eq('rental_id', rentalId)
            .maybeSingle();

        if (rentalError) throw rentalError;
        if (!rental?.vehicle_id) return { success: true, slug: 'vip-bike' };

        return await getFranchizeSlugForVehicle(rental.vehicle_id);
    } catch (error) {
        logger.error(`[getFranchizeSlugForRental] Failed for rental ${rentalId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getTopFleets(): Promise<{ success: boolean; data?: TopFleet[]; error?: string }> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_fleets');
        if (error) throw error;
        return { success: true, data };
    } catch(error) {
        logger.error("Error getting top fleets:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTopCrews(): Promise<{ success: boolean; data?: TopCrew[]; error?: string }> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_crews');
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch(error) {
        logger.error("Exception in getTopCrews action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getMapPresets(): Promise<{ success: boolean; data?: MapPreset[]; error?: string; }> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.from('maps').select('*');
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[getMapPresets Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function saveMapPreset(userId: string, name: string, map_image_url: string, bounds: MapBounds, is_default: boolean = false): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
    try {
        const { data: user, error: userError } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
        if (userError || !['admin'].includes(user?.role || '')) throw new Error("Unauthorized: Only admins can save map presets.");
        if (is_default) {
            const { error: updateError } = await supabaseAdmin.from('maps').update({ is_default: false }).eq('is_default', true).eq('owner_id', userId);
            if (updateError) throw new Error(`Failed to unset other default maps: ${updateError.message}`);
        }
        const { data, error } = await supabaseAdmin.from('maps').insert({ name, map_image_url, bounds: bounds as any, is_default, owner_id: userId }).select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[saveMapPreset Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function updateMapPois(userId: string, mapId: string, newPois: PointOfInterest[]): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
     try {
        const { data: user, error: userError } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
        if (userError || !['admin', 'vprAdmin'].includes(user?.role || '')) throw new Error("Unauthorized: Only admins can edit maps.");
        const { data, error } = await supabaseAdmin.from('maps').update({ points_of_interest: newPois as any }).eq('id', mapId).select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[updateMapPois Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
 
export async function requestToJoinCrew(userId: string, username: string, crewId: string) {
    noStore();
    if (!userId || !crewId) return { success: false, error: "User and Crew ID are required." };
    try {
        const { data: existingMembership, error: checkError } = await supabaseAdmin.from('crew_members').select('crew_id').eq('user_id', userId).eq('membership_status', 'active').maybeSingle();
        if (checkError) throw checkError;
        if (existingMembership) return { success: false, error: "Вы уже являетесь активным участником другого экипажа." };

        const { error } = await supabaseAdmin.from('crew_members').upsert({ user_id: userId, crew_id: crewId, membership_status: 'pending', role: 'member' }, { onConflict: 'crew_id, user_id' });
        if (error) throw error;
        
        const { data: crew, error: crewFetchError } = await supabaseAdmin.from('crews').select('owner_id, name, slug').eq('id', crewId).single();
        if (crewFetchError || !crew) throw new Error("Could not find crew to notify owner.");

        const TELEGRAM_BOT_LINK = process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
        const confirmationUrl = `${TELEGRAM_BOT_LINK}?startapp=crew_${crew.slug}_confirm_member_${userId}`;
        const ownerMessage = `🔔 Новый запрос на вступление в ваш экипаж *'${crew.name}'* от пользователя @${username || 'пользователь'}.\n\nНажмите кнопку ниже, чтобы рассмотреть заявку.`;
        await sendComplexMessage(crew.owner_id!, ownerMessage, [[{ text: "Рассмотреть Заявку", url: confirmationUrl }]]);

        return { success: true };
    } catch(e) {
        logger.error('[requestToJoinCrew]', e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error."};
    }
}

export async function confirmCrewMember(ownerId: string, newMemberId: string, crewId: string, accept: boolean) {
    noStore();
    if (!ownerId || !newMemberId || !crewId) return { success: false, error: "Missing required IDs." };
    try {
        const { data: crew, error: crewCheckError } = await supabaseAdmin.from('crews').select('id, name').eq('id', crewId).eq('owner_id', ownerId).single();
        if (crewCheckError || !crew) return { success: false, error: "Permission denied. You are not the owner of this crew." };

        const { data: member, error: memberFetchError } = await supabaseAdmin.from('users').select('username').eq('user_id', newMemberId).single();
        if(memberFetchError || !member) throw new Error("Could not find user to notify.");

        if (accept) {
            await supabaseAdmin.from('crew_members').delete().eq('user_id', newMemberId);
            const { error: updateError } = await supabaseAdmin.from('crew_members').insert({ crew_id: crewId, user_id: newMemberId, membership_status: 'active', role: 'member' });
            if (updateError) throw updateError;
            await sendComplexMessage(newMemberId, `🎉 Ваша заявка на вступление в экипаж *'${crew.name}'* была одобрена! Теперь вам доступна команда /shift.`);
            await sendComplexMessage(ownerId, `✅ Вы приняли @${member.username} в экипаж.`);
        } else {
            const { error: deleteError } = await supabaseAdmin.from('crew_members').delete().eq('crew_id', crewId).eq('user_id', newMemberId);
            if (deleteError) throw deleteError;
            await sendComplexMessage(newMemberId, `😔 Ваша заявка на вступление в экипаж *'${crew.name}'* была отклонена.`);
            await sendComplexMessage(ownerId, `❌ Вы отклонили заявку от @${member.username}.`);
        }
        return { success: true };
    } catch(e) {
        logger.error('[confirmCrewMember]', e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error."};
    }
}

export async function getCrewForInvite(slug: string) {
    noStore();
    if (!slug) return { success: false, error: "Crew slug is required" };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_crew_for_invite', { p_slug: slug });
        if (error) throw error;
        if (!data || data.length === 0) return { success: false, error: "Crew not found" };
        return { success: true, data: data[0] };
    } catch (error) {
        logger.error(`[getCrewForInvite] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

/**
 * Auto-join crew by invite link — adds user directly as active member.
 * No pending state, no owner confirmation. Used by ?join_crew=true flow.
 */
export async function autoJoinCrew(userId: string, username: string, crewId: string, crewSlug: string) {
    noStore();
    if (!userId || !crewId) return { success: false, error: "User and Crew ID are required." };
    try {
        // Check if user is already an active member of THIS crew
        const { data: sameMembership } = await supabaseAdmin
            .from('crew_members')
            .select('crew_id')
            .eq('user_id', userId)
            .eq('crew_id', crewId)
            .eq('membership_status', 'active')
            .maybeSingle();
        if (sameMembership) return { success: true, alreadyMember: true };

        // Check if user is active in ANOTHER crew
        const { data: otherMembership } = await supabaseAdmin
            .from('crew_members')
            .select('crew_id, crews(name)')
            .eq('user_id', userId)
            .eq('membership_status', 'active')
            .maybeSingle();
        if (otherMembership) return { success: false, error: "Вы уже являетесь активным участником другого экипажа." };

        // Upsert user record (ensure they exist in users table)
        await supabaseAdmin.from('users').upsert(
            { user_id: userId, username: username || 'rider' },
            { onConflict: 'user_id', ignoreDuplicates: true }
        );

        // Add as active member directly
        const { error } = await supabaseAdmin.from('crew_members').upsert(
            { user_id: userId, crew_id: crewId, membership_status: 'active', role: 'member' },
            { onConflict: 'crew_id, user_id' }
        );
        if (error) throw error;

        // Notify owner (informational only, no action needed)
        const { data: crew } = await supabaseAdmin.from('crews').select('owner_id, name').eq('id', crewId).single();
        if (crew?.owner_id) {
            try {
                await sendComplexMessage(crew.owner_id, `👤 @${username || 'rider'} присоединился к вашему экипажу *'${crew.name}'* по приглашению.`);
            } catch (notifyErr) {
                logger.warn('[autoJoinCrew] Failed to notify owner (non-critical):', notifyErr);
            }
        }

        return { success: true, alreadyMember: false };
    } catch (e) {
        logger.error('[autoJoinCrew]', e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error." };
    }
}

export async function getEditableVehiclesForUser(userId: string): Promise<{ 
    success: boolean; 
    data?: Vehicle[];
    error?: string; 
}> {
    noStore();
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }

    try {
        const { data: memberData, error: memberError } = await supabaseAdmin
            .from('crew_members')
            .select('crew_id')
            .eq('user_id', userId)
            .eq('membership_status', 'active') 
            .single();

        if (memberError && memberError.code !== 'PGRST116') {
            throw new Error(`Failed to check crew membership: ${memberError.message}`);
        }
        
        const userCrewId = memberData?.crew_id || null;
        let query = supabaseAdmin.from('cars').select('*');

        if (userCrewId) {
            query = query.or(`owner_id.eq.${userId},crew_id.eq.${userCrewId}`);
        } else {
            query = query.eq('owner_id', userId);
        }

        const { data, error } = await query;
        
        if (error) {
            logger.error("Error fetching editable vehicles:", error);
            throw new Error(`Supabase query error: ${error.message}`);
        }
        
        return { success: true, data: data || [] };

    } catch (error) {
        logger.error("Critical failure in getEditableVehiclesForUser action:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred." };
    }
}

// VVV --- НОВЫЙ ДВИЖОК ЦЕНООБРАЗОВАНИЯ --- VVV
const PRICING_CONFIG = {
    weekday: { day: 1.0, night: 0.75 }, // 9:00 - 20:59, 21:00 - 8:59
    weekend: { day: 1.25, night: 1.0 }
};
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 21;

export async function calculateDynamicPrice(vehicleId: string, startDateIso: string, endDateIso: string) {
    noStore();
    try {
        const { data: vehicle, error } = await supabaseAdmin.from('cars').select('daily_price').eq('id', vehicleId).single();
        if (error || !vehicle) throw new Error("Транспорт не найден или ошибка получения цены.");

        const baseHourlyRate = vehicle.daily_price / 24;
        let totalPrice = 0;
        const breakdown = {
            weekday: { dayHours: 0, nightHours: 0, cost: 0 },
            weekend: { dayHours: 0, nightHours: 0, cost: 0 },
        };

        const start = new Date(startDateIso);
        const end = new Date(endDateIso);
        
        let currentHour = new Date(start.getTime());

        while (currentHour < end) {
            const dayOfWeek = currentHour.getDay();
            const hour = currentHour.getHours();

            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            const isDay = (hour >= DAY_START_HOUR && hour < DAY_END_HOUR);

            let rateMultiplier: number;
            
            if (isWeekend) {
                if (isDay) {
                    rateMultiplier = PRICING_CONFIG.weekend.day;
                    breakdown.weekend.dayHours++;
                } else {
                    rateMultiplier = PRICING_CONFIG.weekend.night;
                    breakdown.weekend.nightHours++;
                }
            } else {
                if (isDay) {
                    rateMultiplier = PRICING_CONFIG.weekday.day;
                    breakdown.weekday.dayHours++;
                } else {
                    rateMultiplier = PRICING_CONFIG.weekday.night;
                    breakdown.weekday.nightHours++;
                }
            }
            
            const hourCost = baseHourlyRate * rateMultiplier;
            totalPrice += hourCost;

            if (isWeekend) breakdown.weekend.cost += hourCost;
            else breakdown.weekday.cost += hourCost;

            currentHour.setHours(currentHour.getHours() + 1);
        }

        return { 
            success: true, 
            data: {
                totalPrice: Math.ceil(totalPrice),
                breakdown,
                baseDailyPrice: vehicle.daily_price
            } 
        };

    } catch (error) {
        logger.error('[calculateDynamicPrice] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : "Не удалось рассчитать цену." };
    }
}

export async function initiateTelegramRentalPhotoUpload(
    rentalId: string,
    userId: string,
    photoType: 'start' | 'end'
): Promise<{ success: boolean; deepLink?: string; error?: string }> {
    noStore();

    if (!rentalId || !userId) {
        return { success: false, error: 'Missing rentalId or userId.' };
    }

    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals')
            .select('rental_id, user_id, status')
            .eq('rental_id', rentalId)
            .single();

        if (fetchError || !rental) {
            return { success: false, error: 'Аренда не найдена.' };
        }

        if (rental.user_id !== userId) {
            return { success: false, error: 'Только арендатор может отправлять фото.' };
        }

        if (photoType === 'start' && !['pending_confirmation', 'confirmed'].includes(rental.status)) {
            return { success: false, error: 'Фото ДО доступно только до подтверждения получения.' };
        }

        if (photoType === 'end' && rental.status !== 'active') {
            return { success: false, error: 'Фото ПОСЛЕ доступно только для активной аренды.' };
        }

        const { error: upsertError } = await supabaseAdmin.from('user_states').upsert({
            user_id: userId,
            state: 'awaiting_rental_photo',
            context: { rental_id: rentalId, photo_type: photoType, source: 'webapp' },
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });

        if (upsertError) throw upsertError;

        const tgLink = process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK || 'https://t.me/oneBikePlsBot';

        return { success: true, deepLink: tgLink.includes('startapp=') ? tgLink : `${tgLink}?startapp=rentals_${rentalId}` };
    } catch (e: any) {
        logger.error('[initiateTelegramRentalPhotoUpload] Error:', e);
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function archivePendingRental(
    rentalId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    noStore();

    if (!rentalId || !userId) {
        return { success: false, error: 'Missing rentalId or userId.' };
    }

    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals')
            .select('rental_id, user_id, owner_id, status, payment_status, metadata')
            .eq('rental_id', rentalId)
            .single();

        if (fetchError || !rental) {
            return { success: false, error: 'Аренда не найдена.' };
        }

        const isParticipant = rental.user_id === userId || rental.owner_id === userId;
        if (!isParticipant) {
            return { success: false, error: 'Недостаточно прав для архивации.' };
        }

        if (!['pending_confirmation', 'confirmed'].includes(rental.status)) {
            return { success: false, error: 'Архивировать можно только незавершенные тестовые аренды.' };
        }

        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const newMetadata = {
            ...currentMetadata,
            archived_by: userId,
            archived_at: new Date().toISOString(),
            archived_reason: 'manual_cleanup',
            archived_from_status: rental.status,
            archived_from_payment_status: rental.payment_status,
        };

        const { error: updateError } = await supabaseAdmin
            .from('rentals')
            .update({
                status: 'cancelled',
                metadata: newMetadata,
                updated_at: new Date().toISOString(),
            })
            .eq('rental_id', rentalId);

        if (updateError) throw updateError;

        const { error: eventError } = await supabaseAdmin.from('events').insert({
            rental_id: rentalId,
            type: 'rental_archived',
            status: 'completed',
            created_by: userId,
            payload: {
                reason: 'manual_cleanup',
                prev_status: rental.status,
                prev_payment_status: rental.payment_status,
            },
        });

        if (eventError) {
            logger.error('[archivePendingRental] Rental updated but failed to create archival event:', eventError);
        }

        await notifyRentalLifecycle(rentalId, 'rental_archived');

        return { success: true };
    } catch (e: any) {
        logger.error('[archivePendingRental] Error:', e);
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function addRentalPhoto(rentalId: string, userId: string, photoUrl: string, photoType: 'start' | 'end') {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin.from('rentals').select('user_id, metadata').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Аренда не найдена." };
        if (rental.user_id !== userId) return { success: false, error: "Только арендатор может добавлять фото." };

        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const newMetadata = {
            ...currentMetadata,
            [photoType === 'start' ? 'start_photo_url' : 'end_photo_url']: photoUrl
        };

        const { error: updateError } = await supabaseAdmin
            .from('rentals')
            .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
            .eq('rental_id', rentalId);
        
        if (updateError) throw updateError;
        
        const { error: eventError } = await supabaseAdmin.from('events').insert({ 
            rental_id: rentalId, type: `photo_${photoType}`, status: 'completed', created_by: userId, payload: { photo_url: photoUrl } 
        });

        if(eventError) logger.error(`[addRentalPhoto] Rental updated but failed to create event for rental ${rentalId}:`, eventError);

        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[addRentalPhoto] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function confirmVehiclePickup(rentalId: string, userId: string) {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals')
            .select('rental_id, owner_id, user_id, crew_id, metadata')
            .eq('rental_id', rentalId)
            .maybeSingle();
        if (fetchError || !rental) return { success: false, error: "Аренда не найдена." };
        if (rental.owner_id !== userId) return { success: false, error: "Только владелец может подтвердить получение." };
        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const hasPickupFreeze = Boolean(currentMetadata.pickup_freeze?.frozen_at);
        if (!hasPickupFreeze) {
            return { success: false, error: "Сначала заполните Pickup Freeze в блоке Rental Documents." };
        }

        // Шаг 1: Обновляем JSON metadata и статус в ОДНОМ запросе
        const newMetadata = {
            ...currentMetadata,
            pickup_confirmed_at: new Date().toISOString()
        };

        const { error: updateError } = await supabaseAdmin
            .from('rentals')
            .update({
                status: 'active',
                metadata: newMetadata,
                updated_at: new Date().toISOString()
            })
            .eq('rental_id', rentalId);

        if (updateError) throw updateError;

        // Шаг 2: Создаем событие для уведомления
        const { error: eventError } = await supabaseAdmin.from('events').insert({
            rental_id: rentalId, type: 'pickup_confirmed', created_by: userId
        });
        if(eventError) logger.error(`[confirmVehiclePickup] Rental updated but failed to create event for ${rentalId}:`, eventError);

        await notifyRentalLifecycle(rentalId, 'pickup_confirmed');

        // ── BUG C fix: create closure todos so operators get reminders ──
        // When a rental becomes "active", immediately create 5 closure todos
        // (inspect bike, capture odometer, refund deposit, request review,
        // mark completed). These show up in the operator's todo list and in
        // the RentalReturnChecklist on the dedicated /rental/[id] page.
        // Idempotent — won't duplicate if called twice.
        try {
            const { createRentalClosureTodos } = await import("@/app/franchize/server-actions/rental-verification-todos");
            await createRentalClosureTodos(
                rentalId,
                rental.crew_id || "",
                rental.user_id || null
            );
        } catch (closureErr) {
            logger.warn(`[confirmVehiclePickup] Failed to create closure todos (non-fatal):`, closureErr);
        }

        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[confirmVehiclePickup] Error:`, e);
        return { success: false, error: e.message };
    }
}

type PickupFreezePayload = {
    odometerKm: number;
    fuelLevel: string;
    checklist: string[];
    notes?: string;
    photoUrls?: string[];
};

export async function saveRentalPickupFreeze(
    rentalId: string,
    userId: string,
    payload: PickupFreezePayload
): Promise<{ success: boolean; error?: string }> {
    noStore();
    if (!rentalId || !userId) return { success: false, error: "Missing rentalId or userId." };
    if (!Number.isFinite(payload.odometerKm) || payload.odometerKm < 0) {
        return { success: false, error: "Пробег должен быть неотрицательным числом." };
    }

    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from("rentals")
            .select("owner_id, status, metadata")
            .eq("rental_id", rentalId)
            .single();
        if (fetchError || !rental) return { success: false, error: "Аренда не найдена." };
        if (rental.owner_id !== userId) return { success: false, error: "Только владелец может зафиксировать выдачу." };
        if (!["pending_confirmation", "confirmed"].includes(rental.status)) {
            return { success: false, error: "Pickup Freeze доступен только до подтверждения выдачи." };
        }

        const checklist = (payload.checklist || []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
        const photoUrls = (payload.photoUrls || []).map((url) => String(url || "").trim()).filter(Boolean).slice(0, 8);
        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const pickupFreeze = {
            version: 1,
            frozen_at: new Date().toISOString(),
            frozen_by: userId,
            odometer_km: Math.round(payload.odometerKm),
            fuel_level: String(payload.fuelLevel || "").trim() || "не указано",
            checklist,
            notes: String(payload.notes || "").trim(),
            photo_urls: photoUrls,
        };

        const { error: updateError } = await supabaseAdmin
            .from("rentals")
            .update({
                metadata: { ...currentMetadata, pickup_freeze: pickupFreeze },
                updated_at: new Date().toISOString(),
            })
            .eq("rental_id", rentalId);
        if (updateError) throw updateError;

        const { error: eventError } = await supabaseAdmin.from("events").insert({
            rental_id: rentalId,
            type: "pickup_freeze_created",
            status: "completed",
            created_by: userId,
            payload: {
                odometer_km: pickupFreeze.odometer_km,
                fuel_level: pickupFreeze.fuel_level,
                checklist_count: checklist.length,
                photos_count: photoUrls.length,
            },
        });
        if (eventError) logger.error("[saveRentalPickupFreeze] Event insert failed:", eventError);
        return { success: true };
    } catch (e: any) {
        logger.error("[saveRentalPickupFreeze] Error:", e);
        return { success: false, error: e.message || "Unknown error." };
    }
}

type DamageReportPayload = {
    phase: "pickup" | "return";
    severity: "minor" | "major";
    notes: string;
    photoUrls?: string[];
};

export async function addRentalDamageReport(
    rentalId: string,
    userId: string,
    payload: DamageReportPayload
): Promise<{ success: boolean; error?: string }> {
    noStore();
    if (!rentalId || !userId) return { success: false, error: "Missing rentalId or userId." };
    const notes = String(payload.notes || "").trim();
    if (notes.length < 5) return { success: false, error: "Добавьте краткое описание повреждения (минимум 5 символов)." };

    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from("rentals")
            .select("user_id, owner_id, metadata")
            .eq("rental_id", rentalId)
            .single();
        if (fetchError || !rental) return { success: false, error: "Аренда не найдена." };
        const isOwner = rental.owner_id === userId;
        const isRenter = rental.user_id === userId;
        if (!isOwner && !isRenter) return { success: false, error: "Недостаточно прав для отчета о повреждении." };

        const photoUrls = (payload.photoUrls || []).map((url) => String(url || "").trim()).filter(Boolean).slice(0, 8);
        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const existingReports = Array.isArray(currentMetadata.damage_reports) ? currentMetadata.damage_reports : [];
        const report = {
            report_id: uuidv4(),
            phase: payload.phase,
            severity: payload.severity,
            notes,
            photo_urls: photoUrls,
            reported_at: new Date().toISOString(),
            reported_by: userId,
            reporter_role: isOwner ? "owner" : "renter",
        };

        const { error: updateError } = await supabaseAdmin
            .from("rentals")
            .update({
                metadata: {
                    ...currentMetadata,
                    damage_reports: [report, ...existingReports].slice(0, 20),
                },
                updated_at: new Date().toISOString(),
            })
            .eq("rental_id", rentalId);
        if (updateError) throw updateError;

        const { error: eventError } = await supabaseAdmin.from("events").insert({
            rental_id: rentalId,
            type: "damage_report_added",
            status: "completed",
            created_by: userId,
            payload: {
                phase: report.phase,
                severity: report.severity,
                reporter_role: report.reporter_role,
                photos_count: photoUrls.length,
            },
        });
        if (eventError) logger.error("[addRentalDamageReport] Event insert failed:", eventError);
        return { success: true };
    } catch (e: any) {
        logger.error("[addRentalDamageReport] Error:", e);
        return { success: false, error: e.message || "Unknown error." };
    }
}

export async function confirmVehicleReturn(
  rentalId: string,
  userId: string,
  closureData?: {
    odometerAfter?: number | null;
    damageNotes?: string | null;
    depositReturned?: boolean | null;
    returnNotes?: string | null;
  }
) {
    noStore();
    try {
        // ── Fetch rental + vehicle for closure flow ────────────────────────────
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals')
            .select('rental_id, owner_id, user_id, crew_id, vehicle_id, metadata, total_cost, agreed_end_date, agreed_start_date, vehicle:cars(make, model, id, specs)')
            .eq('rental_id', rentalId)
            .maybeSingle();
        if (fetchError || !rental) return { success: false, error: "Аренда не найдена." };

        // ── BUG J fix: relax auth — allow owner, admins, and crew members ──
        // Previously only `rental.owner_id === userId` was allowed, which meant
        // crew members (mechanic, co_owner, admin) couldn't close rentals from
        // the dedicated /rental/[id] page even though they could from the
        // analytics dashboard (which uses updateRentalStatus). Now we mirror
        // the auth check from updateRentalStatus.
        const isOwner = rental.owner_id === userId;
        let isCrewMember = false;
        let isAdmin = false;
        if (!isOwner) {
            // Check crew membership
            if (rental.crew_id) {
                const { data: membership } = await supabaseAdmin
                    .from('crew_members')
                    .select('role, membership_status')
                    .eq('crew_id', rental.crew_id)
                    .eq('user_id', userId)
                    .maybeSingle();
                if (membership?.membership_status === "active"
                    && ["owner", "admin", "co_owner", "member"].includes(membership.role)) {
                    isCrewMember = true;
                }
            }
            // Check user admin flag
            if (!isCrewMember) {
                const { data: userRow } = await supabaseAdmin
                    .from('users')
                    .select('metadata, username')
                    .eq('user_id', userId)
                    .maybeSingle();
                const userMeta = userRow?.metadata as Record<string, unknown> | null;
                if (userMeta?.role === "admin" || userMeta?.status === "admin") {
                    isAdmin = true;
                }
            }
        }
        if (!isOwner && !isCrewMember && !isAdmin) {
            return { success: false, error: "Недостаточно прав для подтверждения возврата." };
        }

        // ── Build closure metadata ─────────────────────────────────────────────
        // BUG B fix: capture odometer_after, damage_notes, deposit_returned,
        // return_notes — previously these were silently dropped, leaving the
        // rental row with no closure record.
        const currentMetadata = (rental.metadata as Record<string, any>) || {};
        const nowIso = new Date().toISOString();
        const newMetadata = {
            ...currentMetadata,
            return_confirmed_at: nowIso,
            return_confirmed_by: userId,
            // Closure data (optional but recommended)
            ...(closureData?.odometerAfter != null ? { odometer_after: closureData.odometerAfter } : {}),
            ...(closureData?.damageNotes != null ? { damage_notes: closureData.damageNotes } : {}),
            ...(closureData?.depositReturned != null ? { deposit_returned: closureData.depositReturned } : {}),
            ...(closureData?.returnNotes != null ? { return_notes: closureData.returnNotes } : {}),
            // History entry
            history: [
                ...((currentMetadata.history as any[]) || []),
                {
                    status: "completed",
                    at: nowIso,
                    by: userId,
                    message: closureData?.returnNotes || closureData?.damageNotes || "Return confirmed",
                },
            ],
        };

        const { error: updateError } = await supabaseAdmin
            .from('rentals')
            .update({
                status: 'completed',
                // HIGH FIX #7: don't hardcode 'fully_paid' — preserve existing payment_status
                // unless the operator explicitly signals full payment was collected.
                // Was silently zero-eding the books for partial-payment returns.
                payment_status: (closureData?.depositReturned === true
                    ? 'fully_paid'
                    : (rental as any)?.payment_status || 'pending'),
                metadata: newMetadata,
                updated_at: nowIso,
            })
            .eq('rental_id', rentalId);

        if (updateError) throw updateError;

        // ── BUG B fix: update bike's last_known_odometer ───────────────────────
        // Mirror what updateRentalStatus does (rentals-dashboard.ts:2076-2096)
        // so the next renter's prefill gets the up-to-date reading.
        if (closureData?.odometerAfter != null && rental.vehicle_id) {
            try {
                const vehicle = rental.vehicle as { id?: string; specs?: Record<string, unknown> } | null;
                if (vehicle?.id) {
                    const { data: car } = await supabaseAdmin
                        .from("cars")
                        .select("specs")
                        .eq("id", vehicle.id)
                        .maybeSingle();
                    if (car) {
                        const specs = (car.specs || {}) as Record<string, unknown>;
                        await supabaseAdmin
                            .from("cars")
                            .update({ specs: { ...specs, last_known_odometer: closureData.odometerAfter } })
                            .eq("id", vehicle.id);
                    }
                }
            } catch (odoErr) {
                logger.warn(`[confirmVehicleReturn] Odometer save failed (non-fatal):`, odoErr);
            }
        }

        // Шаг 2: Создаем событие для уведомления
        const { error: eventError } = await supabaseAdmin.from('events').insert({
            rental_id: rentalId, type: 'return_confirmed', created_by: userId
        });
        if(eventError) logger.error(`[confirmVehicleReturn] Rental updated but failed to create event for ${rentalId}:`, eventError);
        await notifyRentalLifecycle(rentalId, 'return_confirmed');

        // ── BUG B fix: send closure receipt to renter ──────────────────────────
        // Previously only a generic lifecycle event was sent. Now we send a
        // detailed receipt with odometer reading, deposit status, and a
        // thank-you / review-request nudge.
        //
        // Polish 2026-07-30: fall back to rental_contract_artefacts.telegram_chat_id
        // when rentals.user_id is null (bot/QR-flow rentals). Log a warning if
        // BOTH are null so the operator knows the receipt was skipped.
        let receiptChatId: string | null = null;
        if (rental.user_id) {
            receiptChatId = rental.user_id;
        } else {
            // Fallback: query private.rental_contract_artefacts by rental_id FK
            try {
                const { data: artefact } = await supabaseAdmin
                    .from("rental_contract_artefacts")
                    .select("telegram_chat_id")
                    .eq("rental_id", rentalId)
                    .maybeSingle();
                if (artefact?.telegram_chat_id) {
                    receiptChatId = String(artefact.telegram_chat_id).trim();
                }
            } catch (artefactErr) {
                logger.warn(`[confirmVehicleReturn] Failed to fetch rental_contract_artefacts fallback:`, artefactErr);
            }
        }

        if (receiptChatId) {
            try {
                const vehicle = rental.vehicle as { make?: string; model?: string } | null;
                const bikeName = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "байк";
                const receiptParts: string[] = [
                    `✅ <b>Аренда завершена</b>`,
                    ``,
                    `🚲 ${bikeName}`,
                    `📋 Статус: <b>завершена</b>`,
                ];
                if (closureData?.odometerAfter != null) {
                    receiptParts.push(`📏 Финальный одометр: ${closureData.odometerAfter} км`);
                }
                if (closureData?.depositReturned) {
                    receiptParts.push(`💰 Депозит: возвращён`);
                } else if (closureData?.depositReturned === false) {
                    receiptParts.push(`💰 Депозит: удержан (уточните у оператора)`);
                }
                if (closureData?.damageNotes) {
                    receiptParts.push(`📝 Заметки: ${closureData.damageNotes}`);
                }
                receiptParts.push(``, `Спасибо за аренду! Будем рады отзыву.`);

                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
                await fetch(`${siteUrl}/api/forward-telegram`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: receiptChatId,
                        method: "sendMessage",
                        payload: {
                            text: receiptParts.join("\n"),
                            parse_mode: "HTML",
                        },
                    }),
                    signal: AbortSignal.timeout(10000),
                });
            } catch (tgErr) {
                logger.warn(`[confirmVehicleReturn] Receipt notify failed (non-fatal):`, tgErr);
            }
        } else {
            logger.warn(`[confirmVehicleReturn] No renter chat_id available (user_id is null AND rental_contract_artefacts.telegram_chat_id is null/missing) — receipt skipped for rental ${rentalId}`);
        }

        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[confirmVehicleReturn] Error:`, e);
        return { success: false, error: e.message };
    }
}
// ^^^ --- КОНЕЦ НОВОГО ДВИЖКА --- ^^^

/**
 * Creates a sauna booking using the existing booking flow.
 * Injects `metadata.type = 'sauna'` so downstream webhook handlers
 * and business logic treat it as a sauna rental without requiring new endpoints.
 *
 * @param input - Base booking data (customer info, dates, price, etc.)
 * @returns Promise<BookingResult> from the standard booking flow
 */
export async function createSaunaBooking(
  input: Omit<BookingInput, 'metadata'> & {
    metadata?: Record<string, unknown>;
  }
): Promise<BookingResult> {
  try {
    // Merge provided metadata with sauna type
    const metadata = {
      ...(input.metadata ?? {}),
      type: 'sauna', // 👈 key flag for webhook handlers
    };

    // Pass through to the standard booking creation function
    // If your system uses `createInvoice` instead of `createBooking`,
    // swap the import and call accordingly.
    return await createBooking({
      ...input,
      metadata,
    });
  } catch (err) {
    console.error('[createSaunaBooking] Failed:', err);
    throw err;
  }
}


// ──────────────────────────────────────────────────────────────────────────
// Phase 3: extendRental — creates a new rental row extending an existing one.
// ──────────────────────────────────────────────────────────────────────────

interface ExtendRentalInput {
  originalRentalId: string;
  newStartDate: string; // ISO date string (YYYY-MM-DD)
  newEndDate: string;   // ISO date string (YYYY-MM-DD)
  /** Optional idempotency key from the client — prevents duplicate extension rentals
   *  when the user double-clicks the "Продлить" button. Stored in metadata.client_request_id. */
  clientRequestId?: string;
}

interface ExtendRentalResult {
  success: boolean;
  newRentalId?: string;
  error?: string;
}

export async function extendRental(input: ExtendRentalInput): Promise<ExtendRentalResult> {
  const { originalRentalId, newStartDate, newEndDate, clientRequestId } = input;

  if (!originalRentalId || !newStartDate || !newEndDate) {
    return { success: false, error: "Не указаны обязательные поля." };
  }

  // Basic UUID format check (not full RFC 4122, but catches obvious garbage)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(originalRentalId)) {
    return { success: false, error: "Неверный формат ID аренды." };
  }

  // Date format check (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(newStartDate) || !dateRe.test(newEndDate)) {
    return { success: false, error: "Неверный формат даты. Используйте ГГГГ-ММ-ДД." };
  }

  const start = new Date(newStartDate);
  const end = new Date(newEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: "Неверный формат даты." };
  }
  if (end < start) {
    return { success: false, error: "Дата окончания должна быть позже или равна дате начала." };
  }
  // Max duration cap — prevent abuse (1000-day rental at daily price would be a billing bug)
  const maxDays = 365;
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days > maxDays) {
    return { success: false, error: `Срок аренды превышает ${maxDays} дней.` };
  }

  // ── Idempotency check — if clientRequestId was provided and we already have
  // a rental with this ID in metadata, return that one instead of creating a duplicate.
  if (clientRequestId) {
    const { data: existing } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("metadata->>client_request_id", clientRequestId)
      .maybeSingle();
    if (existing?.rental_id) {
      return { success: true, newRentalId: existing.rental_id };
    }
  }

  // ── Caller authentication (CRITICAL — was missing in v1) ──
  // Without this, anyone could extend anyone's rental by guessing the UUID.
  const cookieStore = await cookies();
  const callerUserId = cookieStore.get("tg_user_id")?.value;
  if (!callerUserId) {
    return { success: false, error: "Требуется авторизация." };
  }

  const supabase = supabaseAdmin;

  // ── 1. Fetch original rental ──
  const { data: original, error: fetchErr } = await supabase
    .from("rentals")
    .select(`
      rental_id,
      user_id,
      owner_id,
      crew_id,
      vehicle_id,
      total_cost,
      payment_status,
      status,
      metadata,
      agreed_start_date,
      agreed_end_date,
      vehicles:vehicle_id ( id, make, model, daily_price )
    `)
    .eq("rental_id", originalRentalId)
    .maybeSingle();

  if (fetchErr || !original) {
    return { success: false, error: "Оригинальная аренда не найдена." };
  }

  // ── Status check — only active or completed rentals can be extended ──
  // (extending a cancelled rental makes no sense; extending pending_confirmation
  //  should be done via the regular edit flow, not extendRental)
  if (!["active", "completed"].includes(original.status)) {
    return { success: false, error: `Аренду в статусе «${original.status}» нельзя продлить.` };
  }

  // ── Authorization check (CRITICAL) ──
  // Caller must be: rental owner, crew operator/admin, OR global admin.
  const isOwner = original.owner_id === callerUserId;
  let isCrewOperator = false;
  if (original.crew_id) {
    const { data: membership } = await supabase
      .from("crew_members")
      .select("role")
      .eq("crew_id", original.crew_id)
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (membership && ["owner", "admin", "co_owner"].includes(membership.role)) {
      isCrewOperator = true;
    }
  }
  // Global admin check via user metadata
  const { data: callerUser } = await supabase
    .from("users")
    .select("metadata")
    .eq("user_id", callerUserId)
    .maybeSingle();
  const callerMeta = (callerUser?.metadata as Record<string, unknown> | null) ?? null;
  const isGlobalAdmin = callerMeta?.role === "admin" || callerMeta?.status === "admin";

  if (!isOwner && !isCrewOperator && !isGlobalAdmin) {
    return { success: false, error: "Нет прав на продление этой аренды." };
  }

  // ── 2. Bike availability check — prevent double-booking ──
  // Query overlapping active/confirmed rentals for the same vehicle.
  // S1 fix: exclude the original rental itself, otherwise mid-rental extensions
  // (e.g., extending an active rental by 1 day) would always show "already booked".
  const { data: overlapping } = await supabase
    .from("rentals")
    .select("rental_id")
    .eq("vehicle_id", original.vehicle_id)
    .in("status", ["active", "confirmed", "pending_confirmation"])
    .neq("rental_id", originalRentalId)
    .or(`and(agreed_start_date.lte.${newEndDate},agreed_end_date.gte.${newStartDate})`)
    .limit(1)
    .maybeSingle();
  if (overlapping) {
    return { success: false, error: "Байк уже забронирован на эти даты. Выберите другие." };
  }

  // ── 3. Calculate new total cost (preserving daily price from vehicle) ──
  const vehicle = (original as any).vehicles as { id: string; make: string; model: string; daily_price?: number } | null;
  if (!vehicle) {
    return { success: false, error: "Байк не найден в оригинальной аренде." };
  }

  // Sanity-check daily price — fall back to original rental's daily price if vehicle has 0/null
  // S2 fix: compute original rental's duration from its own dates, not the new rental's dates.
  // Previously used `days` (new rental duration) as divisor → wrong fallback price for
  // extensions of different lengths.
  const originalMeta = (original.metadata as Record<string, any> | null) ?? {};
  const originalStart = original.agreed_start_date ? new Date(original.agreed_start_date) : null;
  const originalEnd = original.agreed_end_date ? new Date(original.agreed_end_date) : null;
  const originalDays = (originalStart && originalEnd)
    ? Math.max(1, Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (24 * 60 * 60 * 1000)))
    : 1;
  const fallbackDailyPrice = Number(originalMeta.extension_daily_price) ||
    (original.total_cost ? Number(original.total_cost) / originalDays : 0);
  const dailyPrice = Number(vehicle.daily_price) || fallbackDailyPrice;
  if (dailyPrice <= 0) {
    return { success: false, error: "Не удалось определить дневную цену байка." };
  }
  const newDays = Math.max(1, days);
  const newTotal = dailyPrice * newDays;

  // ── 3. Insert new rental row ──
  // SECURITY: only copy SAFE metadata fields — don't blindly spread originalMeta
  // (could contain internal fields like passport_scan_url, internal_note, etc.)
  const safeMetaFields = {
    equipment: originalMeta.equipment,
    pickup_freeze: originalMeta.pickup_freeze,
    daily_price: dailyPrice,
    extended_from: originalRentalId,
    extension_created_at: new Date().toISOString(),
    extension_days: newDays,
    extension_daily_price: dailyPrice,
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  };
  const newRentalId = crypto.randomUUID();

  const { error: insertErr } = await supabase.from("rentals").insert({
    rental_id: newRentalId,
    user_id: original.user_id,
    owner_id: original.owner_id,
    crew_id: original.crew_id,
    vehicle_id: original.vehicle_id,
    requested_start_date: newStartDate,
    requested_end_date: newEndDate,
    agreed_start_date: newStartDate,
    agreed_end_date: newEndDate,
    total_cost: newTotal,
    payment_status: "pending",
    status: "pending_confirmation",
    metadata: safeMetaFields,
  });

  if (insertErr) {
    console.error("[extendRental] Insert error:", insertErr);
    return { success: false, error: "Не удалось создать новую аренду." };
  }

  // ── 4. Send TG notification to operator ──
  const bikeTitle = `${vehicle.make} ${vehicle.model}`.trim();
  const shortId = newRentalId.slice(0, 8);
  const dateRangeStr = `${start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} → ${end.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`;

  // P2 fix: use privateSchema() + correct table name (rental_contract_artifacts, American spelling).
  // Was: rental_contract_artefacts (British) in default public schema → silent 404, renter never notified.
  type SupabaseSchemaClient = {
    schema: (schema: string) => { from: (table: string) => any };
  };
  const privateSchemaLocal = () => (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
  let renterFullName = "клиент";
  let renterChatId = "";
  try {
    const { data: artefact } = await privateSchemaLocal()
      .from("rental_contract_artifacts")
      .select("renter_full_name, telegram_chat_id")
      .eq("rental_id", originalRentalId)
      .maybeSingle();
    if (artefact) {
      if (artefact.renter_full_name) renterFullName = artefact.renter_full_name;
      if (artefact.telegram_chat_id) renterChatId = String(artefact.telegram_chat_id);
    }
  } catch {
    // ignore — non-fatal
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

    // C1 fix (review-goodnight-final): fetch crew slug from DB.
    // S7 fix used `${crewSlug || "vip-bike"}` but crewSlug was never declared →
    // ReferenceError thrown → caught by outer try/catch → operator NEVER received
    // the "Аренда продлена" TG notification (silent regression).
    let resolvedCrewSlug = "vip-bike";
    if (original.crew_id) {
      try {
        const { data: crewRow } = await supabase
          .from("crews")
          .select("slug")
          .eq("id", original.crew_id)
          .maybeSingle();
        if (crewRow?.slug) resolvedCrewSlug = crewRow.slug;
      } catch {
        // keep fallback
      }
    }
    const webUrl = `${siteUrl}/franchize/${resolvedCrewSlug}/rental/${newRentalId}`;
    const botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

    const operatorMessage =
      `✅ <b>Аренда продлена</b>\n` +
      `🏍 ${escapeHtml(bikeTitle)}\n` +
      `👤 ${escapeHtml(renterFullName)}\n` +
      `📅 ${dateRangeStr} (${newDays} дн.)\n` +
      `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n` +
      `🔑 Аренда: ${escapeHtml(shortId)}\n\n` +
      `Договор сформируется автоматически. Активируйте после выдачи ТС.`;

    await sendComplexMessage(
      String(original.owner_id),
      operatorMessage,
      [[
        { text: "📋 Открыть аренду", url: `${botLink}?startapp=rental_${newRentalId}` },
        { text: "🌐 В браузере", url: webUrl },
      ]],
      { parseMode: "HTML" },
    );
  } catch (tgErr) {
    console.warn("[extendRental] TG notify failed (non-fatal):", tgErr);
    // Non-fatal: rental is created, operator can find it via dashboard
  }

  // ── 5. Notify renter (if they have a telegram_chat_id from artefacts) ──
  try {
    const finalRenterChatId = renterChatId || original.user_id || "";
    const renterName = renterFullName;

    if (finalRenterChatId) {
      const renterMessage =
        `✅ <b>Ваша аренда продлена</b>\n` +
        `🏍 ${escapeHtml(bikeTitle)}\n` +
        `📅 ${dateRangeStr}\n` +
        `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n\n` +
        `Менеджер активирует аренду и пришлёт договор. Приятной поездки! 🏍️`;

      await sendComplexMessage(String(finalRenterChatId), renterMessage, [], {
        parseMode: "HTML",
      });
    }
  } catch (tgErr) {
    console.warn("[extendRental] Renter TG notify failed (non-fatal):", tgErr);
  }

  // ── 6. Audit notification to boss ──
  // NC1 fix (review-goodnight-final): notifyAdmin uses Markdown parseMode by default.
  // Raw interpolation of bikeTitle/renterFullName could break Markdown on names like
  // "Ivan_Ivanov" or "Test [Bike]" → message fails to send. Escape via escapeHtml
  // and switch to HTML parseMode (consistent with the operator + renter messages above).
  try {
    const adminMessage =
      `🔄 Аренда продлена\n` +
      `🏍 ${escapeHtml(bikeTitle)}\n` +
      `👤 ${escapeHtml(renterFullName)}\n` +
      `🔑 Новая аренда: ${escapeHtml(shortId)}\n` +
      `📅 ${dateRangeStr} (${newDays} дн.)\n` +
      `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n` +
      `🔗 Из оригинала: ${escapeHtml(originalRentalId.slice(0, 8))}`;
    await notifyAdmin(adminMessage);
  } catch (adminErr) {
    console.warn("[extendRental] Admin notify failed (non-fatal):", adminErr);
  }

  return { success: true, newRentalId };
}

// ─────────────────────────────────────────────────────────────────────────────
// setRentalPhone — set or update the renter's phone number on a rental
// Used by the "📞 Указать телефон" button on the rental page when /doc skipped phone.
// Updates private.rental_contract_artifacts (what the page reads) + best-effort sync
// to private.user_rental_secrets (next-rent prefill) + public.rentals.metadata (leads pipeline).
// ─────────────────────────────────────────────────────────────────────────────

interface SetRentalPhoneInput {
  rentalId: string;
  phone: string;  // raw user input
}

interface SetRentalPhoneResult {
  success: boolean;
  error?: string;
}

/**
 * Normalize a Russian phone number to E.164 format (+7XXXXXXXXXX).
 * Handles: +7 999 123-45-67, 89991234567, 79991234567, 99991234567, etc.
 * Returns null if the number is invalid.
 */
function normalizePhoneToE164(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 10) digits = "7" + digits;
  if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
  return null;
}

export async function setRentalPhone(input: SetRentalPhoneInput): Promise<SetRentalPhoneResult> {
  try {
    // 1. Validate rentalId (UUID)
    const rentalId = input?.rentalId?.trim();
    if (!rentalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rentalId)) {
      return { success: false, error: "Неверный ID аренды" };
    }

    // 2. Normalize phone to E.164
    const normalizedPhone = normalizePhoneToE164(input.phone || "");
    if (!normalizedPhone) {
      return { success: false, error: "Неверный формат телефона. Введите 10-11 цифр (например, +7 999 123-45-67)" };
    }

    // 3. Caller auth
    const callerUserId = (await cookies()).get("tg_user_id")?.value;
    if (!callerUserId) {
      return { success: false, error: "Не авторизован" };
    }

    // 4. Fetch rental
    const { data: rental, error: rentalErr } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, owner_id, crew_id, crew_slug")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalErr || !rental) {
      return { success: false, error: "Аренда не найдена" };
    }

    // 5. Authorization: owner OR crew operator OR global admin
    const isOwner = rental.owner_id === callerUserId;

    let isCrewOperator = false;
    if (rental.crew_id) {
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("role")
        .eq("crew_id", rental.crew_id)
        .eq("user_id", callerUserId)
        .maybeSingle();
      isCrewOperator = ["owner", "admin", "co_owner"].includes(crewMember?.role || "");
    }

    let isGlobalAdmin = false;
    const { data: callerUser } = await supabaseAdmin
      .from("users")
      .select("role, status, metadata")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (callerUser?.status === "admin" || callerUser?.role === "admin" || callerUser?.role === "vprAdmin") {
      isGlobalAdmin = true;
    }

    if (!isOwner && !isCrewOperator && !isGlobalAdmin) {
      return { success: false, error: "Нет прав на изменение этой аренды" };
    }

    // 6. UPDATE private.rental_contract_artifacts — this is what the rental page reads
    // Use the privateSchema() helper to access the private schema
    const privateSchema = (supabaseAdmin as unknown as { schema: (s: string) => typeof supabaseAdmin }).schema("private");
    const { error: artifactErr } = await privateSchema
      .from("rental_contract_artifacts")
      .update({ renter_phone: normalizedPhone })
      .eq("rental_id", rentalId);

    if (artifactErr) {
      logger.error("[setRentalPhone] artifact update failed", artifactErr);
      return { success: false, error: "Не удалось обновить телефон в договоре" };
    }

    // 7. Best-effort: sync to private.user_rental_secrets (next-rent prefill)
    try {
      // Find the artifact's original_sha256 to match secrets
      const { data: artifact } = await privateSchema
        .from("rental_contract_artifacts")
        .select("original_sha256")
        .eq("rental_id", rentalId)
        .maybeSingle();

      if (artifact?.original_sha256) {
        await privateSchema
          .from("user_rental_secrets")
          .update({ renter_phone: normalizedPhone, updated_at: new Date().toISOString() })
          .eq("doc_sha256", artifact.original_sha256);
      }
      // Also try by source_rental_id
      await privateSchema
        .from("user_rental_secrets")
        .update({ renter_phone: normalizedPhone, updated_at: new Date().toISOString() })
        .eq("source_rental_id", rentalId);
    } catch (secretsErr) {
      logger.warn("[setRentalPhone] secrets sync failed (non-fatal)", secretsErr);
    }

    // 8. Best-effort: patch rentals.metadata for leads/todos pipeline
    try {
      await supabaseAdmin
        .from("rentals")
        .update({ metadata: { renter_phone: normalizedPhone } })
        .eq("rental_id", rentalId);
    } catch (metaErr) {
      logger.warn("[setRentalPhone] metadata patch failed (non-fatal)", metaErr);
    }

    logger.info("[setRentalPhone] phone updated", { rentalId, normalizedPhone, callerUserId });
    return { success: true };
  } catch (err) {
    logger.error("[setRentalPhone] unexpected error", err);
    return { success: false, error: "Внутренняя ошибка" };
  }
}

// ── Local escapeHtml (server-side, mirrors notification-templates.ts) ──
// Defined locally to avoid circular import (notification-templates.ts is client-importable)
function escapeHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

