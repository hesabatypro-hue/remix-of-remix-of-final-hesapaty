import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { NetworkStatus } from "./NetworkStatus";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="md:mr-64 transition-all duration-300">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />
        <NetworkStatus />
        <main className="p-2 md:p-6 pb-20 md:pb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</main>
      </div>
      <BottomNav onMoreClick={() => setMobileMenuOpen(true)} />
    </div>
  );
}

export default DashboardLayout;
