import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingBag,
  Sparkles,
  PackageCheck,
  Truck,
  CircleDollarSign,
  Clock,
} from "lucide-react";
import { StatusBadge, PaymentBadge } from "@/components/status-badges";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — OrderFlow AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { data: business, isLoading } = useBusiness();

  useEffect(() => {
    if (!isLoading && !business) navigate({ to: "/business-setup" });
  }, [business, isLoading, navigate]);

  const { data: orders = [] } = useQuery({
    enabled: !!business?.id,
    queryKey: ["orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(name, phone)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = {
    total: orders.length,
    new: orders.filter((o) => o.status === "new").length,
    awaiting: orders.filter((o) => o.status === "awaiting_information").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    unpaid: orders.filter((o) => o.payment_status === "unpaid").length,
  };

  const stats = [
    { label: "Total Orders", value: counts.total, icon: ShoppingBag },
    { label: "New Orders", value: counts.new, icon: Sparkles },
    { label: "Awaiting Info", value: counts.awaiting, icon: Clock },
    { label: "Confirmed", value: counts.confirmed, icon: PackageCheck },
    { label: "Delivered", value: counts.delivered, icon: Truck },
    { label: "Unpaid", value: counts.unpaid, icon: CircleDollarSign },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome{business?.owner_name ? `, ${business.owner_name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's what's happening in your workspace today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Link to="/orders" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 6).map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/orders/$orderId" params={{ orderId: o.id }} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>{o.customers?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={o.payment_status} />
                    </TableCell>
                    <TableCell className="text-right">${Number(o.total).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No orders yet. When your WhatsApp orders come in, they'll appear here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Order status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChartPlaceholder counts={counts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusChartPlaceholder({
  counts,
}: {
  counts: { new: number; awaiting: number; confirmed: number; delivered: number };
}) {
  const items = [
    { label: "New", value: counts.new, color: "bg-primary" },
    { label: "Awaiting", value: counts.awaiting, color: "bg-warning" },
    { label: "Confirmed", value: counts.confirmed, color: "bg-accent-foreground" },
    { label: "Delivered", value: counts.delivered, color: "bg-success" },
  ];
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-4">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{i.label}</span>
            <span className="font-medium">{i.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${i.color}`}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-2 text-xs text-muted-foreground">
        Live chart coming soon.
      </p>
    </div>
  );
}
