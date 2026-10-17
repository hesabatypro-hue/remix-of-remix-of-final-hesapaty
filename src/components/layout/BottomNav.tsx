import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useActiveModule } from "@/modules/ActiveModuleProvider";

interface BottomNavProps {
  onMoreClick?: () => void;
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();
  const { activeModule } = useActiveModule();

  // Take first 4 items flagged for bottom nav (fallback: first 4 nav items)
  const items = (activeModule.navItems.filter((i) => i.bottom).length
    ? activeModule.navItems.filter((i) => i.bottom)
    : activeModule.navItems
  ).slice(0, 4);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground active:scale-95",
              )}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-primary animate-in fade-in slide-in-from-top-1 duration-200" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "stroke-[2.5] scale-110")} />
              <span className={cn("text-[10px] font-medium transition-all duration-200", isActive && "font-bold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground active:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">المزيد</span>
        </button>
      </div>
    </nav>
  );
}
