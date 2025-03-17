-- Add has_script_access to users table
ALTER TABLE public.users
ADD COLUMN has_script_access BOOLEAN DEFAULT FALSE;

-- Updated bots table to match CSV headers and script requirements
CREATE TABLE bots (
  id SERIAL PRIMARY KEY,
  user_id TEXT, -- Maps to "user_id" (submitter ID), references users(user_id)
  account_id BIGINT UNIQUE, -- Maps to "account_id" (bot account ID)
  user_name TEXT UNIQUE NOT NULL, -- Maps to "user_name" (bot username)
  full_name TEXT, -- Maps to "full name"
  creation_ts BIGINT, -- Maps to "creation TS" (Unix timestamp in seconds)
  create_time TIMESTAMP WITH TIME ZONE, -- Maps to "Create Time" (human-readable)
  active_ts BIGINT, -- Maps to "ative TS" (corrected typo, Unix timestamp)
  last_active_time TIMESTAMP WITH TIME ZONE, -- Maps to "Last Active time (as 10/20/2024)"
  confirmed BOOLEAN DEFAULT FALSE, -- Tracks bot confirmation status
  submitted_by TEXT NOT NULL, -- Duplicate of user_id for clarity, references users(user_id)
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (submitted_by) REFERENCES users(user_id)
);
-- Table to log actions taken against bots (for stats)
CREATE TABLE actions (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL, -- e.g., 'block', 'report'
  target_username TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (performed_by) REFERENCES users(user_id),
  FOREIGN KEY (target_username) REFERENCES bots(username)
);
