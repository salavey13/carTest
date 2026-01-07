"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";

export async function getProviderOffers(playerCount: number, activityId?: string) {
    const { data: providers, error } = await supabaseAdmin
        .from('crews')
        .select('*')
        .eq('metadata->>is_provider', 'true');

    if (error) return { success: false, error: error.message };

    const comparisons = providers.map(p => {
        const services = p.metadata.services || [];
        
        const offers = services
            .filter((s: any) => !activityId || s.id.includes(activityId))
            .map((s: any) => {
                const minReq = s.min_players || 0;
                const isAvailable = playerCount >= minReq;
                const bestPackage = s.packages[0] || {};
                
                return {
                    serviceName: s.name,
                    serviceId: s.id,
                    bestPackage,
                    totalPrice: bestPackage.price * playerCount,
                    perPerson: bestPackage.price,
                    currency: bestPackage.currency || 'RUB',
                    isAvailable,
                    minPlayers: minReq,
                    lockReason: !isAvailable ? `Требуется минимум ${minReq} чел.` : null,
                    description: s.description,
                    age_limit: s.age_limit,
                    gear_info: s.gear_info,
                    location_details: s.location_details
                };
            });

        return {
            providerId: p.id, // Explicitly pass the UUID
            providerName: p.name,
            providerSlug: p.slug,
            logo: p.logo_url,
            location: p.hq_location,
            working_hours: p.metadata.contacts?.working_hours,
            amenities: p.metadata.amenities || [],
            offers
        };
    }).filter(p => p.offers.length > 0);

    return { success: true, data: comparisons };
}

export async function selectProviderForLobby(lobbyId: string, providerId: string, offer: any) {
    try {
        // 1. Get current lobby metadata
        const { data: lobby } = await supabaseAdmin.from('lobbies').select('metadata').eq('id', lobbyId).single();
        
        const newMetadata = {
            ...lobby?.metadata,
            selected_offer: offer,
            approval_status: 'proposed' // Moves lobby to "Pending Provider Approval"
        };

        const { error } = await supabaseAdmin
            .from('lobbies')
            .update({ 
                provider_id: providerId,
                metadata: newMetadata 
            })
            .eq('id', lobbyId);

        if (error) throw error;
        
        revalidatePath(`/strikeball/lobbies/${lobbyId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// New function to add snowboarding instructor service to existing crew
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