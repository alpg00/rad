import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/config/api";

// --- FIX 1: Update the props to match what the parent component provides ---
interface ExcelUploadProps {
  clientName: string;
  onUploadSuccess: (ingestedAccountId: string) => void;
}

const ExcelUpload = ({ clientName, onUploadSuccess }: ExcelUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- [REMOVED] --- Obsolete state and useEffect for managing client selection are gone.

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!file || (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv"))) {
      toast.error("Invalid file type", { description: "Please upload an Excel or CSV file." });
      return;
    }

    // Use the clientName from props
    if (!clientName) {
      toast.error("Please select a client first.");
      return;
    }

    setIsUploading(true);
    setUploadedFile(null); // Reset on new upload
    
    try {
      const formData = new FormData();
      formData.append('file', file);
<<<<<<< HEAD
      // Backend expects clientName as a form field, not query param
      formData.append('clientName', selectedClient);

      // Call Python backend API
      const response = await fetch(API_ENDPOINTS.uploadExcel, {
=======
      
      const url = `${API_ENDPOINTS.uploadExcel}?clientName=${encodeURIComponent(clientName)}`;

      const response = await fetch(url, {
>>>>>>> arth3
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to process file on server.' }));
        throw new Error(errorData.detail || 'Failed to process file');
      }

      const result = await response.json();

      setUploadedFile(file.name);
      toast.success("Positions synchronized successfully!");

      // --- FIX 2: Call the onUploadSuccess function from the parent ---
      // This tells the parent component to switch its view to the new account ID.
      if (result.ingestedAccountId) {
        onUploadSuccess(result.ingestedAccountId);
      }
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Upload failed", { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="space-y-4">
        {/* --- FIX 3: Simplified header --- */}
        <h3 className="text-lg font-semibold">Upload SOD Report for: {clientName}</h3>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && document.getElementById('file-input')?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
            "flex flex-col items-center justify-center gap-4 cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
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
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Processing file...</p>
            </>
          ) : uploadedFile ? (
            <>
              <Check className="h-8 w-8 text-green-500" />
              <div className="text-center">
                <p className="text-sm font-medium">{uploadedFile}</p>
                <p className="text-xs text-muted-foreground mt-1">Positions synchronized successfully</p>
              </div>
              <Button
                onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                variant="outline"
                size="sm"
              >
                Upload New File
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Drag & drop Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
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