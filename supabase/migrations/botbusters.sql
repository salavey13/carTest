-- Table to store bot usernames submitted by users
CREATE TABLE blocklist (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (submitted_by) REFERENCES users(user_id)
);

-- Table to log actions taken against bots (for stats)
CREATE TABLE actions (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL, -- e.g., 'block', 'report'
  target_username TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (performed_by) REFERENCES users(user_id)
);
