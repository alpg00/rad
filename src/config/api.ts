// Backend API Configuration

// **FIXED**: The port is now 8002 to match your Python backend server.
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8002';

export const API_ENDPOINTS = {
  // Excel upload and ingestion
  uploadExcel: `${API_BASE_URL}/api/ingest-positions`,
  
  // Portfolio analysis
  analyzePortfolio: `${API_BASE_URL}/api/analyze-portfolio`,
  
  // AI insights
  getAIInsights: `${API_BASE_URL}/api/portfolio-insights`,
  
  // Client management
  getClients: `${API_BASE_URL}/api/clients`,
  createClient: `${API_BASE_URL}/api/clients`,
  
  // Positions
  getPositions: `${API_BASE_URL}/api/positions`,
  
  // Market data
  getMarketData: `${API_BASE_URL}/api/market-data`,
};

// Helper function for API calls with error handling
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown API error' }));
    throw new Error(error.detail || `API call failed: ${response.statusText}`);
  }

  return response.json();
}