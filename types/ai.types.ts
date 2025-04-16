/**
 * Represents the status of an AI request.
 */
export type AiRequestStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Structure for inserting a new AI request into the database.
 */
export interface AiRequestInsert {
  user_id: string; // text user_id from users table
  prompt: string;
  status?: AiRequestStatus; // Defaults to 'pending' in DB
  model_name?: string;
  generation_config?: Record<string, any>;
  safety_settings?: any[];
}

/**
 * Structure representing a full AI request record from the database.
 */
export interface AiRequestRecord extends AiRequestInsert {
  id: string; // uuid, primary key
  created_at: string; // timestamp with time zone
  updated_at: string; // timestamp with time zone
  response?: string | null;
  error_message?: string | null;
  status: AiRequestStatus; // Non-optional after fetching
}