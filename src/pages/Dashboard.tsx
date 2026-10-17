import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardSkeleton } from "@/components/ui/page-skeleton";
import { useActiveModule } from "@/modules/ActiveModuleProvider";
import { ModuleErrorBoundary } from "@/modules/ModuleErrorBoundary";

/**
 * Context-aware Dashboard shell — renders the active module's dashboard.
 * The shell stays neutral; every module ships its own dashboard component.
 */
export default function Dashboard() {
  const { activeModule } = useActiveModule();
  const Body = activeModule.Dashboard;
  return (
    <DashboardLayout>
      <ModuleErrorBoundary moduleLabel={activeModule.label}>
        <Suspense fallback={<DashboardSkeleton />}>
          <Body />
        </Suspense>
      </ModuleErrorBoundary>
    </DashboardLayout>
  );
}
