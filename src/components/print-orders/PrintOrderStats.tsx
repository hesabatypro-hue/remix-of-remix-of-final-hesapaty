import { Card, CardContent } from "@/components/ui/card";
import { Printer, Clock, CheckCircle, DollarSign } from "lucide-react";
import type { PrintOrder } from "@/hooks/usePrintOrders";

interface Props {
  orders: PrintOrder[];
}

export function PrintOrderStats({ orders }: Props) {
  const total = orders.length;
  const active = orders.filter(o => ["draft", "approved", "printing"].includes(o.status)).length;
  const completed = orders.filter(o => o.status === "delivered").length;
  const totalRevenue = orders
    .filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_price), 0);

  const stats = [
    { label: "إجمالي الطلبات", value: total, icon: Printer, color: "text-primary" },
    { label: "طلبات نشطة", value: active, icon: Clock, color: "text-yellow-600" },
    { label: "طلبات مسلّمة", value: completed, icon: CheckCircle, color: "text-green-600" },
    { label: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString()} ر.س`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
