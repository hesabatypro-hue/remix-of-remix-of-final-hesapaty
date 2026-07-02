import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  approved: { label: "معتمد", variant: "outline" },
  printing: { label: "قيد الطباعة", variant: "default" },
  printed: { label: "مطبوع", variant: "default" },
  delivered: { label: "مسلّم", variant: "default" },
  cancelled: { label: "ملغي", variant: "destructive" },
};

interface Props {
  status: string;
}

export function PrintOrderStatusBadge({ status }: Props) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
