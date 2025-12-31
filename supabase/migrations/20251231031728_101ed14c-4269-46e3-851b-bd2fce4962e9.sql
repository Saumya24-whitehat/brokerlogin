-- Add encrypted_vendor_code column to broker_sessions table
ALTER TABLE public.broker_sessions 
ADD COLUMN encrypted_vendor_code text DEFAULT NULL;

-- Add encrypted_imei column as well since it's also needed for re-login
ALTER TABLE public.broker_sessions 
ADD COLUMN encrypted_imei text DEFAULT NULL;