import DashboardLayout from "@/components/layout/DashboardLayout";
import { usePrintOrders } from "@/hooks/usePrintOrders";
import { useBranches } from "@/hooks/useBranches";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { NewPrintOrderDialog } from "@/components/print-orders/NewPrintOrderDialog";
import { PrintOrdersTable } from "@/components/print-orders/PrintOrdersTable";
import { PrintOrderStats } from "@/components/print-orders/PrintOrderStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer } from "lucide-react";

export default function PrintOrders() {
  const { currentOrganization } = useAuth();
  const { orders, isLoading, addOrder, updateOrderStatus, deleteOrder } = usePrintOrders();
  const { branches } = useBranches();
  const { employees } = useEmployees();

  const orgId = currentOrganization?.id;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Printer className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold">أوامر التشغيل</h1>
          </div>
          {orgId && (
            <NewPrintOrderDialog
              orgId={orgId}
              branches={(branches || []).map(b => ({ id: b.id, name: b.name }))}
              employees={(employees || []).map(e => ({ id: e.id, full_name: e.full_name }))}
              onSubmit={(order) => addOrder.mutate(order)}
              isLoading={addOrder.isPending}
            />
          )}
        </div>

        {/* Stats */}
        <PrintOrderStats orders={orders} />

        {/* Table */}
        <PrintOrdersTable
          orders={orders}
          onStatusChange={(id, status) => updateOrderStatus.mutate({ id, status })}
          onDelete={(id) => deleteOrder.mutate(id)}
        />
      </div>
    </DashboardLayout>
  );
}
