import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Settings = {
  business_id: string;
  delivery_methods: string[];
  delivery_charge: number;
  free_delivery_threshold: number | null;
  delivery_areas: string[];
  delivery_time_rules: unknown;
  payment_methods: string[];
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  payment_instructions: string | null;
  advance_payment_policy: string | null;
  cod_policy: string | null;
  return_policy: string | null;
  shipping_policy: string | null;
  canned_messages: Record<string, string> | unknown;
  ai_instructions: string | null;
  ai_tone: string;
  escalation_rules: string | null;
};

const DEFAULTS: Omit<Settings, "business_id"> = {
  delivery_methods: [],
  delivery_charge: 0,
  free_delivery_threshold: null,
  delivery_areas: [],
  delivery_time_rules: [],
  payment_methods: [],
  bank_name: "",
  bank_account_title: "",
  bank_account_number: "",
  payment_instructions: "",
  advance_payment_policy: "",
  cod_policy: "",
  return_policy: "",
  shipping_policy: "",
  canned_messages: {},
  ai_instructions: "",
  ai_tone: "professional",
  escalation_rules: "",
};

const CANNED_KEYS = [
  ["welcome", "Welcome message"],
  ["thank_you", "Thank you message"],
  ["order_confirmation", "Order confirmation message"],
  ["payment_confirmation", "Payment confirmation message"],
  ["delivery", "Delivery message"],
  ["out_of_stock", "Out of stock message"],
] as const;

/** Shared hook: loads (and lazily creates) the business_settings row. */
export function useBusinessSettings() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["business-settings", business?.id],
    enabled: !!business?.id,
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase
        .from("business_settings")
        .select("*")
        .eq("business_id", business!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Settings;
      return { business_id: business!.id, ...DEFAULTS };
    },
  });
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Settings) => {
      const { error } = await supabase
        .from("business_settings")
        .upsert(values as never, { onConflict: "business_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["business-settings"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });
}

function useLocalSettings() {
  const { data } = useBusinessSettings();
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  return [form, setForm] as const;
}

function csv(values: string[] | null | undefined) {
  return (values ?? []).join(", ");
}
function parseCsv(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function SettingsForm({
  form,
  children,
  title,
  description,
}: {
  form: Settings;
  children: React.ReactNode;
  title: string;
  description: string;
}) {

  const save = useSaveSettings();
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          {children}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DeliverySettings() {
  const [form, setForm] = useLocalSettings();
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const rules = Array.isArray(form.delivery_time_rules)
    ? (form.delivery_time_rules as Array<{ label?: string; duration?: string }>)
    : [];
  return (
    <SettingsForm
      form={form}
      setForm={setForm}
      title="Delivery rules"
      description="The assistant will never promise anything outside these rules."
    >
      <Field label="Delivery methods" hint="Comma separated, e.g. Courier, Self pickup">
        <Input value={csv(form.delivery_methods)} onChange={(e) => setForm({ ...form, delivery_methods: parseCsv(e.target.value) })} />
      </Field>
      <Field label="Delivery charge">
        <Input type="number" min="0" step="0.01" value={form.delivery_charge} onChange={(e) => setForm({ ...form, delivery_charge: Number(e.target.value) })} />
      </Field>
      <Field label="Free delivery above">
        <Input type="number" min="0" step="0.01" value={form.free_delivery_threshold ?? ""} onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value === "" ? null : Number(e.target.value) })} />
      </Field>
      <Field label="Delivery areas" hint="Comma separated cities or regions">
        <Input value={csv(form.delivery_areas)} onChange={(e) => setForm({ ...form, delivery_areas: parseCsv(e.target.value) })} />
      </Field>
      <Field
        label="Delivery time rules"
        wide
        hint="One rule per line as: label = duration (e.g. Ready stock = 3–5 working days)"
      >
        <Textarea
          rows={4}
          value={rules.map((r) => `${r.label ?? ""} = ${r.duration ?? ""}`).join("\n")}
          onChange={(e) =>
            setForm({
              ...form,
              delivery_time_rules: e.target.value
                .split("\n")
                .map((line) => line.split("="))
                .filter((parts) => parts[0]?.trim())
                .map((parts) => ({
                  label: parts[0].trim(),
                  duration: (parts[1] ?? "").trim(),
                })),
            })
          }
        />
      </Field>
      <Field label="Shipping policy" wide>
        <Textarea rows={2} value={form.shipping_policy ?? ""} onChange={(e) => setForm({ ...form, shipping_policy: e.target.value })} />
      </Field>
      <Field label="Return policy" wide>
        <Textarea rows={2} value={form.return_policy ?? ""} onChange={(e) => setForm({ ...form, return_policy: e.target.value })} />
      </Field>
    </SettingsForm>
  );
}

export function PaymentSettings() {
  const [form, setForm] = useLocalSettings();
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <SettingsForm
      form={form}
      setForm={setForm}
      title="Payment rules"
      description="The assistant shares only the payment details you store here."
    >
      <Field label="Accepted payment methods" wide hint="Comma separated, e.g. Cash on delivery, Bank transfer, JazzCash">
        <Input value={csv(form.payment_methods)} onChange={(e) => setForm({ ...form, payment_methods: parseCsv(e.target.value) })} />
      </Field>
      <Field label="Bank name">
        <Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
      </Field>
      <Field label="Account title">
        <Input value={form.bank_account_title ?? ""} onChange={(e) => setForm({ ...form, bank_account_title: e.target.value })} />
      </Field>
      <Field label="Account number">
        <Input value={form.bank_account_number ?? ""} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
      </Field>
      <Field label="Advance payment policy">
        <Input value={form.advance_payment_policy ?? ""} onChange={(e) => setForm({ ...form, advance_payment_policy: e.target.value })} />
      </Field>
      <Field label="Payment instructions" wide>
        <Textarea rows={2} value={form.payment_instructions ?? ""} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} />
      </Field>
      <Field label="Cash on delivery policy" wide>
        <Textarea rows={2} value={form.cod_policy ?? ""} onChange={(e) => setForm({ ...form, cod_policy: e.target.value })} />
      </Field>
    </SettingsForm>
  );
}

