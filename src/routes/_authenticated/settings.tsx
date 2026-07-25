import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — OrderFlow AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Business profile</TabsTrigger>
          <TabsTrigger value="ai">AI settings</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-6"><BusinessProfile /></TabsContent>
        <TabsContent value="ai" className="pt-6"><PlaceholderCard title="AI settings" desc="Configure tone, follow-up templates and AI response rules. Coming soon." /></TabsContent>
        <TabsContent value="whatsapp" className="pt-6"><PlaceholderCard title="WhatsApp integration" desc="Connect your WhatsApp Business account. Coming soon." /></TabsContent>
        <TabsContent value="account" className="pt-6"><AccountCard /></TabsContent>
      </Tabs>
    </div>
  );
}

function BusinessProfile() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (business) setForm(business); }, [business]);
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
        <CardDescription>Update details customers see on receipts and messages.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const { error } = await supabase.from("businesses").update({
              business_name: form.business_name,
              business_type: form.business_type,
              owner_name: form.owner_name,
              whatsapp_number: form.whatsapp_number,
              business_address: form.business_address,
            }).eq("id", form.id);
            setLoading(false);
            if (error) return toast.error(error.message);
            qc.invalidateQueries({ queryKey: ["business"] });
            toast.success("Saved");
          }}
        >
          <F label="Business name"><Input value={form.business_name ?? ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></F>
          <F label="Business type"><Input value={form.business_type ?? ""} onChange={(e) => setForm({ ...form, business_type: e.target.value })} /></F>
          <F label="Owner name"><Input value={form.owner_name ?? ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></F>
          <F label="WhatsApp number"><Input value={form.whatsapp_number ?? ""} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} /></F>
          <div className="sm:col-span-2">
            <F label="Business address"><Input value={form.business_address ?? ""} onChange={(e) => setForm({ ...form, business_address: e.target.value })} /></F>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This module isn't active yet.</p>
      </CardContent>
    </Card>
  );
}

function AccountCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)); }, []);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Signed in as {email ?? "…"}.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="gap-2"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </CardContent>
    </Card>
  );
}
