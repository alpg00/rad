import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ExcelUploadProps {
  onClientChange: (client: string) => void;
}

const clients = [
  "Quantum Capital Fund",
  "Apex Growth Partners",
  "Horizon Ventures",
  "Sterling Asset Management",
  "Pinnacle Investment Group",
];

const ExcelUpload = ({ onClientChange }: ExcelUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState(clients[0]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setUploadedFile(file.name);
      toast.success("Positions updated successfully", {
        description: `Uploaded ${file.name} for ${selectedClient}`,
      });
    } else {
      toast.error("Invalid file type", {
        description: "Please upload an Excel file (.xlsx or .xls)",
      });
    }
  };

  const handleClientChange = (value: string) => {
    setSelectedClient(value);
    onClientChange(value);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Custodian Upload</h3>
          <Select value={selectedClient} onValueChange={handleClientChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
            "flex flex-col items-center justify-center gap-4 cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5 shadow-glow-primary"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          )}
        >
          {uploadedFile ? (
            <>
              <div className="p-4 rounded-full bg-success/20">
                <Check className="h-8 w-8 text-success" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {uploadedFile}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Positions synchronized successfully
                </p>
              </div>
              <Button
                onClick={() => setUploadedFile(null)}
                variant="outline"
                size="sm"
              >
                Upload New File
              </Button>
            </>
          ) : (
            <>
              <div className="p-4 rounded-full bg-primary/20">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drag & drop Excel file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Supports .xlsx and .xls files</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ExcelUpload;
