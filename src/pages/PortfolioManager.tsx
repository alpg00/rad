import { useState } from "react";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import PLTracker from "@/components/Dashboard/PLTracker";
import PositionChart from "@/components/Dashboard/PositionChart";
import RiskMetrics from "@/components/Dashboard/RiskMetrics";
import AIInsights from "@/components/Dashboard/AIInsights";
import { Button } from "@/components/ui/button";
import { Menu, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ClientSummary } from "@/types/portfolio";
// Import the WebSocket hook
import { useWebSocket } from '@/hooks/useWebSocket'; // Make sure this path is correct

const PortfolioManager = () => {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState("Quantum Capital Fund");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // **1. Add state to hold the list of clients**
  const [clients, setClients] = useState<ClientSummary[]>([]);

  // Call the WebSocket hook to get live data and connection status
  const { isConnected, portfolio, error } = useWebSocket();

  // Filter the full portfolio to get data for only the selected client
  const clientPortfolio = portfolio.filter(
    (p) => p.ACCOUNT === selectedClient
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header (No changes needed here) */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              RAD
            </h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Portfolio Manager Dashboard
            </span>
          </div>
          <div className="text-sm text-muted-foreground">{selectedClient}</div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          isOpen={sidebarOpen}
          // **2. Pass the required 'onClientsLoaded' prop to the sidebar**
          // This fixes the crash.
          onClientsLoaded={setClients}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Handle errors from the WebSocket connection */}
          {error && <div className="text-red-500 font-bold">Error: {error}</div>}

          {/* Display a loading state while connecting and waiting for data */}
          {!isConnected && !error && <div>Connecting to server and fetching portfolio...</div>}
          
          {/* Once connected, render the main dashboard */}
          {isConnected && !error && (
            <>
              {clientPortfolio.length > 0 ? (
                <>
                  {/* Pass the live, filtered 'clientPortfolio' data to the children */}
                  <PLTracker data={clientPortfolio} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <PositionChart data={clientPortfolio} />
                    </div>
                    <div>
                      <RiskMetrics data={clientPortfolio} />
                    </div>
                  </div>
                  <AIInsights clientName={selectedClient} />
                </>
              ) : (
                // This message shows after connecting if the selected client has no data
                <div>Connected. No positions found for client: {selectedClient}</div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default PortfolioManager;