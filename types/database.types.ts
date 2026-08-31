// AUTO-GENERATED FILE — DO NOT EDIT ROW/TABLE SHAPES BY HAND.
// Regenerate with: npm run gen:db-types   (reads the live PostgREST OpenAPI spec)
// Generated: 2026-08-31T02:22:44.841Z
//
// Layout: strict shapes for franchize product tables (list in
// scripts/gen-db-types.mjs), loose rows for legacy sandbox tables and views,
// and a MANUAL Functions block that is carried over on each regeneration —
// edit Functions directly in this file, they survive regeneration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type LooseSupabaseRow = { [key: string]: any }
type LooseSupabaseTable = {
  Row: LooseSupabaseRow
  Insert: LooseSupabaseRow
  Update: LooseSupabaseRow
  Relationships: []
}
type LooseSupabaseView = {
  Row: LooseSupabaseRow
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      actions: LooseSupabaseTable
      ai_requests: LooseSupabaseTable
      analytics_passwords: LooseSupabaseTable
      answers: LooseSupabaseTable
      arbitrage_user_settings: LooseSupabaseTable
      article_sections: LooseSupabaseTable
      articles: LooseSupabaseTable
      audit_progress: LooseSupabaseTable
      audit_reports: LooseSupabaseTable
      bots: LooseSupabaseTable
      car_sizes: LooseSupabaseTable
      cars: {
        Row: {
          id: string
          make: string
          model: string
          description: string
          embedding: string | null
          daily_price: number | null
          image_url: string
          rent_link: string | null
          is_test_result: boolean | null
          specs: Json | null
          owner_id: string | null
          type: string
          crew_id: string | null
          availability_rules: Json | null
          quantity: number | null
        }
        Insert: {
          id: string
          make: string
          model: string
          description: string
          embedding?: string | null
          daily_price?: number | null
          image_url: string
          rent_link?: string | null
          is_test_result?: boolean | null
          specs?: Json | null
          owner_id?: string | null
          type?: string
          crew_id?: string | null
          availability_rules?: Json | null
          quantity?: number | null
        }
        Update: {
          id?: string
          make?: string
          model?: string
          description?: string
          embedding?: string
          daily_price?: number
          image_url?: string
          rent_link?: string
          is_test_result?: boolean
          specs?: Json
          owner_id?: string
          type?: string
          crew_id?: string
          availability_rules?: Json
          quantity?: number
        }
        Relationships: [
        ]
      }
      cash_transactions: {
        Row: {
          id: string
          crew_id: string
          rental_id: string | null
          sale_contract_id: string | null
          equipment_rental_id: string | null
          salary_calc_id: string | null
          transaction_type: string
          flow_direction: string
          amount: number
          payment_method: string | null
          from_user_id: string | null
          to_user_id: string | null
          category: string | null
          description: string | null
          transaction_date: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          rental_id?: string | null
          sale_contract_id?: string | null
          equipment_rental_id?: string | null
          salary_calc_id?: string | null
          transaction_type: string
          flow_direction: string
          amount: number
          payment_method?: string | null
          from_user_id?: string | null
          to_user_id?: string | null
          category?: string | null
          description?: string | null
          transaction_date?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crew_id?: string
          rental_id?: string
          sale_contract_id?: string
          equipment_rental_id?: string
          salary_calc_id?: string
          transaction_type?: string
          flow_direction?: string
          amount?: number
          payment_method?: string
          from_user_id?: string
          to_user_id?: string
          category?: string
          description?: string
          transaction_date?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "equipment_rentals_equipment_rental_id_fkey"
            columns: ["equipment_rental_id"]
            isOneToOne: false
            referencedRelation: "equipment_rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_calculations_salary_calc_id_fkey"
            columns: ["salary_calc_id"]
            isOneToOne: false
            referencedRelation: "salary_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      characters: LooseSupabaseTable
      checklist_state: {
        Row: {
          type: string
          items: Json
          updated_at: string
        }
        Insert: {
          type: string
          items: Json
          updated_at?: string
        }
        Update: {
          type?: string
          items?: Json
          updated_at?: string
        }
        Relationships: [
        ]
      }
      chemicals: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      commercial_proposal_artifacts: LooseSupabaseTable
      commission_rates: {
        Row: {
          id: string
          crew_id: string
          operation_type: string
          commission_type: string
          commission_value: number
          priority: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          operation_type: string
          commission_type: string
          commission_value: number
          priority?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crew_id?: string
          operation_type?: string
          commission_type?: string
          commission_value?: number
          priority?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      config: LooseSupabaseTable
      consumption_rates: LooseSupabaseTable
      coze_responses: LooseSupabaseTable
      crew_member_shifts: {
        Row: {
          id: string
          member_id: string
          crew_id: string
          clock_in_time: string
          clock_out_time: string | null
          duration_minutes: number | null
          shift_type: string
          checkpoint: Json | null
          actions: Json | null
          hourly_rate: number | null
          salary_amount: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          member_id: string
          crew_id: string
          clock_in_time?: string
          clock_out_time?: string | null
          duration_minutes?: number | null
          shift_type?: string
          checkpoint?: Json | null
          actions?: Json | null
          hourly_rate?: number | null
          salary_amount?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          crew_id?: string
          clock_in_time?: string
          clock_out_time?: string
          duration_minutes?: number
          shift_type?: string
          checkpoint?: Json
          actions?: Json
          hourly_rate?: number
          salary_amount?: number
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          id: string
          crew_id: string
          user_id: string
          role: string
          joined_at: string | null
          membership_status: string
          last_location: string | null
          live_status: string
        }
        Insert: {
          id?: string
          crew_id: string
          user_id: string
          role?: string
          joined_at?: string | null
          membership_status?: string
          last_location?: string | null
          live_status?: string
        }
        Update: {
          id?: string
          crew_id?: string
          user_id?: string
          role?: string
          joined_at?: string
          membership_status?: string
          last_location?: string
          live_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      crew_secrets: LooseSupabaseTable
      crew_todos: {
        Row: {
          id: string
          crew_id: string
          assigned_to: string | null
          title: string
          description: string | null
          category: string
          status: string
          priority: string
          due_date: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          completed_at: string | null
          lead_id: string | null
          user_id: string | null
          phone: string | null
          rental_id: string | null
        }
        Insert: {
          id: string
          crew_id: string
          assigned_to?: string | null
          title: string
          description?: string | null
          category?: string
          status?: string
          priority?: string
          due_date?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          completed_at?: string | null
          lead_id?: string | null
          user_id?: string | null
          phone?: string | null
          rental_id?: string | null
        }
        Update: {
          id?: string
          crew_id?: string
          assigned_to?: string
          title?: string
          description?: string
          category?: string
          status?: string
          priority?: string
          due_date?: string
          created_at?: string
          created_by?: string
          updated_at?: string
          completed_at?: string
          lead_id?: string
          user_id?: string
          phone?: string
          rental_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
        ]
      }
      crews: {
        Row: {
          id: string
          name: string
          description: string | null
          logo_url: string | null
          owner_id: string
          created_at: string | null
          updated_at: string | null
          slug: string | null
          hq_location: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          logo_url?: string | null
          owner_id: string
          created_at?: string | null
          updated_at?: string | null
          slug?: string | null
          hq_location?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          name?: string
          description?: string
          logo_url?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          slug?: string
          hq_location?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "users_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deposit_entries: {
        Row: {
          id: string
          rental_id: string
          entry_type: string
          amount: number
          direction: string
          destination: string
          operator_chat_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rental_id: string
          entry_type: string
          amount: number
          direction: string
          destination: string
          operator_chat_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rental_id?: string
          entry_type?: string
          amount?: number
          direction?: string
          destination?: string
          operator_chat_id?: string
          notes?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
        ]
      }
      deposit_log: LooseSupabaseTable
      doc_verifier_records: {
        Row: {
          id: string
          integration_scope: string
          document_key: string
          source_file_name: string
          original_storage_path: string
          original_sha256: string
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_scope?: string
          document_key: string
          source_file_name: string
          original_storage_path: string
          original_sha256: string
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_scope?: string
          document_key?: string
          source_file_name?: string
          original_storage_path?: string
          original_sha256?: string
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      docpix: LooseSupabaseTable
      equipment_rentals: {
        Row: {
          id: string
          crew_id: string
          equipment_id: string
          renter_user_id: string | null
          primary_rental_id: string | null
          start_date: string
          end_date: string | null
          expected_return_date: string | null
          daily_price: number
          total_cost: number
          status: string
          issued_by: string | null
          received_by: string | null
          issued_at: string | null
          returned_at: string | null
          condition_notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          equipment_id: string
          renter_user_id?: string | null
          primary_rental_id?: string | null
          start_date?: string
          end_date?: string | null
          expected_return_date?: string | null
          daily_price?: number
          total_cost?: number
          status?: string
          issued_by?: string | null
          received_by?: string | null
          issued_at?: string | null
          returned_at?: string | null
          condition_notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crew_id?: string
          equipment_id?: string
          renter_user_id?: string
          primary_rental_id?: string
          start_date?: string
          end_date?: string
          expected_return_date?: string
          daily_price?: number
          total_cost?: number
          status?: string
          issued_by?: string
          received_by?: string
          issued_at?: string
          returned_at?: string
          condition_notes?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_renter_user_id_fkey"
            columns: ["renter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rentals_primary_rental_id_fkey"
            columns: ["primary_rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "users_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          rental_id: string
          type: string
          status: string
          payload: Json | null
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          rental_id: string
          type: string
          status?: string
          payload?: Json | null
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          rental_id?: string
          type?: string
          status?: string
          payload?: Json
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      franchize_intents: {
        Row: {
          id: string
          slug: string
          bike_id: string | null
          intent_type: string
          stage: string
          source_route: string | null
          contact_channel: string | null
          urgency_score: number
          metadata: Json
          telegram_user_id: string | null
          phone: string | null
          last_seen_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          bike_id?: string | null
          intent_type: string
          stage: string
          source_route?: string | null
          contact_channel?: string | null
          urgency_score?: number
          metadata: Json
          telegram_user_id?: string | null
          phone?: string | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          bike_id?: string
          intent_type?: string
          stage?: string
          source_route?: string
          contact_channel?: string
          urgency_score?: number
          metadata?: Json
          telegram_user_id?: string
          phone?: string
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      franchize_order_notifications: {
        Row: {
          id: string
          slug: string
          order_id: string
          payload: Json
          send_status: string
          attempts: number
          rendered_markdown: string | null
          doc_file_name: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          order_id: string
          payload: Json
          send_status?: string
          attempts?: number
          rendered_markdown?: string | null
          doc_file_name?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          order_id?: string
          payload?: Json
          send_status?: string
          attempts?: number
          rendered_markdown?: string
          doc_file_name?: string
          last_error?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      god_mode_simulations: {
        Row: {
          id: string
          user_id: string
          created_at: string
          simulation_result: Json
          is_viewed: boolean
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          simulation_result: Json
          is_viewed?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          simulation_result?: Json
          is_viewed?: boolean
        }
        Relationships: [
        ]
      }
      greenbox_irrigation_queue: LooseSupabaseTable
      greenbox_plants: LooseSupabaseTable
      homework_daily_solutions: {
        Row: {
          id: string
          homework_date: string
          solution_key: string
          subject: string | null
          topic: string
          given: string
          steps: Json
          answer: string
          solution_markdown: string | null
          full_solution_rich: string | null
          rewrite_for_notebook: string | null
          source_hints: Json
          screenshot_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          homework_date?: string
          solution_key: string
          subject?: string | null
          topic: string
          given: string
          steps: Json
          answer: string
          solution_markdown?: string | null
          full_solution_rich?: string | null
          rewrite_for_notebook?: string | null
          source_hints: Json
          screenshot_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          homework_date?: string
          solution_key?: string
          subject?: string
          topic?: string
          given?: string
          steps?: Json
          answer?: string
          solution_markdown?: string
          full_solution_rich?: string
          rewrite_for_notebook?: string
          source_hints?: Json
          screenshot_url?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          subscription_id: string
          status: string | null
          amount: number
          currency: string | null
          created_at: string | null
          updated_at: string | null
          metadata: Json | null
          type: string | null
        }
        Insert: {
          id: string
          user_id: string
          subscription_id: string
          status?: string | null
          amount: number
          currency?: string | null
          created_at?: string | null
          updated_at?: string | null
          metadata?: Json | null
          type?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string
          status?: string
          amount?: number
          currency?: string
          created_at?: string
          updated_at?: string
          metadata?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          id: string
          lead_id: string
          crew_id: string
          text: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          crew_id: string
          text: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          crew_id?: string
          text?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: LooseSupabaseTable
      leads_optima: LooseSupabaseTable
      live_locations: {
        Row: {
          id: string
          user_id: string
          crew_slug: string | null
          lat: number
          lng: number
          speed_kmh: number | null
          heading: number | null
          is_riding: boolean | null
          updated_at: string | null
          location: string | null
        }
        Insert: {
          id?: string
          user_id: string
          crew_slug?: string | null
          lat: number
          lng: number
          speed_kmh?: number | null
          heading?: number | null
          is_riding?: boolean | null
          updated_at?: string | null
          location?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          crew_slug?: string
          lat?: number
          lng?: number
          speed_kmh?: number
          heading?: number
          is_riding?: boolean
          updated_at?: string
          location?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lobbies: LooseSupabaseTable
      lobby_checkpoints: LooseSupabaseTable
      lobby_geo_pings: LooseSupabaseTable
      lobby_members: LooseSupabaseTable
      map_rider_meetups: LooseSupabaseTable
      map_rider_points: LooseSupabaseTable
      map_rider_sessions: LooseSupabaseTable
      maps: {
        Row: {
          id: string
          name: string
          map_image_url: string
          bounds: Json
          points_of_interest: Json | null
          is_default: boolean | null
          created_at: string | null
          owner_id: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          map_image_url: string
          bounds: Json
          points_of_interest?: Json | null
          is_default?: boolean | null
          created_at?: string | null
          owner_id?: string | null
          metadata: Json
        }
        Update: {
          id?: string
          name?: string
          map_image_url?: string
          bounds?: Json
          points_of_interest?: Json
          is_default?: boolean
          created_at?: string
          owner_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "users_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      market_data: {
        Row: {
          id: number
          exchange: string
          symbol: string
          bid_price: number
          ask_price: number
          last_price: number
          volume: number
          timestamp: string
          is_simulated: boolean
        }
        Insert: {
          id: number
          exchange: string
          symbol: string
          bid_price: number
          ask_price: number
          last_price: number
          volume: number
          timestamp?: string
          is_simulated?: boolean
        }
        Update: {
          id?: number
          exchange?: string
          symbol?: string
          bid_price?: number
          ask_price?: number
          last_price?: number
          volume?: number
          timestamp?: string
          is_simulated?: boolean
        }
        Relationships: [
        ]
      }
      message_templates: {
        Row: {
          id: string
          crew_id: string | null
          template_key: string
          name: string
          subject: string | null
          body: string
          channel: string
          language: string
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crew_id?: string | null
          template_key: string
          name: string
          subject?: string | null
          body: string
          channel?: string
          language?: string
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crew_id?: string
          template_key?: string
          name?: string
          subject?: string
          body?: string
          channel?: string
          language?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      notified_opportunities: LooseSupabaseTable
      orders: LooseSupabaseTable
      processed_orders: LooseSupabaseTable
      processed_services: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      profiles: LooseSupabaseTable
      questions: LooseSupabaseTable
      referral_activities: LooseSupabaseTable
      referral_codes: LooseSupabaseTable
      referral_commissions: LooseSupabaseTable
      referral_relationships: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      rental_contract_artefacts: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      rental_contract_artifacts: LooseSupabaseTable
      rental_handoffs: {
        Row: {
          id: string
          rental_id: string
          phase: string
          passport_checked: boolean | null
          license_checked: boolean | null
          deposit_collected: boolean | null
          helmet_issued: boolean | null
          keys_issued: boolean | null
          instructions_given: boolean | null
          photos_taken: boolean | null
          condition_checked: boolean | null
          helmet_returned: boolean | null
          keys_returned: boolean | null
          deposit_returned: boolean | null
          no_damages_confirmed: boolean | null
          odometer_start: number | null
          odometer_end: number | null
          fuel_level_start: number | null
          fuel_level_end: number | null
          battery_level_start: number | null
          battery_level_end: number | null
          damage_notes: string | null
          handout_notes: string | null
          return_notes: string | null
          keys_count: number | null
          charger_included: boolean | null
          lock_cable_included: boolean | null
          jacket_issued: boolean | null
          second_helmet_issued: boolean | null
          bag_issued: boolean | null
          net_issued: boolean | null
          camera_mount_issued: boolean | null
          moto_cover_issued: boolean | null
          ebike_charger_issued: boolean | null
          other_equipment: string | null
          equipment_condition_return: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rental_id: string
          phase: string
          passport_checked?: boolean | null
          license_checked?: boolean | null
          deposit_collected?: boolean | null
          helmet_issued?: boolean | null
          keys_issued?: boolean | null
          instructions_given?: boolean | null
          photos_taken?: boolean | null
          condition_checked?: boolean | null
          helmet_returned?: boolean | null
          keys_returned?: boolean | null
          deposit_returned?: boolean | null
          no_damages_confirmed?: boolean | null
          odometer_start?: number | null
          odometer_end?: number | null
          fuel_level_start?: number | null
          fuel_level_end?: number | null
          battery_level_start?: number | null
          battery_level_end?: number | null
          damage_notes?: string | null
          handout_notes?: string | null
          return_notes?: string | null
          keys_count?: number | null
          charger_included?: boolean | null
          lock_cable_included?: boolean | null
          jacket_issued?: boolean | null
          second_helmet_issued?: boolean | null
          bag_issued?: boolean | null
          net_issued?: boolean | null
          camera_mount_issued?: boolean | null
          moto_cover_issued?: boolean | null
          ebike_charger_issued?: boolean | null
          other_equipment?: string | null
          equipment_condition_return?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rental_id?: string
          phase?: string
          passport_checked?: boolean
          license_checked?: boolean
          deposit_collected?: boolean
          helmet_issued?: boolean
          keys_issued?: boolean
          instructions_given?: boolean
          photos_taken?: boolean
          condition_checked?: boolean
          helmet_returned?: boolean
          keys_returned?: boolean
          deposit_returned?: boolean
          no_damages_confirmed?: boolean
          odometer_start?: number
          odometer_end?: number
          fuel_level_start?: number
          fuel_level_end?: number
          battery_level_start?: number
          battery_level_end?: number
          damage_notes?: string
          handout_notes?: string
          return_notes?: string
          keys_count?: number
          charger_included?: boolean
          lock_cable_included?: boolean
          jacket_issued?: boolean
          second_helmet_issued?: boolean
          bag_issued?: boolean
          net_issued?: boolean
          camera_mount_issued?: boolean
          moto_cover_issued?: boolean
          ebike_charger_issued?: boolean
          other_equipment?: string
          equipment_condition_return?: string
          completed_at?: string
          completed_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
        ]
      }
      rental_photos: {
        Row: {
          id: string
          rental_id: string
          photo_type: string
          storage_path: string
          file_size_bytes: number
          sha256_hash: string
          mime_type: string
          width: number | null
          height: number | null
          uploaded_by: string
          uploader_role: string
          source: string
          archived_at: string | null
          deleted_at: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          rental_id: string
          photo_type: string
          storage_path: string
          file_size_bytes: number
          sha256_hash: string
          mime_type?: string
          width?: number | null
          height?: number | null
          uploaded_by: string
          uploader_role: string
          source?: string
          archived_at?: string | null
          deleted_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          rental_id?: string
          photo_type?: string
          storage_path?: string
          file_size_bytes?: number
          sha256_hash?: string
          mime_type?: string
          width?: number
          height?: number
          uploaded_by?: string
          uploader_role?: string
          source?: string
          archived_at?: string
          deleted_at?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "users_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rental_reviews: {
        Row: {
          id: string
          rental_id: string
          user_id: string
          bike_id: string
          crew_id: string
          rating: number
          text: string
          hidden_at: string | null
          moderated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rental_id: string
          user_id: string
          bike_id: string
          crew_id: string
          rating: number
          text?: string
          hidden_at?: string | null
          moderated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rental_id?: string
          user_id?: string
          bike_id?: string
          crew_id?: string
          rating?: number
          text?: string
          hidden_at?: string
          moderated_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cars_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rental_verification_docs: LooseSupabaseTable
      rentals: {
        Row: {
          rental_id: string
          user_id: string
          vehicle_id: string
          owner_id: string
          status: string
          payment_status: string
          interest_amount: number | null
          total_cost: number | null
          requested_start_date: string | null
          requested_end_date: string | null
          agreed_start_date: string | null
          agreed_end_date: string | null
          delivery_address: string | null
          created_at: string | null
          updated_at: string | null
          metadata: Json | null
          passport_mainpage_photo: string | null
          passport_registration_photo: string | null
          drivers_licence_frontal_photo: string | null
          crew_id: string | null
          created_by_operator_chat_id: string | null
          deposit_amount: number | null
          deposit_method: string | null
          deposit_collected_at: string | null
          deposit_collected_by: string | null
          deposit_returned: boolean | null
          deposit_returned_at: string | null
          deposit_returned_by: string | null
          deposit_notes: string | null
          start_photo_count: number
          end_photo_count: number
        }
        Insert: {
          rental_id?: string
          user_id: string
          vehicle_id: string
          owner_id: string
          status?: string
          payment_status?: string
          interest_amount?: number | null
          total_cost?: number | null
          requested_start_date?: string | null
          requested_end_date?: string | null
          agreed_start_date?: string | null
          agreed_end_date?: string | null
          delivery_address?: string | null
          created_at?: string | null
          updated_at?: string | null
          metadata?: Json | null
          passport_mainpage_photo?: string | null
          passport_registration_photo?: string | null
          drivers_licence_frontal_photo?: string | null
          crew_id?: string | null
          created_by_operator_chat_id?: string | null
          deposit_amount?: number | null
          deposit_method?: string | null
          deposit_collected_at?: string | null
          deposit_collected_by?: string | null
          deposit_returned?: boolean | null
          deposit_returned_at?: string | null
          deposit_returned_by?: string | null
          deposit_notes?: string | null
          start_photo_count?: number
          end_photo_count?: number
        }
        Update: {
          rental_id?: string
          user_id?: string
          vehicle_id?: string
          owner_id?: string
          status?: string
          payment_status?: string
          interest_amount?: number
          total_cost?: number
          requested_start_date?: string
          requested_end_date?: string
          agreed_start_date?: string
          agreed_end_date?: string
          delivery_address?: string
          created_at?: string
          updated_at?: string
          metadata?: Json
          passport_mainpage_photo?: string
          passport_registration_photo?: string
          drivers_licence_frontal_photo?: string
          crew_id?: string
          created_by_operator_chat_id?: string
          deposit_amount?: number
          deposit_method?: string
          deposit_collected_at?: string
          deposit_collected_by?: string
          deposit_returned?: boolean
          deposit_returned_at?: string
          deposit_returned_by?: string
          deposit_notes?: string
          start_photo_count?: number
          end_photo_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cars_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_calc: LooseSupabaseTable
      salary_calculations: {
        Row: {
          id: string
          salary_plan_id: string
          period_start: string
          period_end: string
          shift_income: number
          commission_income: number
          bonus_income: number
          total_income: number
          payout_date: string
          payout_status: string
          paid_at: string | null
          cash_transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salary_plan_id: string
          period_start: string
          period_end: string
          shift_income?: number
          commission_income?: number
          bonus_income?: number
          total_income?: number
          payout_date: string
          payout_status?: string
          paid_at?: string | null
          cash_transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salary_plan_id?: string
          period_start?: string
          period_end?: string
          shift_income?: number
          commission_income?: number
          bonus_income?: number
          total_income?: number
          payout_date?: string
          payout_status?: string
          paid_at?: string
          cash_transaction_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_plans_salary_plan_id_fkey"
            columns: ["salary_plan_id"]
            isOneToOne: false
            referencedRelation: "salary_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_cash_transaction_id_fkey"
            columns: ["cash_transaction_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_plans: {
        Row: {
          id: string
          crew_id: string
          member_id: string
          period_start: string
          period_end: string
          payout_schedule: string[]
          base_salary: number
          total_accrued: number
          total_paid: number
          balance_due: number
          last_payout_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crew_id: string
          member_id: string
          period_start: string
          period_end: string
          payout_schedule: string[]
          base_salary?: number
          total_accrued?: number
          total_paid?: number
          balance_due?: number
          last_payout_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crew_id?: string
          member_id?: string
          period_start?: string
          period_end?: string
          payout_schedule?: string[]
          base_salary?: number
          total_accrued?: number
          total_paid?: number
          balance_due?: number
          last_payout_date?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      sale_contract_artifacts: LooseSupabaseTable
      service_types: LooseSupabaseTable
      settings: LooseSupabaseTable
      subjects: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      subrent_contract_artifacts: LooseSupabaseTable
      supaplan_agents: LooseSupabaseTable
      supaplan_claims: LooseSupabaseTable
      supaplan_events: LooseSupabaseTable
      supaplan_tasks: LooseSupabaseTable
      tasks: LooseSupabaseTable
      temp_franchize_carts: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      testdrive_contract_artifacts: LooseSupabaseTable
      testimonials: LooseSupabaseTable
      todos: LooseSupabaseTable
      tournament_matches: LooseSupabaseTable
      tournaments: LooseSupabaseTable
      user_purchases: {
        Row: {
          id: string
          user_id: string
          item_id: string
          quantity: number | null
          total_price: number
          status: string | null
          created_at: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          item_id: string
          quantity?: number | null
          total_price: number
          status?: string | null
          created_at?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          item_id?: string
          quantity?: number
          total_price?: number
          status?: string
          created_at?: string
          metadata?: Json
        }
        Relationships: [
        ]
      }
      user_referral_balances: LooseSupabaseTable
      // NOT exposed in the REST spec (private schema or dropped) — kept loose:
      user_rental_secrets: LooseSupabaseTable
      user_results: LooseSupabaseTable
      user_states: {
        Row: {
          user_id: string
          state: string
          context: Json | null
          expires_at: string | null
          created_at: string | null
          current_step: number | null
          total_steps: number | null
          corrected_steps: number[] | null
        }
        Insert: {
          user_id: string
          state: string
          context?: Json | null
          expires_at?: string | null
          created_at?: string | null
          current_step?: number | null
          total_steps?: number | null
          corrected_steps?: number[] | null
        }
        Update: {
          user_id?: string
          state?: string
          context?: Json
          expires_at?: string
          created_at?: string
          current_step?: number
          total_steps?: number
          corrected_steps?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_survey_state: {
        Row: {
          user_id: string
          current_step: number
          answers: Json
          last_updated_at: string
          message_id: number | null
        }
        Insert: {
          user_id: string
          current_step?: number
          answers: Json
          last_updated_at?: string
          message_id?: number | null
        }
        Update: {
          user_id?: string
          current_step?: number
          answers?: Json
          last_updated_at?: string
          message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_surveys: {
        Row: {
          id: string
          user_id: string
          username: string | null
          survey_data: Json
          completed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          survey_data: Json
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          survey_data?: Json
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          user_id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          status: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
          active_organizer_id: string | null
          metadata: Json
          description: string | null
          badges: Json | null
          test_progress: Json | null
          language_code: string | null
          subscription_id: string | null
          has_script_access: boolean | null
          project_type_guess: string | null
        }
        Insert: {
          user_id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          status?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
          active_organizer_id?: string | null
          metadata: Json
          description?: string | null
          badges?: Json | null
          test_progress?: Json | null
          language_code?: string | null
          subscription_id?: string | null
          has_script_access?: boolean | null
          project_type_guess?: string | null
        }
        Update: {
          user_id?: string
          username?: string
          full_name?: string
          avatar_url?: string
          website?: string
          status?: string
          role?: string
          created_at?: string
          updated_at?: string
          active_organizer_id?: string
          metadata?: Json
          description?: string
          badges?: Json
          test_progress?: Json
          language_code?: string
          subscription_id?: string
          has_script_access?: boolean
          project_type_guess?: string
        }
        Relationships: [
        ]
      }
      vpr_answers: LooseSupabaseTable
      vpr_attempt_answers: LooseSupabaseTable
      vpr_questions: LooseSupabaseTable
      vpr_test_attempts: LooseSupabaseTable
    }
    Views: {
      arbitrage_opportunities: {
        Row: LooseSupabaseRow
      }
      daily_cash_flow: {
        Row: LooseSupabaseRow
      }
      daily_deposit_summary: {
        Row: LooseSupabaseRow
      }
      mv_map_riders_weekly_leaderboard: {
        Row: LooseSupabaseRow
      }
      prepayment_summary: {
        Row: LooseSupabaseRow
      }
      referral_statistics: {
        Row: LooseSupabaseRow
      }
    }
    Functions: {
      capture_vip_bike_callback_intent: {
        Args: {
          p_intent_id: string
          p_bike_id: string | null
          p_phone: string
          p_source_route: string
          p_ip_hash: string
          p_metadata: Json
          p_notification_attempt_id: string
        }
        Returns: {
          result_status: string
          intent_id: string
          intent_metadata: Json
          retry_after_seconds: number
        }[]
      }
      finalize_vip_bike_callback_notification: {
        Args: {
          p_intent_id: string
          p_notification_attempt_id: string
          p_notification_status: string
        }
        Returns: boolean
      }
      get_public_crews: {
        Args: Record<string, unknown>
        Returns: {
          id: string
          name: string
          slug: string
          description: string
          logo_url: string
          owner_username: string
          member_count: number
          vehicle_count: number
        }[]
      }
      get_public_crew_details: {
        Args: {
          p_slug: string
        }
        Returns: Json
      }
      // Add other functions if needed, for example:
      // search_cars: { ... }
      // similar_cars: { ... }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
