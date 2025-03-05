-- Add has_script_access to users table
ALTER TABLE public.users
ADD COLUMN has_script_access BOOLEAN DEFAULT FALSE;

-- Table to store bot usernames and metadata
CREATE TABLE bots (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL, -- Maps to "user_name" from .xlsx
  account_id BIGINT UNIQUE, -- Maps to "account_id" from .xlsx
  full_name TEXT, -- Maps to "full name" from .xlsx
  created_at TIMESTAMP WITH TIME ZONE, -- Maps to "Create Date" from .xlsx
  confirmed BOOLEAN DEFAULT FALSE,
  submitted_by TEXT NOT NULL,
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
