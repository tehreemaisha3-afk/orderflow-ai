import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import {
  approveOrderDraft,
  rejectOrderDraft,
  requestDraftClarification,
  updateOrderDraft,
} from "@/lib/order-drafts.functions";
import type { DraftIssue, ValidatedLineItem, VerificationState } from "@/lib/ai/types";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Languages,
  Loader2,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Order approvals — OrderFlow AI" },
      {
        name: "description",
        content:
          "Review AI-extracted orders, check product, price and stock validation, then edit, approve or reject before anything is committed.",
      },
      { property: "og:title", content: "Order approvals — OrderFlow AI" },
      {
        property: "og:description",
        content: "Human approval gate for every AI-extracted WhatsApp order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});

interface DraftAnalysis {
  customer?: { name?: string | null; phone?: string | null; city?: string | null; address?: string | null };
  payment_method?: string | null;
  next_action?: string | null;
}

interface DraftRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  channel: string;
  confidence: number;
  detected_language: string | null;
  source_message: string | null;
  reviewer_note: string | null;
  extraction: {
    items?: ValidatedLineItem[];
    total?: number;
    state?: VerificationState;
    analysis?: DraftAnalysis;
  } | null;
  issues: DraftIssue[] | null;
  order_id: string | null;
  created_at: string;
  customers: { name: string; phone: string } | null;
}

interface CatalogueProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const LANGUAGE_LABEL: Record<string, string> = {
  english: "English",
  urdu: "Urdu",
  roman_urdu: "Roman Urdu",
  mixed: "Mixed",
};

const STATE_LABEL: Record<VerificationState, string> = {
  verified: "Verified",
  needs_review: "Needs review",
  needs_clarification: "Needs clarification",
};

function deriveState(draft: DraftRow): VerificationState {
  if (draft.extraction?.state) return draft.extraction.state;
  const issues = draft.issues ?? [];
  const clarify = issues.some(
    (i) =>
      i.severity === "blocking" &&
      (i.code === "unknown_product" || i.code === "no_items" || i.code === "missing_customer_field"),
  );
  if (clarify) return "needs_clarification";
  return issues.length > 0 ? "needs_review" : "verified";
}

function StateBadge({ state }: { state: VerificationState }) {
  const className =
    state === "verified"
      ? "bg-success/15 text-success hover:bg-success/15"
      : state === "needs_review"
        ? "bg-warning/15 text-warning-foreground hover:bg-warning/15"
        : "bg-destructive/10 text-destructive hover:bg-destructive/10";
  return (
    <Badge variant="secondary" className={`font-medium ${className}`}>
      {STATE_LABEL[state]}
    </Badge>
  );
}

