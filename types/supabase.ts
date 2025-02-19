// types/supabase.ts
import type { Database } from "./database.types" //GEN IT "npx supabase gen types typescript --local > types/database.types.ts" OR ASK CHATGPT

declare global {
  // Тип пользователя
  type User = Database["public"]["Tables"]["users"]["Row"]

  // Тип автомобиля
  type Car = Database["public"]["Tables"]["cars"]["Row"]

  // Тип прогресса теста
  type TestProgress = {
    currentQuestion: number
    selectedAnswers: number[]
  }
}

// Экспорт для явного использования
export type { Database }

