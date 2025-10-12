import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PLTracker from "@/components/Dashboard/PLTracker";
import PositionChart from "@/components/Dashboard/PositionChart";
import RiskMetrics from "@/components/Dashboard/RiskMetrics";
import AIInsights from "@/components/Dashboard/AIInsights";
import ExcelUpload from "@/components/Dashboard/ExcelUpload";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useWebSocket } from '@/hooks/useWebSocket';

const CustodianDashboard = () => {
  const { clientName } = useParams<{ clientName: string }>();
  const navigate = useNavigate();
  
  // This state tracks which client's data to display. It defaults to the URL param.
  const [activeClient, setActiveClient] = useState(decodeURIComponent(clientName || ""));

  // Call the WebSocket hook to get live data for ALL clients
  const { isConnected, portfolio, error } = useWebSocket();

  // Filter the full portfolio to get data for only the active client
  const clientPortfolio = portfolio.filter(p => p.ACCOUNT === activeClient);

  // This function is called by ExcelUpload after a successful upload
  const handleUploadSuccess = (ingestedAccountId: string) => {
    if (ingestedAccountId && ingestedAccountId !== activeClient) {
      console.log(`Upload successful for new account: ${ingestedAccountId}. Refreshing view.`);
      // Update the URL and the active client state to show the new data
      navigate(`/custodian/${encodeURIComponent(ingestedAccountId)}`);
      setActiveClient(ingestedAccountId);
    }
  };
  
  // Keep the activeClient state in sync with the URL
  useEffect(() => {
    setActiveClient(decodeURIComponent(clientName || ""));
  }, [clientName]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/custodian")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">RAD Custodian</h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Viewing: {activeClient}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* The ExcelUpload component is now part of the dashboard */}
        <ExcelUpload 
          clientName={activeClient}
          onUploadSuccess={handleUploadSuccess} 
        />
        
        <hr className="my-6 border-border" />

        {/* Live Dashboard Section */}
        {error && <div className="text-red-500 font-bold p-4 bg-red-500/10 rounded-lg">Error: {error}</div>}
        {!isConnected && !error && <div>Connecting to live data server...</div>}

        {isConnected && !error && (
          <>
            {clientPortfolio.length > 0 ? (
              <>
                <PLTracker data={clientPortfolio} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <PositionChart data={clientPortfolio} />
                  </div>
                  <div>
                    <RiskMetrics data={clientPortfolio} />
                  </div>
                </div>
                <AIInsights clientName={activeClient} />
              </>
            ) : (
              <div>Connected. No positions found for client: {activeClient}</div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CustodianDashboard;