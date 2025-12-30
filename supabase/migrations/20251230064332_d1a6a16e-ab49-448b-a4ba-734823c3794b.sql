-- Create table to store broker sessions
CREATE TABLE public.broker_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  broker_name TEXT NOT NULL DEFAULT 'semco',
  session_token TEXT NOT NULL,
  account_id TEXT,
  account_name TEXT,
  server_time TEXT,
  exchange_list TEXT[],
  order_type_list TEXT[],
  product_list TEXT[],
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broker_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public insert and select for now (no auth required)
CREATE POLICY "Anyone can insert broker sessions" 
ON public.broker_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view broker sessions by user_name" 
ON public.broker_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can update their broker sessions" 
ON public.broker_sessions 
FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_broker_sessions_user_name ON public.broker_sessions(user_name);
CREATE INDEX idx_broker_sessions_broker_name ON public.broker_sessions(broker_name);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_broker_sessions_updated_at
BEFORE UPDATE ON public.broker_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();