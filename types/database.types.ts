export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          status: "free" | "pro" | "admin"
          role: "attendee"
          created_at: string
          updated_at: string
          active_organizer_id: string | null
          metadata: Json
          description: string | null
          badges: Json | null
          test_progress: Json | null
        }
        Insert: {
          user_id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          status?: "free" | "pro" | "admin"
          role?: "attendee"
          created_at?: string
          updated_at?: string
          active_organizer_id?: string | null
          metadata?: Json
          description?: string | null
          badges?: Json | null
          test_progress?: Json | null
        }
      }
      questions: {
        Row: {
          id: number
          text: string
          theme: string
          position: number
        }
        Insert: {
          id?: number
          text: string
          theme: string
          position: number
        }
      }
      cars: {
        Row: {
          id: string // Changed from UUID to text
          make: string
          model: string
          description: string
          embedding: number[] | null
          daily_price: number
          image_url: string
          rent_link: string
          is_test_result: boolean
        }
        Insert: {
          id?: string // Changed from UUID to text
          make: string
          model: string
          description: string
          embedding?: number[] | null
          daily_price: number
          image_url: string
          rent_link: string
          is_test_result?: boolean
        }
      }
      answers: {
        Row: {
          id: number
          question_id: number | null
          text: string
          result: string | null // Matches `cars.id` (text)
        }
        Insert: {
          id?: number
          question_id?: number | null
          text: string
          result?: string | null
        }
      }
      user_results: {
        Row: {
          user_id: string | null
          car_id: string | null // Matches `cars.id` (text)
          created_at: string
        }
        Insert: {
          user_id?: string | null
          car_id?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      search_cars: {
        Args: { query_embedding: number[]; match_count: number }
        Returns: { id: string; make: string; model: string; similarity: number }[]
      }
      similar_cars: {
        Args: { car_id: string; match_count?: number }
        Returns: {
          id: string
          make: string
          model: string
          description: string
          embedding: number[] | null
          daily_price: number
          image_url: string
          rent_link: string
          is_test_result: boolean
        }[]
      }
    }
  }
}

