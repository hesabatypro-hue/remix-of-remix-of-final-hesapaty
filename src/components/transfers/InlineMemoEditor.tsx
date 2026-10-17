import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineMemoEditorProps {
  value: string | null;           // البيان المعدل
  originalValue?: string | null;  // النص الأصلي المستخرج (OCR)
  onSave: (value: string) => void;
  isPending?: boolean;
  isError?: boolean;
  placeholder?: string;
}

export function InlineMemoEditor({ 
  value, 
  originalValue, 
  onSave, 
  isPending,
  isError,
  placeholder = "⏳ بانتظار البيان..." 
}: InlineMemoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // SAVE FEEDBACK: detect transition from pending → not pending (save completed)
  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
    } else if (wasPending.current && !isError) {
      wasPending.current = false;
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 1800);
      return () => clearTimeout(timer);
    } else if (wasPending.current && isError) {
      wasPending.current = false;
    }
  }, [isPending, isError]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed !== (value || "")) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-[250px] animate-in fade-in duration-200" dir="rtl">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="flex-1 px-2 py-1.5 text-sm border-2 border-primary rounded-md bg-background text-foreground outline-none shadow-sm focus:ring-2 focus:ring-primary/20"
            dir="rtl"
            disabled={isPending}
            placeholder="اكتب تفاصيل الطلب..."
          />
          <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="حفظ">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={handleCancel} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="إلغاء">
            <X className="w-4 h-4" />
          </button>
        </div>
        {originalValue && (
          <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground bg-muted/40 py-1 rounded">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">الأصل: {originalValue}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex flex-col gap-0.5 cursor-pointer rounded-md px-2 py-1.5 -mx-2 transition-all hover:bg-accent/50 min-w-[180px]",
        !value && "bg-amber-50/50 border border-dashed border-amber-200 text-amber-600 italic",
        justSaved && "bg-emerald-50 border border-emerald-200",
        isError && "bg-red-50 border border-red-200"
      )}
      onClick={() => {
        setEditValue(value || "");
        setIsEditing(true);
      }}
      title="اضغط لتعديل البيان"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium leading-snug">
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isPending && (
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" title="جاري الحفظ..." />
          )}
          {justSaved && !isPending && (
            <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in duration-200" />
          )}
          {isError && !isPending && (
            <span title="فشل الحفظ — اضغط للمحاولة مجدداً">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            </span>
          )}
          {!isPending && !justSaved && !isError && (
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity text-primary" />
          )}
        </div>
      </div>
      
      {originalValue && originalValue !== value && (
        <span className="text-[10px] text-muted-foreground/60 truncate max-w-[200px] block border-t border-muted-foreground/10 mt-1 pt-0.5">
          {originalValue}
        </span>
      )}
    </div>
  );
}
