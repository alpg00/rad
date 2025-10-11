-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create positions table
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  cost_basis NUMERIC NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_data table for caching
CREATE TABLE public.market_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  current_price NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for positions
CREATE POLICY "Authenticated users can view positions"
ON public.positions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert positions"
ON public.positions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update positions"
ON public.positions FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete positions"
ON public.positions FOR DELETE
TO authenticated
USING (true);

-- RLS Policies for alerts
CREATE POLICY "Authenticated users can view alerts"
ON public.alerts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert alerts"
ON public.alerts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
ON public.alerts FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for market_data
CREATE POLICY "Authenticated users can view market data"
ON public.market_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert market data"
ON public.market_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update market data"
ON public.market_data FOR UPDATE
TO authenticated
USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for positions and market_data
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- Create storage bucket for Excel uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-uploads', 'portfolio-uploads', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio-uploads');

CREATE POLICY "Authenticated users can view their uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'portfolio-uploads');