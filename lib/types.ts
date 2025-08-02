import { Database } from "@/types/database.types";

// 1. Берем базовый тип для строки из таблицы 'crews'.
//    Это основа, наш "фундамент".
type CrewBase = Database['public']['Tables']['crews']['Row'];

// 2. Определяем, какие поля ДОБАВЛЯЕТ наша RPC-функция.
//    Это наши "модификаторы".
type CrewRpcCounts = {
  owner_username: string;
  member_count: number;
  vehicle_count: number;
};

// 3. ОБЪЕДИНЯЕМ их в один мощный, точный тип.
//    Это и есть наш 'CrewWithCounts', которого не хватало.
//    Он наследует все поля от 'crews' И добавляет кастомные поля из RPC.
export type CrewWithCounts = CrewBase & CrewRpcCounts;