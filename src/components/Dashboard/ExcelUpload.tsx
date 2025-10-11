import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/config/api";

interface ExcelUploadProps {
  onClientChange: (client: string) => void;
  clients: Array<{ name: string; id: string }>;
}

const ExcelUpload = ({ onClientChange, clients }: ExcelUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState(clients[0]?.name || "");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0].name);
    }
  }, [clients, selectedClient]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!file || (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv"))) {
      toast.error("Invalid file type", {
        description: "Please upload an Excel or CSV file (.xlsx, .xls, or .csv)",
      });
      return;
    }

    if (!selectedClient) {
      toast.error("Please select a client first");
      return;
    }

    setIsUploading(true);
    
    try {
      // Create FormData to send file to Python backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientName', selectedClient);

      // Call Python backend API
      const response = await fetch(API_ENDPOINTS.uploadExcel, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to process file');
      }

      const data = await response.json();

      setUploadedFile(file.name);
      toast.success("Positions ingested successfully", {
        description: `Uploaded ${file.name} for ${selectedClient}.`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Upload failed", {
        description: error.message || "Failed to upload and process file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleClientChange = (value: string) => {
    setSelectedClient(value);
    onClientChange(value);
    setUploadedFile(null);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Custodian Upload</h3>
          <Select value={selectedClient} onValueChange={handleClientChange} disabled={isUploading}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.name}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && document.getElementById('file-input')?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
            "flex flex-col items-center justify-center gap-4 cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed",
            isDragging
              ? "border-primary bg-primary/5 shadow-glow-primary"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          )}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <>
              <div className="p-4 rounded-full bg-primary/20">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Processing file...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a moment
                </p>
              </div>
            </>
          ) : uploadedFile ? (
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
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedFile(null);
                }}
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
                <span>Supports .xlsx, .xls, and .csv files</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ExcelUpload;
