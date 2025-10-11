-- Seed 3 demo clients with sample position data for MVP showcase
INSERT INTO public.clients (name, email) VALUES
  ('Quantum Capital Fund', 'contact@quantumcapital.com'),
  ('Apex Growth Partners', 'info@apexgrowth.com'),
  ('Horizon Ventures', 'team@horizonventures.com')
ON CONFLICT DO NOTHING;

-- Insert sample positions for Quantum Capital Fund
INSERT INTO public.positions (client_id, ticker, quantity, cost_basis)
SELECT 
  c.id,
  ticker,
  quantity,
  cost_basis
FROM public.clients c
CROSS JOIN (
  VALUES 
    ('AAPL', 500, 150.00),
    ('MSFT', 300, 280.00),
    ('GOOGL', 200, 120.00),
    ('AMZN', 150, 140.00),
    ('TSLA', 250, 200.00)
) AS positions(ticker, quantity, cost_basis)
WHERE c.name = 'Quantum Capital Fund'
ON CONFLICT DO NOTHING;

-- Insert sample positions for Apex Growth Partners
INSERT INTO public.positions (client_id, ticker, quantity, cost_basis)
SELECT 
  c.id,
  ticker,
  quantity,
  cost_basis
FROM public.clients c
CROSS JOIN (
  VALUES 
    ('NVDA', 400, 220.00),
    ('META', 350, 180.00),
    ('NFLX', 200, 380.00),
    ('AMD', 600, 85.00),
    ('INTC', 800, 45.00)
) AS positions(ticker, quantity, cost_basis)
WHERE c.name = 'Apex Growth Partners'
ON CONFLICT DO NOTHING;

-- Insert sample positions for Horizon Ventures
INSERT INTO public.positions (client_id, ticker, quantity, cost_basis)
SELECT 
  c.id,
  ticker,
  quantity,
  cost_basis
FROM public.clients c
CROSS JOIN (
  VALUES 
    ('JPM', 450, 135.00),
    ('BAC', 700, 28.00),
    ('WFC', 600, 42.00),
    ('GS', 180, 320.00),
    ('MS', 400, 78.00)
) AS positions(ticker, quantity, cost_basis)
WHERE c.name = 'Horizon Ventures'
ON CONFLICT DO NOTHING;