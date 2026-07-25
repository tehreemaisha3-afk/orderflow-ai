import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  new: "bg-primary/10 text-primary hover:bg-primary/10",
  awaiting_information: "bg-warning/15 text-warning-foreground hover:bg-warning/15",
  confirmed: "bg-accent text-accent-foreground hover:bg-accent",
  delivered: "bg-success/15 text-success hover:bg-success/15",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
};

const statusLabels: Record<string, string> = {
  new: "New",
  awaiting_information: "Awaiting info",
  confirmed: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", statusStyles[status])}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

const paymentStyles: Record<string, string> = {
  paid: "bg-success/15 text-success hover:bg-success/15",
  unpaid: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  refunded: "bg-muted text-muted-foreground hover:bg-muted",
};

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium capitalize", paymentStyles[status])}>
      {status}
    </Badge>
  );
}
