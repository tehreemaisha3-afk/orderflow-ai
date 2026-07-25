import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business-setup")({
  head: () => ({ meta: [{ title: "Business setup — OrderFlow AI" }] }),
  component: Setup,
});

function Setup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    owner_name: "",
    whatsapp_number: "",
    business_address: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If they already have a business, skip
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", data.user.id)
        .maybeSingle();
      if (biz) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-xl shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <CardTitle>Tell us about your business</CardTitle>
          <CardDescription>We'll use this to set up your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { data: user } = await supabase.auth.getUser();
              if (!user.user) return;
              const { error } = await supabase.from("businesses").insert({
                owner_id: user.user.id,
                ...form,
              });
              setLoading(false);
              if (error) return toast.error(error.message);
              qc.invalidateQueries({ queryKey: ["business"] });
              toast.success("Business created");
              navigate({ to: "/dashboard" });
            }}
          >
            <Field label="Business name" required>
              <Input
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
            </Field>
            <Field label="Business type">
              <Input
                placeholder="e.g. Bakery, Boutique, Restaurant"
                value={form.business_type}
                onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              />
            </Field>
            <Field label="Owner name">
              <Input
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp Business number">
              <Input
                placeholder="+1 555 123 4567"
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              />
            </Field>
            <Field label="Business address">
              <Input
                value={form.business_address}
                onChange={(e) => setForm({ ...form, business_address: e.target.value })}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Continue to dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
