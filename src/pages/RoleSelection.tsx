import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, User } from "lucide-react";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            RAD
          </h1>
          <p className="text-xl text-muted-foreground">Real-time Asset Dashboard</p>
          <p className="text-sm text-muted-foreground">Select your role to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-8 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => navigate("/portfolio-manager")}>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Portfolio Manager</h2>
                <p className="text-muted-foreground">
                  View and analyze all custodian portfolios in one dashboard
                </p>
              </div>
              <Button className="w-full" size="lg">
                Access Dashboard
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => navigate("/custodian")}>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Custodian</h2>
                <p className="text-muted-foreground">
                  Upload and manage your portfolio data
                </p>
              </div>
              <Button className="w-full" size="lg">
                Select Custodian
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
