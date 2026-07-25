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
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";


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
    cancelled: orders.filter((o) => o.status === "cancelled").length,

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
            <CardTitle className="text-base">Order status summary</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusSummary counts={counts} cancelled={counts.cancelled} total={counts.total} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrderStatusSummary({
  counts,
  cancelled,
  total,
}: {
  counts: { new: number; awaiting: number; confirmed: number; delivered: number };
  cancelled: number;
  total: number;
}) {
  const items = [
    { label: "New", value: counts.new, color: "var(--primary)" },
    { label: "Awaiting info", value: counts.awaiting, color: "var(--warning)" },
    { label: "Confirmed", value: counts.confirmed, color: "var(--accent-foreground)" },
    { label: "Delivered", value: counts.delivered, color: "var(--success)" },
    { label: "Cancelled", value: cancelled, color: "var(--muted-foreground)" },
  ];


  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No orders yet — create your first order from the Orders page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items.filter((i) => i.value > 0)}
              dataKey="value"
              nameKey="label"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {items
                .filter((i) => i.value > 0)
                .map((i) => (
                  <Cell key={i.label} fill={i.color} stroke="transparent" />
                ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}

            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
              {i.label}
            </span>
            <span className="font-medium">
              {i.value} · {Math.round((i.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

