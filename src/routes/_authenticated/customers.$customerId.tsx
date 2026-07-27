import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge, PaymentBadge } from "@/components/status-badges";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({ meta: [{ title: "Customer — OrderFlow AI" }] }),
  component: CustomerDetails,
});

function CustomerDetails() {
  const { customerId } = Route.useParams();
  const { data: customer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!customer) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </Link>
        <h2 className="mt-1 text-2xl font-semibold">{customer.name}</h2>
        <p className="text-sm text-muted-foreground">{customer.phone} · {customer.city ?? "No city"}</p>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Order history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link to="/orders/$orderId" params={{ orderId: o.id }} className="hover:underline">
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell><PaymentBadge status={o.payment_status} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(o.total)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(o.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No orders yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
