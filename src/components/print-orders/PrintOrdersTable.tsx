import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PrintOrderStatusBadge } from "./PrintOrderStatusBadge";
import { MoreHorizontal, Trash2, ArrowRightLeft } from "lucide-react";
import type { PrintOrder } from "@/hooks/usePrintOrders";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const statusFlow: Record<string, string[]> = {
  draft: ["approved", "cancelled"],
  approved: ["printing", "cancelled"],
  printing: ["printed", "cancelled"],
  printed: ["delivered"],
  delivered: [],
  cancelled: [],
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  approved: "معتمد",
  printing: "قيد الطباعة",
  printed: "مطبوع",
  delivered: "مسلّم",
  cancelled: "ملغي",
};

interface Props {
  orders: PrintOrder[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

export function PrintOrdersTable({ orders, onStatusChange, onDelete }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        لا توجد أوامر تشغيل بعد. أنشئ أول أمر تشغيل!
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الزبون</TableHead>
              <TableHead>الخام</TableHead>
              <TableHead>المساحة</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const nextStatuses = statusFlow[order.status] || [];
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.customer_name}</TableCell>
                  <TableCell>{order.material_type}</TableCell>
                  <TableCell>{Number(order.total_area).toFixed(2)} م²</TableCell>
                  <TableCell className="font-semibold">{Number(order.total_price).toFixed(2)} ر.س</TableCell>
                  <TableCell><PrintOrderStatusBadge status={order.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(order.created_at), "d MMM yyyy", { locale: ar })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {nextStatuses.map((s) => (
                          <DropdownMenuItem key={s} onClick={() => onStatusChange(order.id, s)}>
                            <ArrowRightLeft className="h-4 w-4 ml-2" />
                            تغيير إلى: {statusLabels[s]}
                          </DropdownMenuItem>
                        ))}
                        {nextStatuses.length > 0 && order.status !== "cancelled" && (
                          <div className="border-t my-1" />
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(order.id)}>
                          <Trash2 className="h-4 w-4 ml-2" />حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف أمر التشغيل هذا؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { onDelete(deleteTarget); setDeleteTarget(null); } }}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
