import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { approveOrderDraft, rejectOrderDraft } from "@/lib/order-drafts.functions";
import type { DraftIssue, ValidatedLineItem } from "@/lib/ai/types";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Languages, ShieldCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Order approvals — OrderFlow AI" },
      {
        name: "description",
        content:
          "Review AI-extracted orders, check product, price and stock validation, then approve or reject before anything is committed.",
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

interface DraftRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  channel: string;
  confidence: number;
  detected_language: string | null;
  source_message: string | null;
  extraction: { items?: ValidatedLineItem[]; total?: number; analysis?: Record<string, unknown> } | null;
  issues: DraftIssue[] | null;
  order_id: string | null;
  created_at: string;
  customers: { name: string; phone: string } | null;
}

const LANGUAGE_LABEL: Record<string, string> = {
  english: "English",
  urdu: "Urdu",
  roman_urdu: "Roman Urdu",
  mixed: "Mixed",
};

function ApprovalsPage() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const { data: drafts = [], isLoading } = useQuery({
    enabled: !!business?.id,
    queryKey: ["order-drafts", business?.id, tab],
    queryFn: async () => {
      const query = supabase
        .from("order_drafts")
        .select("*, customers(name, phone)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const { data, error } =
        tab === "pending"
          ? await query.eq("status", "pending")
          : await query.neq("status", "pending");
      if (error) throw error;
      return (data ?? []) as unknown as DraftRow[];
    },
  });

  const approveFn = useServerFn(approveOrderDraft);
  const rejectFn = useServerFn(rejectOrderDraft);

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
    mutationFn: (draftId: string) => rejectFn({ data: { draftId } }),
    onSuccess: () => {
      toast.success("Draft rejected");
      qc.invalidateQueries({ queryKey: ["order-drafts"] });
    },
    onError: (e: Error) => toast.error("Could not reject", { description: e.message }),
  });

  const busy = approve.isPending || reject.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Order approvals</h2>
          <p className="text-sm text-muted-foreground">
            The assistant never creates an order on its own. Every AI-extracted order waits here
            until you approve it.
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
        <p className="text-sm text-muted-foreground">Loading…</p>
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
              busy={busy}
              onApprove={() => approve.mutate(d.id)}
              onReject={() => reject.mutate(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  busy,
  onApprove,
  onReject,
}: {
  draft: DraftRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const items = draft.extraction?.items ?? [];
  const issues = draft.issues ?? [];
  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");
  const total = Number(draft.extraction?.total ?? 0);
  const confidence = Math.round(Number(draft.confidence) * 100);
  const language = draft.detected_language
    ? (LANGUAGE_LABEL[draft.detected_language] ?? draft.detected_language)
    : null;

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            {draft.customers?.name ?? "Unknown customer"}
            {draft.customers?.phone ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {draft.customers.phone}
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
          <Badge
            variant={confidence >= 70 ? "default" : "secondary"}
            className={confidence < 45 ? "bg-destructive text-destructive-foreground" : undefined}
          >
            {confidence}% confidence
          </Badge>
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
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        no match
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{i.mentioned_as}</td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(i.unit_price)}</td>
                  <td className="py-2 text-right">
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

        {draft.status === "pending" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onApprove} disabled={busy || blocking.length > 0} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Approve &amp; create order
            </Button>
            <Button variant="outline" onClick={onReject} disabled={busy} className="gap-2">
              <X className="h-4 w-4" /> Reject
            </Button>
            {blocking.length > 0 && (
              <p className="w-full text-xs text-muted-foreground">
                Resolve the blocking issues above (add the product, or restock it) and the
                assistant will re-validate on the next customer message.
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
    </Card>
  );
}
