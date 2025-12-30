-- Add columns to store encrypted credentials for auto re-login
ALTER TABLE public.broker_sessions 
ADD COLUMN IF NOT EXISTS encrypted_password TEXT,
ADD COLUMN IF NOT EXISTS encrypted_totp_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';