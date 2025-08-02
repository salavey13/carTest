import { Database } from "@/types/database.types";

// Тип для списка команд (уже был)
export type CrewWithCounts = Database['public']['Functions']['get_public_crews']['Returns'][number];

// ====================================================================
// ✨ НОВЫЕ ТИПЫ ДЛЯ ДЕТАЛЬНОЙ ИНФОРМАЦИИ О КОМАНДЕ ✨
// ====================================================================

// Вложенный тип для владельца
export type CrewOwnerDetails = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

// Вложенный тип для участника
export type CrewMemberDetails = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
};

// Вложенный тип для техники
export type CrewVehicleDetails = {
  id: string;
  make: string | null;
  model: string | null;
  image_url: string | null;
};

// Основной тип, описывающий ПОЛНЫЙ ответ от get_public_crew_details
// Мы берем базовые поля из таблицы 'crews' и добавляем к ним вложенные JSON-объекты
export type CrewDetails = Database['public']['Tables']['crews']['Row'] & {
  owner: CrewOwnerDetails;
  members: CrewMemberDetails[];
  vehicles: CrewVehicleDetails[];
};