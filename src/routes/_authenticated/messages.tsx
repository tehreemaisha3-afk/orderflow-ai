import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { sendCustomerMessage } from "@/lib/messaging.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { Loader2, MessageSquare, Search, Send, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — OrderFlow AI" },
      {
        name: "description",
        content:
          "One inbox for every WhatsApp conversation your AI assistant handles, with pending order drafts surfaced inline.",
      },
      { property: "og:title", content: "Messages — OrderFlow AI" },
      {
        property: "og:description",
        content: "Live WhatsApp inbox with AI draft orders awaiting your approval.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

interface MessageRow {
  id: string;
  customer_id: string | null;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
  customers: { name: string; phone: string } | null;
}

interface Thread {
  customerId: string;
  name: string;
  phone: string;
  messages: MessageRow[];
  last: MessageRow;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function stamp(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

function MessagesPage() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    enabled: !!businessId,
    queryKey: ["whatsapp-messages", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, customer_id, direction, body, created_at, customers(name, phone)")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as MessageRow[];
    },
  });

  const { data: pendingDrafts = [] } = useQuery({
    enabled: !!businessId,
    queryKey: ["pending-drafts-by-customer", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_drafts")
        .select("id, customer_id")
        .eq("business_id", businessId!)
        .eq("status", "pending");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of pendingDrafts) {
      if (!d.customer_id) continue;
      map.set(d.customer_id, (map.get(d.customer_id) ?? 0) + 1);
    }
    return map;
  }, [pendingDrafts]);

  // Live updates as the AI assistant handles WhatsApp conversations.
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`inbox-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp-messages", businessId] });
          qc.invalidateQueries({ queryKey: ["pending-drafts-by-customer", businessId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, qc]);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const m of messages) {
      if (!m.customer_id) continue;
      const existing = map.get(m.customer_id);
      if (existing) {
        existing.messages.push(m);
        existing.last = m;
      } else {
        map.set(m.customer_id, {
          customerId: m.customer_id,
          name: m.customers?.name ?? "WhatsApp customer",
          phone: m.customers?.phone ?? "",
          messages: [m],
          last: m,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
    );
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.name.toLowerCase().includes(q) || t.phone.toLowerCase().includes(q),
    );
  }, [threads, search]);

  const active = filtered.find((t) => t.customerId === activeId) ?? filtered[0] ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active?.customerId, active?.messages.length]);

  const sendFn = useServerFn(sendCustomerMessage);
  const send = useMutation({
    mutationFn: (body: string) => sendFn({ data: { customerId: active!.customerId, body } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["whatsapp-messages", businessId] });
    },
    onError: (e: Error) => toast.error("Message not sent", { description: e.message }),
  });

  return (
    <Card className="grid h-[calc(100vh-10rem)] grid-cols-1 overflow-hidden shadow-card md:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && (
            <div className="grid place-items-center p-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet.
            </p>
          )}
          {filtered.map((t) => {
            const pending = pendingByCustomer.get(t.customerId) ?? 0;
            return (
              <button
                key={t.customerId}
                onClick={() => setActiveId(t.customerId)}
                className={cn(
                  "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/60",
                  active?.customerId === t.customerId && "bg-muted",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {initials(t.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.last.body}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {stamp(t.last.created_at)}
                  </span>
                  {pending > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {pending} draft{pending > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        {!active ? (
          <div className="grid min-h-0 flex-1 place-items-center bg-muted/30 p-6">
            <div className="max-w-xs text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-sm font-semibold">No conversation selected</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Incoming WhatsApp conversations appear here as your assistant handles them.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-4 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials(active.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{active.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {active.phone || "WhatsApp"}
                </div>
              </div>
              {(pendingByCustomer.get(active.customerId) ?? 0) > 0 && (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/approvals">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Review draft
                  </Link>
                </Button>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
              {active.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "outbound" && "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-soft",
                      m.direction === "outbound"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-card",
                    )}
                  >
                    <div>{m.body}</div>
                    <div
                      className={cn(
                        "mt-1 text-[10px]",
                        m.direction === "outbound"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {format(new Date(m.created_at), "HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form
              className="grid grid-cols-[1fr_auto] gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const body = draft.trim();
                if (!body || send.isPending) return;
                send.mutate(body);
              }}
            >
              <Input
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending}>
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </>
        )}
      </section>
    </Card>
  );
}