function ApprovalsPage() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const {
    data: drafts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    enabled: !!business?.id,
    queryKey: ["order-drafts", business?.id, tab],
    queryFn: async () => {
      const query = supabase
        .from("order_drafts")
        .select("*, customers(name, phone)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const { data, error: qErr } =
        tab === "pending"
          ? await query.eq("status", "pending")
          : await query.neq("status", "pending");
      if (qErr) throw qErr;
      return (data ?? []) as unknown as DraftRow[];
    },
  });

  const { data: products = [] } = useQuery({
    enabled: !!business?.id,
    queryKey: ["catalogue-products", business?.id],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("products")
        .select("id, name, price, stock")
        .eq("business_id", business!.id)
        .eq("is_active", true)
        .order("name");
      if (qErr) throw qErr;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
      })) as CatalogueProduct[];
    },
  });

  const approveFn = useServerFn(approveOrderDraft);
  const rejectFn = useServerFn(rejectOrderDraft);
  const updateFn = useServerFn(updateOrderDraft);
  const clarifyFn = useServerFn(requestDraftClarification);

  const approve = useMutation({
    mutationFn: (draftId: string) => approveFn({ data: { draftId } }),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} created`, {
        description: "Stock has been reserved and the customer record updated.",
      });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Could not approve", { description: e.message }),
  });

  const reject = useMutation({
    mutationFn: (vars: { draftId: string; note?: string }) =>
      rejectFn({ data: { draftId: vars.draftId, note: vars.note } }),
    onSuccess: () => {
      toast.success("Draft rejected");
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
    },
    onError: (e: Error) => toast.error("Could not reject", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof updateOrderDraft>[0] extends never ? never : {
      draftId: string;
      customer: { name: string | null; phone: string | null; city: string | null; address: string | null };
      paymentMethod: string | null;
      notes: string | null;
      items: Array<{ product_id: string | null; mentioned_as: string; quantity: number; unit_price: number | null }>;
    }) => updateFn({ data: payload }),
    onSuccess: (result) => {
      toast.success("Draft updated", {
        description: `Verification state: ${STATE_LABEL[result.state]}.`,
      });
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
    },
    onError: (e: Error) => toast.error("Could not save the draft", { description: e.message }),
  });

  const clarify = useMutation({
    mutationFn: (vars: { draftId: string; message: string }) => clarifyFn({ data: vars }),
    onSuccess: () => {
      toast.success("Clarification sent to the customer");
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
    },
    onError: (e: Error) => toast.error("Could not send", { description: e.message }),
  });

  const busy = approve.isPending || reject.isPending || save.isPending || clarify.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Order approvals</h2>
          <p className="text-sm text-muted-foreground">
            The assistant never creates an order on its own. Every AI-extracted order waits here
            until you review, edit and approve it.
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading drafts…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="shadow-card">
          <CardContent className="grid place-items-center gap-3 p-10 text-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            <p className="text-sm font-medium">Could not load drafts</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {(error as Error | null)?.message ?? "Something went wrong."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : drafts.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="grid place-items-center gap-2 p-12 text-center">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">
              {tab === "pending" ? "Nothing waiting for approval" : "No reviewed drafts yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              When a customer confirms an order on WhatsApp or in the assistant console, it appears
              here with its extraction and validation checks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              products={products}
              busy={busy}
              onApprove={() => approve.mutate(d.id)}
              onReject={(note) => reject.mutate({ draftId: d.id, note })}
              onSave={(payload) => save.mutateAsync({ draftId: d.id, ...payload })}
              onClarify={(message) => clarify.mutateAsync({ draftId: d.id, message })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EditPayload {
  customer: { name: string | null; phone: string | null; city: string | null; address: string | null };
  paymentMethod: string | null;
  notes: string | null;
  items: Array<{ product_id: string | null; mentioned_as: string; quantity: number; unit_price: number | null }>;
}

function DraftCard({
  draft,
  products,
  busy,
  onApprove,
  onReject,
  onSave,
  onClarify,
}: {
  draft: DraftRow;
  products: CatalogueProduct[];
  busy: boolean;
  onApprove: () => void;
  onReject: (note?: string) => void;
  onSave: (payload: EditPayload) => Promise<unknown>;
  onClarify: (message: string) => Promise<unknown>;
}) {
  const items = draft.extraction?.items ?? [];
  const analysis = draft.extraction?.analysis ?? {};
  const issues = draft.issues ?? [];
  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");
  const total = Number(draft.extraction?.total ?? 0);
  const state = deriveState(draft);
  const language = draft.detected_language
    ? (LANGUAGE_LABEL[draft.detected_language] ?? draft.detected_language)
    : null;

  const [editOpen, setEditOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            {draft.customers?.name ?? analysis.customer?.name ?? "Unknown customer"}
            {(draft.customers?.phone ?? analysis.customer?.phone) ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {draft.customers?.phone ?? analysis.customer?.phone}
              </span>
            ) : null}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {draft.channel} · {format(new Date(draft.created_at), "MMM d, HH:mm")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {language && (
            <Badge variant="secondary" className="gap-1">
              <Languages className="h-3 w-3" /> {language}
            </Badge>
          )}
          <StateBadge state={state} />
          {draft.status !== "pending" && (
            <Badge variant={draft.status === "approved" ? "default" : "outline"}>
              {draft.status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {draft.source_message && (
          <blockquote className="rounded-md bg-muted/60 p-3 text-sm italic">
            “{draft.source_message}”
          </blockquote>
        )}

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Field label="Delivery address" value={analysis.customer?.address} />
          <Field label="City" value={analysis.customer?.city} />
          <Field label="Payment method" value={analysis.payment_method} />
          <Field label="Notes" value={analysis.next_action} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Product</th>
                <th className="pb-2">Heard as</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Stock</th>
                <th className="pb-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="py-2 font-medium">
                    {i.product_name}
                    {!i.product_id && (
                      <>
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          no match
                        </Badge>
                        <p className="mt-1 text-xs font-normal text-muted-foreground">
                          {i.suggestion
                            ? `Closest catalogue match: ${i.suggestion.name} — confirm it in Edit.`
                            : "No reliable match. Select a product in Edit."}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{i.mentioned_as}</td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(i.unit_price)}</td>
                  <td
                    className={`py-2 text-right ${
                      i.stock_available != null && i.stock_available < i.quantity
                        ? "font-medium text-destructive"
                        : ""
                    }`}
                  >
                    {i.stock_available ?? "—"}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(i.quantity * i.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Order total (catalogue prices)</span>
          <span className="text-base font-semibold">{formatCurrency(total)}</span>
        </div>

        {issues.length > 0 && (
          <>
            <Separator />
            <ul className="space-y-1.5 text-sm">
              {blocking.map((i, idx) => (
                <li key={`b${idx}`} className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{i.message}</span>
                </li>
              ))}
              {warnings.map((i, idx) => (
                <li key={`w${idx}`} className="flex items-start gap-2 text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {draft.reviewer_note && (
          <p className="text-xs text-muted-foreground">
            Last note sent: “{draft.reviewer_note}”
          </p>
        )}

        {draft.status === "pending" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onApprove} disabled={busy || blocking.length > 0} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Approve &amp; create order
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditOpen(true)}
              disabled={busy}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setClarifyOpen(true)}
              disabled={busy}
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" /> Request clarification
            </Button>
            <Button variant="ghost" onClick={() => onReject()} disabled={busy} className="gap-2">
              <X className="h-4 w-4" /> Reject
            </Button>
            {blocking.length > 0 && (
              <p className="w-full text-xs text-muted-foreground">
                Resolve the blocking issues above — edit the draft to pick the right product, fix
                the quantity or add the customer's phone number, or restock the item.
              </p>
            )}
          </div>
        ) : draft.order_id ? (
          <Link
            to="/orders/$orderId"
            params={{ orderId: draft.order_id }}
            className="text-sm text-primary hover:underline"
          >
            View created order →
          </Link>
        ) : null}
      </CardContent>

      <EditDraftDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        draft={draft}
        products={products}
        onSave={onSave}
      />
      <ClarifyDialog open={clarifyOpen} onOpenChange={setClarifyOpen} onSend={onClarify} />
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={value ? "text-sm" : "text-sm italic text-muted-foreground"}>
        {value || "Needs clarification"}
      </p>
    </div>
  );
}

const NO_PRODUCT = "__none__";

function EditDraftDialog({
  open,
  onOpenChange,
  draft,
  products,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: DraftRow;
  products: CatalogueProduct[];
  onSave: (payload: EditPayload) => Promise<unknown>;
}) {
  const analysis = draft.extraction?.analysis ?? {};
  const initialItems = useMemo(
    () =>
      (draft.extraction?.items ?? []).map((i) => ({
        product_id: i.product_id ?? i.suggestion?.product_id ?? null,
        mentioned_as: i.mentioned_as,
        quantity: i.quantity,
        unit_price: i.unit_price ?? null,
      })),
    [draft],
  );

  const [name, setName] = useState(analysis.customer?.name ?? draft.customers?.name ?? "");
  const [phone, setPhone] = useState(analysis.customer?.phone ?? draft.customers?.phone ?? "");
  const [city, setCity] = useState(analysis.customer?.city ?? "");
  const [address, setAddress] = useState(analysis.customer?.address ?? "");
  const [payment, setPayment] = useState(analysis.payment_method ?? "");
  const [notes, setNotes] = useState(analysis.next_action ?? "");
  const [rows, setRows] = useState(initialItems);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        customer: {
          name: name.trim() || null,
          phone: phone.trim() || null,
          city: city.trim() || null,
          address: address.trim() || null,
        },
        paymentMethod: payment.trim() || null,
        notes: notes.trim() || null,
        items: rows.filter((r) => r.product_id || r.mentioned_as.trim()),
      });
      onOpenChange(false);
    } catch {
      // error toast handled by the mutation
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit draft</DialogTitle>
          <DialogDescription>
            Correct anything the assistant got wrong. Saving re-runs catalogue, price and stock
            validation — nothing is committed until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`n-${draft.id}`}>Customer name</Label>
            <Input id={`n-${draft.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-${draft.id}`}>Phone</Label>
            <Input id={`p-${draft.id}`} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`c-${draft.id}`}>City</Label>
            <Input id={`c-${draft.id}`} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pm-${draft.id}`}>Payment method</Label>
            <Input
              id={`pm-${draft.id}`}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder="Cash on delivery, bank transfer…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`a-${draft.id}`}>Delivery address</Label>
            <Textarea
              id={`a-${draft.id}`}
              value={address}
              rows={2}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`no-${draft.id}`}>Notes</Label>
            <Textarea
              id={`no-${draft.id}`}
              value={notes}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Items</p>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No items on this draft. Add one below to continue.
            </p>
          )}
          {rows.map((row, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_90px_120px_40px]">
              <Select
                value={row.product_id ?? NO_PRODUCT}
                onValueChange={(v) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === idx
                        ? {
                            ...r,
                            product_id: v === NO_PRODUCT ? null : v,
                            unit_price:
                              v === NO_PRODUCT
                                ? r.unit_price
                                : (products.find((p) => p.id === v)?.price ?? r.unit_price),
                          }
                        : r,
                    ),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRODUCT}>Not selected ({row.mentioned_as})</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatCurrency(p.price)} · {p.stock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === idx ? { ...r, quantity: Math.max(1, Number(e.target.value) || 1) } : r,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.unit_price ?? ""}
                placeholder="Unit price"
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === idx
                        ? { ...r, unit_price: e.target.value === "" ? null : Number(e.target.value) }
                        : r,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                aria-label="Remove item"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { product_id: null, mentioned_as: "New item", quantity: 1, unit_price: null },
              ])
            }
          >
            Add item
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save &amp; re-validate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClarifyDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (message: string) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
      onOpenChange(false);
    } catch {
      // error toast handled by the mutation
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request clarification</DialogTitle>
          <DialogDescription>
            Send the customer a question on WhatsApp. The draft stays pending until you approve or
            reject it.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          rows={4}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Could you confirm your delivery address and preferred payment method?"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={sending || !message.trim()} className="gap-2">
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
