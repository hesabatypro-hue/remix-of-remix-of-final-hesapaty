import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  Clipboard,
  X,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface QuickUploadProps {
  trigger?: React.ReactNode;
}

export const QuickUpload = ({ trigger }: QuickUploadProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches } = useBranches();
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedBranch("");
    setImagePreview(null);
    setImageFile(null);
    setExtractedData(null);
    setError(null);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف صورة",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setExtractedData(null);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          handleFileSelect(file);
          return;
        }
      }
      toast({
        title: "لا توجد صورة",
        description: "لم يتم العثور على صورة في الحافظة",
        variant: "destructive",
      });
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في قراءة الحافظة",
        variant: "destructive",
      });
    }
  }, []);

  const handleProcess = async () => {
    if (!selectedBranch || !imagePreview) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فرع وإضافة صورة",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Call edge function to extract data
      const { data, error: fnError } = await supabase.functions.invoke(
        "extract-transfer-amount",
        {
          body: { imageBase64: imagePreview },
        }
      );

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        return;
      }

      setExtractedData(data);

      // Create transfer record
      const { error: insertError } = await supabase.from("transfers").insert({
        branch_id: selectedBranch,
        amount: data.amount ? parseFloat(data.amount) : 0,
        transfer_date: data.date || new Date().toISOString().split("T")[0],
        sender_name: data.sender || null,
        notes: data.reference ? `Reference: ${data.reference}` : null,
        extracted_data: data,
        image_url: imagePreview,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["transfers"] });

      toast({
        title: "تم بنجاح",
        description: "تم حفظ التحويل واستخراج البيانات",
      });

      setTimeout(() => {
        setIsOpen(false);
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message || "حدث خطأ أثناء المعالجة");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            رفع سريع
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">رفع صورة تحويل</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Branch Selection */}
          <div className="space-y-2">
            <Label>الفرع</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload Area */}
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-6 text-center transition-colors
              ${isDragging 
                ? "border-primary bg-primary/10" 
                : "border-border hover:border-primary/50"
              }
              ${imagePreview ? "border-solid border-primary/30" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -left-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                    setExtractedData(null);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm text-foreground font-medium">
                    اسحب صورة الإيصال هنا أو
                  </p>
                  <div className="flex gap-2 justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("file-input")?.click()}
                    >
                      اختر ملف
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePaste}
                      className="gap-1"
                    >
                      <Clipboard className="w-3 h-3" />
                      لصق
                    </Button>
                  </div>
                </div>
                <Input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
            )}
          </div>

          {/* Extracted Data Preview */}
          {extractedData && (
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">تم استخراج البيانات</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {extractedData.amount && (
                    <div>
                      <span className="text-muted-foreground">المبلغ:</span>{" "}
                      <span className="font-medium">{extractedData.amount}</span>
                    </div>
                  )}
                  {extractedData.date && (
                    <div>
                      <span className="text-muted-foreground">التاريخ:</span>{" "}
                      <span className="font-medium">{extractedData.date}</span>
                    </div>
                  )}
                  {extractedData.sender && (
                    <div>
                      <span className="text-muted-foreground">المرسل:</span>{" "}
                      <span className="font-medium">{extractedData.sender}</span>
                    </div>
                  )}
                  {extractedData.reference && (
                    <div>
                      <span className="text-muted-foreground">المرجع:</span>{" "}
                      <span className="font-medium">{extractedData.reference}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-4 flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </CardContent>
            </Card>
          )}

          {/* Security Note */}
          <p className="text-xs text-muted-foreground/70 text-center">
            🔒 بياناتك آمنة — الصورة تُعالج داخل النظام فقط ولا تُشارك مع أي جهة خارجية
          </p>

          {/* Submit Button */}
          <Button
            onClick={handleProcess}
            className="w-full gap-2"
            disabled={!selectedBranch || !imagePreview || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                معالجة وحفظ
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
