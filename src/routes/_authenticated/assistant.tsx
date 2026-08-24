import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { sendAssistantMessage } from "@/lib/ai-assistant.functions";
import type { AssistantAnalysis } from "@/lib/ai/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Bot, Plus, Send, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — OrderFlow AI" },
      {
        name: "description",
        content:
          "Test how your AI business assistant replies to customers, and review the intent, extracted products and missing details it detects.",
      },
      { property: "og:title", content: "AI Assistant — OrderFlow AI" },
      {
        property: "og:description",
        content: "Test your AI business assistant and review its internal analysis.",
      },
    ],
  }),
  component: AssistantPage,
});

interface ChatMessage {
  id: string;
  role: "customer" | "assistant";
  content: string;
  metadata: AssistantAnalysis | null;
}

function AssistantPage() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const send = useServerFn(sendAssistantMessage);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["ai-conversations", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, escalated, created_at")
        .eq("business_id", business!.id)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["ai-conversation-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversation_messages")
        .select("id, role, content, metadata")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content,
        metadata: (m.metadata as unknown as AssistantAnalysis | null) ?? null,
      }));
    },
  });

  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (message: string) =>
      send({ data: { conversationId, message, channel: "test" } }),
    onSuccess: async (result) => {
      setConversationId(result.conversationId);
      setPending([]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ai-conversation-messages", result.conversationId] }),
        qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
      ]);
      inputRef.current?.focus();
      if (result.draft && !result.draft.duplicate) {
        toast.success("Order draft created — awaiting your approval", {
          description: `${Math.round(result.draft.confidence * 100)}% confidence${result.draft.issues.length ? ` · ${result.draft.issues.length} issue(s) to review` : ""}`,
          action: {
            label: "Review",
            onClick: () => navigate({ to: "/approvals" }),
          },
        });
      }
    },
    onError: (error: unknown) => {
      setPending([]);
      toast.error(error instanceof Error ? error.message : "The assistant could not reply.");
    },
  });

  const allMessages = useMemo<ChatMessage[]>(
    () => [...(messages.data ?? []), ...pending],
    [messages.data, pending],
  );

  const lastAnalysis = useMemo(
    () => [...allMessages].reverse().find((m) => m.metadata)?.metadata ?? null,
    [allMessages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, mutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  function submit() {
    const text = draft.trim();
    if (!text || mutation.isPending) return;
    setDraft("");
    setPending([{ id: `local-${Date.now()}`, role: "customer", content: text, metadata: null }]);
    mutation.mutate(text);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="flex h-[calc(100vh-12rem)] min-h-[520px] flex-col overflow-hidden shadow-card">
        <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">AI Business Assistant</CardTitle>
            <CardDescription className="truncate">
              Test conversations exactly as a customer would experience them.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              setConversationId(null);
              setPending([]);
              setDraft("");
            }}
          >
            <Plus className="h-4 w-4" /> New
          </Button>
        </CardHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4">
          {allMessages.length === 0 && !mutation.isPending && (
            <div className="mx-auto max-w-md py-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">Welcome to OrderFlow AI</h2>
              <p className="mt-1 text-sm text-muted-foreground">How can I help you today?</p>
            </div>
          )}

          <div className="space-y-3">
            {allMessages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "customer" && "justify-end")}>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-soft",
                    m.role === "customer"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-card text-card-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-md bg-card px-3 py-2 text-sm text-muted-foreground shadow-soft">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            ref={inputRef}
            rows={2}
            value={draft}
            placeholder="Type a customer message…"
            className="min-h-[44px] resize-none"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={mutation.isPending || !draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <AnalysisPanel analysis={lastAnalysis} />
        <Card className="shadow-card">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Recent conversations</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ScrollArea className="max-h-64">
              {(conversations.data ?? []).length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">No conversations yet.</p>
              )}
              <div className="space-y-1">
                {(conversations.data ?? []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setConversationId(c.id);
                      setPending([]);
                    }}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                      conversationId === c.id && "bg-muted",
                    )}
                  >
                    <span className="truncate">{c.title ?? "Conversation"}</span>
                    {c.escalated && (
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: AssistantAnalysis | null }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Internal analysis</CardTitle>
        <CardDescription>Visible to you only — customers never see this.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!analysis && <p className="text-muted-foreground">Send a message to see the analysis.</p>}
        {analysis && (
          <>
            <Row label="Intent">
              <Badge variant="secondary">{analysis.intent.replace(/_/g, " ")}</Badge>
            </Row>
            <Row label="Confidence">{Math.round(analysis.confidence * 100)}%</Row>
            <Separator />
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Products</div>
              {analysis.products.length === 0 ? (
                <p className="text-muted-foreground">None detected</p>
              ) : (
                <ul className="space-y-1">
                  {analysis.products.map((p, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{p.matched_product ?? p.mentioned_as}</span>
                      {p.quantity ? ` × ${p.quantity}` : ""}
                      {!p.matched_product && (
                        <span className="text-muted-foreground"> (no catalogue match)</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Customer details</div>
              <ul className="space-y-0.5 text-xs">
                {(["name", "phone", "city", "address"] as const).map((k) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className="truncate">{analysis.customer[k] ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Missing info</div>
              {analysis.missing_fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing missing</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {analysis.missing_fields.map((f) => (
                    <Badge key={f} variant="outline" className="text-[10px]">
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Row label="Next action">
              <span className="text-right text-xs">{analysis.next_action}</span>
            </Row>
            {analysis.escalation_required && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{analysis.escalation_reason ?? "Human follow-up recommended."}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