export function AiSettings() {
  const [form, setForm] = useLocalSettings();
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <SettingsForm
      form={form}
      setForm={setForm}
      title="AI assistant"
      description="Shape how your assistant speaks and when it hands over to you."
    >
      <Field label="Tone" hint="e.g. professional, warm, formal">
        <Input value={form.ai_tone} onChange={(e) => setForm({ ...form, ai_tone: e.target.value })} />
      </Field>
      <Field label="Escalation rules" hint="Situations that must go to a human">
        <Input value={form.escalation_rules ?? ""} onChange={(e) => setForm({ ...form, escalation_rules: e.target.value })} />
      </Field>
      <Field
        label="Additional AI instructions"
        wide
        hint="Written instructions always included in the assistant's context."
      >
        <Textarea
          rows={6}
          value={form.ai_instructions ?? ""}
          onChange={(e) => setForm({ ...form, ai_instructions: e.target.value })}
          placeholder={"Always greet customers politely.\nNever offer discounts.\nAlways ask for a phone number before confirming an order."}
        />
      </Field>
    </SettingsForm>
  );
}

export function CustomerMessagesSettings() {
  const [form, setForm] = useLocalSettings();
  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const messages = (form.canned_messages ?? {}) as Record<string, string>;
  return (
    <SettingsForm
      form={form}
      setForm={setForm}
      title="Customer messages"
      description="Standard wording the assistant adapts naturally in conversations."
    >
      {CANNED_KEYS.map(([key, label]) => (
        <Field key={key} label={label} wide>
          <Textarea
            rows={2}
            value={messages[key] ?? ""}
            onChange={(e) =>
              setForm({ ...form, canned_messages: { ...messages, [key]: e.target.value } })
            }
          />
        </Field>
      ))}
    </SettingsForm>
  );
}
