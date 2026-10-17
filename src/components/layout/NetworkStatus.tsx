import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={cn(
        "sticky top-16 z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300",
        isOnline
          ? "bg-green-600 text-white"
          : "bg-destructive text-destructive-foreground"
      )}
    >
      {isOnline ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>تم استعادة الاتصال</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>لا يوجد اتصال بالإنترنت — سيتم إعادة المحاولة تلقائياً عند عودة الاتصال</span>
        </>
      )}
    </div>
  );
}
