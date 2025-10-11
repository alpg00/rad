export interface Client {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  client_id: string;
  ticker: string;
  quantity: number;
  cost_basis: number;
  price?: number;
  market_value?: number;
  pnl?: number;
}

export interface PortfolioAnalysis {
  positions: Position[];
  totals: {
    market_value: number;
    pnl: number;
  };
}

export interface ClientSummary extends Client {
  performance: number;
  value: string;
}
