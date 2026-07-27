import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PaymentBadge } from "@/components/status-badges";
import {
  ArrowLeft,
  Save,
  Trash2,
  Pencil,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order — OrderFlow AI" }] }),
  component: OrderDetails,
});

function OrderDetails() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(*), order_items(*)")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    enabled: !!order,
    queryKey: ["order-msgs", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (order) setForm(order);
  }, [order]);

  if (isLoading || !order || !form) {
    return <div className="text-sm text-muted-foreground">Loading order…</div>;
  }

  async function save() {
    const { error } = await supabase
      .from("orders")
      .update({
        status: form.status,
        payment_status: form.payment_status,
        payment_method: form.payment_method,
        delivery_address: form.delivery_address,
        customer_notes: form.customer_notes,
        missing_information: form.missing_information,
        total: Number(form.total ?? 0),
      })
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success("Order updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["order", orderId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function remove() {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success("Order deleted");
    navigate({ to: "/orders" });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All orders
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="truncate text-2xl font-semibold">Order {order.order_number}</h2>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setForm(order); }}>Cancel</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="ghost" onClick={remove} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Customer information</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Row label="Name" value={order.customers?.name} />
              <Row label="Phone" value={order.customers?.phone} />
              <Row label="City" value={order.customers?.city} />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Order items</CardTitle></CardHeader>
            <CardContent>
              {order.order_items?.length ? (
                <div className="divide-y divide-border">
                  {order.order_items.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <div className="font-medium">{i.product_name}</div>
                        <div className="text-xs text-muted-foreground">Qty {i.quantity} × {formatCurrency(i.unit_price)}</div>
                      </div>
                      <div className="font-medium">{formatCurrency(i.quantity * Number(i.unit_price))}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No items on this order.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-base">Delivery address</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <Textarea rows={3} value={form.delivery_address ?? ""} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
                ) : (
                  <p className="text-sm text-muted-foreground">{order.delivery_address ?? "—"}</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-base">Payment method</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <Input value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} />
                ) : (
                  <p className="text-sm text-muted-foreground">{order.payment_method ?? "—"}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Customer notes</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea rows={3} value={form.customer_notes ?? ""} onChange={(e) => setForm({ ...form, customer_notes: e.target.value })} />
              ) : (
                <p className="text-sm text-muted-foreground">{order.customer_notes ?? "—"}</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Missing information</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea rows={2} value={form.missing_information ?? ""} onChange={(e) => setForm({ ...form, missing_information: e.target.value })} />
              ) : (
                <p className="text-sm text-muted-foreground">{order.missing_information ?? "Nothing missing."}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {editing && (
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-base">Order status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="awaiting_information">Awaiting info</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input type="number" step="0.01" value={form.total ?? 0} onChange={(e) => setForm({ ...form, total: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" /> Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length ? (
                <div className="space-y-3 text-sm">
                  {messages.map((m: any) => (
                    <div key={m.id} className={m.direction === "inbound" ? "flex" : "flex justify-end"}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${m.direction === "inbound" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                        <div>{m.body}</div>
                        <div className={`mt-1 text-[10px] ${m.direction === "inbound" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                          {format(new Date(m.created_at), "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No conversation yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> AI follow-up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI-suggested follow-ups will appear here once AI is enabled.
              </p>
              <Button variant="outline" size="sm" className="mt-3" disabled>
                Generate follow-up (coming soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}
