import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface LimitBadgeProps {
  current: number;
  max: number;
  label: string;
  className?: string;
}

export function LimitBadge({ current, max, label, className }: LimitBadgeProps) {
  const percentage = (current / max) * 100;
  const isAtLimit = current >= max;
  const isNearLimit = percentage >= 80 && !isAtLimit;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
        isAtLimit 
          ? "bg-destructive/10 text-destructive" 
          : isNearLimit 
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground",
        className
      )}
    >
      {isAtLimit ? (
        <AlertTriangle className="w-4 h-4" />
      ) : (
        <CheckCircle className="w-4 h-4" />
      )}
      <span>
        {label}: {current}/{max}
      </span>
    </div>
  );
}
