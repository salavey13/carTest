"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

const BOT_APP_URL = "https://t.me/oneSitePlsBot/app";

export async function getSnowboardInstructors() {
    try {
        const { data: providers, error } = await supabaseAdmin
            .from('crews')
            .select('*')
            .eq('metadata->>is_provider', 'true');
            
        if (error) throw error;
        
        // Filter providers that offer snowboard instruction
        const snowboardInstructors = providers
            .filter(p => 
                p.metadata.services?.some((s: any) => s.id === 'snowboard_instructor')
            )
            .map(p => {
                const snowboardService = p.metadata.services?.find((s: any) => s.id === 'snowboard_instructor');
                const minPrice = Math.min(...(snowboardService?.packages?.map((pkg: any) => pkg.price) || [0]));
                
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    logo_url: p.logo_url,
                    rating: p.metadata.rating || 0,
                    reviews: p.metadata.reviews || 0,
                    description: snowboardService?.description || '',
                    location: snowboardService?.location_details?.address || p.hq_location || 'Не указано',
                    working_hours: p.metadata.contacts?.working_hours || 'Не указано',
                    contacts: p.metadata.contacts || {},
                    min_price: minPrice,
                    experience: p.metadata.experience || 'Не указано',
                    packages: snowboardService?.packages || [],
                    owner_id: p.owner_id, // Crucial for sending notifications
                    telegram_handle: snowboardService?.how_to_book?.telegram // Optional override
                };
            });
            
        return { success: true, data: snowboardInstructors };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bookSnowboardLesson(providerId: string, packageId: string, clientUserId: string) {
    try {
        // 1. Fetch Provider Details
        const { data: provider, error: providerError } = await supabaseAdmin
            .from('crews')
            .select('name, slug, logo_url, owner_id, metadata')
            .eq('id', providerId)
            .single();

        if (providerError || !provider) throw new Error("Provider not found");

        // 2. Locate the specific service and package
        const service = provider.metadata.services?.find((s: any) => s.id === 'snowboard_instructor');
        if (!service) throw new Error("Snowboarding service not found for this provider");

        const selectedPackage = service.packages?.find((pkg: any) => pkg.id === packageId);
        if (!selectedPackage) throw new Error("Package not found");

        // 3. Fetch Client Name for notification
        const { data: clientUser } = await supabaseAdmin
            .from('users')
            .select('username, full_name')
            .eq('user_id', clientUserId)
            .single();

        const clientName = clientUser?.full_name || clientUser?.username || "Райдер";

        // 4. Prepare Notification
        // Link to Web App general lobby入口
        const webAppUrl = `${BOT_APP_URL}?startapp=snowboard`;
        
        // Notification to Provider (Russian)
        const providerMessageText = `
🏂 <b>НОВЫЙ ЗАПРОС НА УРОК</b>
🎿 <b>Инструктор:</b> ${clientName}
📦 <b>Тариф:</b> ${selectedPackage.name} (${selectedPackage.price} RUB)

Клиент хочет забронировать время.
📱 Пожалуйста, свяжитесь с клиентом в приложении для подтверждения.
👉 <a href="${webAppUrl}">ОТКРЫТЬ В ПРИЛОЖЕНИИ</a>
        `;

        // Notification to Client (Russian)
        const clientMessageText = `
✅ <b>ЗАЯВКА ОТПРАВЛЕНА</b>
🎿 Инструктор "${provider.name}" получил ваш запрос на урок (${selectedPackage.name}).
<br>Ожидайте связи в Telegram или откройте приложение для координации времени и места.
👉 <a href="${webAppUrl}">ОТКРЫТЬ В ПРИЛОЖЕНИИ</a>
        `;

        const chatId = provider.telegram_handle && provider.telegram_handle.startsWith('@') 
            ? provider.telegram_handle 
            : provider.owner_id;

        // Send to Provider (Owner or specific handle)
        await sendComplexMessage(chatId, providerMessageText, [], {
            parseMode: 'HTML',
            imageQuery: 'snowboard slope'
        });

        // Send to Client (Notify them that request was sent)
        await sendComplexMessage(clientUserId, clientMessageText, [], {
            parseMode: 'HTML',
            imageQuery: 'notification bell'
        });

        return { success: true, message: "Request sent. Both parties notified." };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function addSnowboardServiceToCrew(crewId: string) {
    try {
        // Get current crew metadata
        const { data: crew } = await supabaseAdmin
            .from('crews')
            .select('metadata')
            .eq('id', crewId)
            .single();
        
        if (!crew) return { success: false, error: "Crew not found" };
        
        // Check if snowboard service already exists
        const existingServices = crew.metadata.services || [];
        const hasSnowboardService = existingServices.some((s: any) => s.id === 'snowboard_instructor');
        
        if (hasSnowboardService) {
            return { success: false, error: "Snowboard service already exists" };
        }
        
        // Add snowboard service
        const snowboardService = {
            id: 'snowboard_instructor',
            name: 'Сноуборд-инструктор',
            tags: ['Сноуборд', 'Спорт', 'Обучение', 'Инструктор', 'Новинки'],
            notes: 'Индивидуальное и групповое обучение катанию на сноуборде. Все уровни - от новичков до продвинутых райдеров.',
            benefits: [
                'Персональный подход к каждому ученику',
                'Безопасное освоение основ катания',
                'Техника правильного падения и контроля',
                'Обучение трюкам и продвинутым техникам',
                'Помощь в выборе и настройке оборудования'
            ],
            packages: [
                {
                    id: 'snow_1h_basic',
                    name: 'Базовый курс - 1 час',
                    price: 1500,
                    currency: 'RUB',
                    duration: 60,
                    includes: 'Индивидуальное обучение 1 час; Основы стойки и движения; Техника торможения; Помощь с оборудованием'
                },
                {
                    id: 'snow_3h_full',
                    name: 'Полное погружение - 3 часа',
                    price: 4000,
                    currency: 'RUB',
                    duration: 180,
                    includes: 'Индивидуальное обучение 3 часа; Полный курс для новичков; Основы и базовые трюки; Видеоанализ техники; Горячий напиток'
                },
                {
                    id: 'snow_group_2h',
                    name: 'Групповое занятие - 2 часа',
                    price: 2500,
                    currency: 'RUB',
                    duration: 120,
                    includes: 'Обучение в группе до 5 человек; Основы катания; Игровые элементы; Совместное катание по трассе'
                }
            ],
            age_limit: 10,
            gear_info: 'Сноуборд и ботинки можно арендовать на месте (оплачивается отдельно). Рекомендуется наличие шлема.',
            image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowboard_instructor.jpg',
            description: 'Профессиональный инструктор по сноуборду для индивидуальных и групповых занятий. Помогу освоить основы или улучшить технику катания. Работаю на склонах Новинок.',
            how_to_book: {
                method: 'Через форму на странице или Telegram бот',
                payment: 'Наличными или переводом',
                telegram: '@SALAVEY13'
            },
            min_players: 1,
            location_details: {
                gps: '56.0250, 43.8750',
                address: 'Горнолыжный комплекс "Новинки", Нижний Новгород',
                car_directions: 'Следуйте по указателям на горнолыжный комплекс "Новинки"',
                public_transport: 'Автобус № 11 до остановки "Новинки"'
            }
        };
        
        // Update amenities if needed
        const existingAmenities = crew.metadata.amenities || [];
        const hasSnowboardGear = existingAmenities.some((a: any) => a.id === 'snowboard_gear');
        
        const newAmenities = hasSnowboardGear 
            ? existingAmenities 
            : [...existingAmenities, {
                id: 'snowboard_gear',
                icon: 'FaPersonSkiing',
                name: 'Сноубордическое оборудование'
            }];
        
        // Update metadata
        const updatedMetadata = {
            ...crew.metadata,
            services: [...existingServices, snowboardService],
            amenities: newAmenities,
            provider_type: crew.metadata.provider_type === 'consulting_studio' 
                ? 'multi_activity_provider' 
                : crew.metadata.provider_type
        };
        
        const { error } = await supabaseAdmin
            .from('crews')
            .update({ metadata: updatedMetadata })
            .eq('id', crewId);
            
        if (error) throw error;
        
        revalidatePath(`/crews/${crewId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * 1-CLICK LOBBY CREATION FOR SNOWBOARDING
 * Automatically creates a lobby, assigns the provider, notifies both parties.
 */
export async function createSnowboardLobby(
  clientUserId: string, 
  providerId: string, 
  packageId: string
) {
  try {
    // 1. Fetch Provider Details to generate lobby info
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('crews')
      .select('name, slug, owner_id, metadata')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) throw new Error("Provider not found");

    // 2. Locate specific service and package
    const service = provider.metadata.services?.find((s: any) => s.id === 'snowboard_instructor');
    if (!service) throw new Error("Snowboarding service not found for this provider");

    const selectedPackage = service.packages?.find((pkg: any) => pkg.id === packageId);
    if (!selectedPackage) throw new Error("Package not found");

    // 3. Generate Lobby Config (The "Mini Config")
    const lobbyName = `Сноуборд с ${provider.name}`;
    const lobbyMode = 'SNOWBOARD';
    
    // Compose description dynamically
    const benefitsHtml = service.benefits.map((b: string) => `• ${b}`).join('\n');
    const description = `Урок: ${selectedPackage.name}\n${selectedPackage.includes}\n\n${benefitsHtml}`;
    
    // Date: "Now" -> ISO String (allows easy editing in app later)
    const startAtISO = new Date().toISOString();

    // 4. Insert Lobby Record
    // We use direct supabaseAdmin insert for speed and control
    const { data: lobby, error: lobbyError } = await supabaseAdmin
      .from("lobbies")
      .insert({
        name: lobbyName,
        owner_id: clientUserId,
        mode: lobbyMode,
        status: "open",
        start_at: startAtISO, // "Now"
        max_players: 10, // Default for lessons
        crew_id: providerId, // CRITICAL: Assign provider immediately
        field_id: service.location_details?.address || null,
        metadata: {
            bots_enabled: false,
            selected_offer: {
                serviceName: selectedPackage.name,
                price: selectedPackage.price,
                serviceId: service.id
            },
            description: description // Store generated description
        }
      })
      .select()
      .single();

    if (lobbyError) {
        throw new Error(`DB Insert Error: ${lobbyError.message}`);
    }
    if (!lobby) {
        throw new Error("Lobby creation failed (no data returned).");
    }

    // 5. Auto-join Owner (User) to ensure they are in members list
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: clientUserId,
      role: 'owner',
      team: "blue", // Default team
      is_bot: false,
      status: "ready"
    });

    // 6. Prepare Deep Link
    const lobbyDeepLink = `${BOT_APP_URL}?startapp=lobby_${lobby.id}`;

    // 7. Notify User (The Client)
    // Message: "Lobby created. Here is the link."
    const userMessageText = `
🏂 <b>ЛОББИ СОЗДАНО</b>
🎿 Урок "${selectedPackage.name}" с инструктором "${provider.name}" запланирован.
<br>Дата и время можете скорректировать в приложении.
👉 <a href="${lobbyDeepLink}">ОТКРЫТЬ ЛОББИ</a>
    `;

    await sendComplexMessage(clientUserId, userMessageText, [], {
        parseMode: 'HTML',
        imageQuery: 'snowboard slope'
    });

    // 8. Notify Provider (The Crew Owner)
    // Message: "New request from [Client]. Lobby created. Approve."
    // Note: We notify the provider owner_id (not necessarily the chat_id if it's a different user)
    const providerMessageText = `
🔔 <b>НОВЫЙ ЗАКАЗ НА УРОК</b>
👤 Клиент создал лобби для урока: <b>${selectedPackage.name}</b>
💰 Стоимость: ${selectedPackage.price} RUB

Пожалуйста, подтвердите готовность в приложении.
👉 <a href="${lobbyDeepLink}">ПЕРЕЙТИ В ПРИЛОЖЕНИЕ</a>
    `;

    await sendComplexMessage(provider.owner_id, providerMessageText, [], {
        parseMode: 'HTML',
        imageQuery: 'notification bell'
    });

    return { success: true, lobbyId: lobby.id };
  } catch (e: any) {
    logger.error("[createSnowboardLobby] Exception:", e);
    return { success: false, error: e.message };
  }
}