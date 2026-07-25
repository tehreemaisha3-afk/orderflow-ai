import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — OrderFlow AI" }] }),
  component: MessagesPage,
});

const contacts = [
  { id: "1", name: "Priya Sharma", last: "Can I add one more? 🙏", time: "10:24", unread: 2 },
  { id: "2", name: "James Okafor", last: "Payment sent, thanks!", time: "09:11", unread: 0 },
  { id: "3", name: "Sofía Núñez", last: "Delivery address is…", time: "Yesterday", unread: 0 },
  { id: "4", name: "Marco Bianchi", last: "Do you have it in blue?", time: "Yesterday", unread: 1 },
];

const thread = [
  { id: 1, from: "them", body: "Hi! Do you still have the strawberry cake?", time: "10:12" },
  { id: 2, from: "me", body: "Yes! We have 2 left today. Would you like to reserve one?", time: "10:14" },
  { id: 3, from: "them", body: "Yes please, and can I add one more? 🙏", time: "10:24" },
];

function MessagesPage() {
  const [active, setActive] = useState(contacts[0].id);
  const [draft, setDraft] = useState("");
  const activeContact = contacts.find((c) => c.id === active)!;

  return (
    <Card className="grid h-[calc(100vh-10rem)] grid-cols-1 overflow-hidden shadow-card md:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search chats" className="pl-9" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/60",
                active === c.id && "bg-muted",
              )}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {c.name.split(" ").map((p) => p[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">{c.last}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground">{c.time}</span>
                {c.unread > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <header className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-border px-4 py-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {activeContact.name.split(" ").map((p) => p[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{activeContact.name}</div>
            <div className="truncate text-xs text-muted-foreground">WhatsApp Business</div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
          {thread.map((m) => (
            <div key={m.id} className={cn("flex", m.from === "me" && "justify-end")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-soft",
                  m.from === "me"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card rounded-bl-md",
                )}
              >
                <div>{m.body}</div>
                <div className={cn(
                  "mt-1 text-[10px]",
                  m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground",
                )}>
                  {m.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          className="grid grid-cols-[1fr_auto] gap-2 border-t border-border p-3"
          onSubmit={(e) => { e.preventDefault(); setDraft(""); }}
        >
          <Input
            placeholder="Type a message… (placeholder)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </section>
    </Card>
  );
}
