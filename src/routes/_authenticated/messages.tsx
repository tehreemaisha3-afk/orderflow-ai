import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — OrderFlow AI" },
      {
        name: "description",
        content:
          "View and reply to your WhatsApp customer conversations in one shared inbox.",
      },
      { property: "og:title", content: "Messages — OrderFlow AI" },
      {
        property: "og:description",
        content:
          "View and reply to your WhatsApp customer conversations in one shared inbox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const [draft, setDraft] = useState("");

  return (
    <Card className="grid h-[calc(100vh-10rem)] grid-cols-1 overflow-hidden shadow-card md:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search chats" className="pl-9" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 place-items-center bg-muted/30 p-6">
          <div className="max-w-xs text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-semibold">No messages yet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Incoming WhatsApp conversations will appear here.
            </p>
          </div>
        </div>

        <form
          className="grid grid-cols-[1fr_auto] gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setDraft("");
          }}
        >
          <Input
            placeholder="Select a conversation to reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled
          />
          <Button type="submit" size="icon" disabled>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>
    </Card>
  );
}
