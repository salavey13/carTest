import type { Database } from "./database.types" //GEN IT "npx supabase gen types typescript --local > types/database.types.ts" OR ASK CHATGPT

declare global {
  // Тип пользователя (restored from context)
  // Added comment about metadata structure
  // Note: The 'metadata' field is JSONB. It might contain various flags.
  // For the dummy mode feature, we expect:
  // metadata: {
  //   is_dummy_mode_disabled_by_parent?: boolean; // Set to true if parent paid to disable dummy mode
  //   // ... potentially other metadata keys
  // }
  type User = Database["public"]["Tables"]["users"]["Row"]

  // Тип автомобиля (restored from context)
  type Car = Database["public"]["Tables"]["cars"]["Row"]

  // Тип прогресса теста (restored from context)
  type TestProgress = {
    currentQuestion: number
    selectedAnswers: number[]
  }

  // Add VPR specific types based on page component interfaces and schema
  type VprSubject = Database["public"]["Tables"]["subjects"]["Row"];
  // Combine generated type with explicit nested 'vpr_answers' if needed,
  // or rely on select query structure. Assuming select fetches it.
  type VprQuestion = Database["public"]["Tables"]["vpr_questions"]["Row"] & {
      vpr_answers: VprAnswer[]; // Explicitly type nested relation
  };
  type VprAnswer = Database["public"]["Tables"]["vpr_answers"]["Row"];
  type VprTestAttempt = Database["public"]["Tables"]["vpr_test_attempts"]["Row"];
  type VprAttemptAnswer = Database["public"]["Tables"]["vpr_attempt_answers"]["Row"];

}

// Экспорт для явного использования (restored from context)
export type { Database }

// Export consolidated types for easier import elsewhere
export type {
  User,
  Car,
  TestProgress,
  VprSubject,
  VprQuestion,
  VprAnswer,
  VprTestAttempt,
  VprAttemptAnswer
};