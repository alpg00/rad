import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PLTracker from "@/components/Dashboard/PLTracker";
import PositionChart from "@/components/Dashboard/PositionChart";
import RiskMetrics from "@/components/Dashboard/RiskMetrics";
import AIInsights from "@/components/Dashboard/AIInsights";
import ExcelUpload from "@/components/Dashboard/ExcelUpload";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ClientSummary } from "@/types/portfolio";

const CustodianDashboard = () => {
  const { clientName } = useParams<{ clientName: string }>();
  const navigate = useNavigate();
  const decodedClientName = decodeURIComponent(clientName || "");
  const { portfolio } = useWebSocket();
  const [clients] = useState<ClientSummary[]>([
    { id: "1", name: decodedClientName, performance: 0, value: "$0", email: "", created_at: "", updated_at: "" }
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/custodian")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              RAD
            </h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {decodedClientName}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* P&L Tracker */}
        <PLTracker data={portfolio} />

        {/* Chart and Risk Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PositionChart data={portfolio} />
          </div>
          <div>
            <RiskMetrics data={portfolio} />
          </div>
        </div>

        {/* AI Insights */}
        <AIInsights clientName={decodedClientName} />

        {/* Excel Upload */}
        <ExcelUpload 
          onClientChange={() => {}} 
          clients={clients}
        />
      </main>
    </div>
  );
};

export default CustodianDashboard;
