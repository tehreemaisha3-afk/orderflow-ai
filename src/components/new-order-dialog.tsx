import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { Button } from "@/components/ui/button";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
import { formatCurrency } from "@/lib/currency";
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(100),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[+0-9()\s-]+$/, "Phone number contains invalid characters"),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  deliveryAddress: z.string().trim().max(300).optional().or(z.literal("")),
  productName: z.string().trim().min(1, "Product name is required").max(150),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100000),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative").max(10000000),
  paymentStatus: z.enum(["paid", "unpaid"]),
  status: z.enum(["new", "awaiting_information", "confirmed", "delivered"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.input<typeof schema>;

const emptyForm: FormValues = {
  customerName: "",
  phone: "",
  city: "",
  deliveryAddress: "",
  productName: "",
  quantity: 1,
  unitPrice: 0,
  paymentStatus: "unpaid",
  status: "new",
  notes: "",
};

export function NewOrderDialog() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const mutation = useMutation({
    mutationFn: async (values: z.output<typeof schema>) => {
      if (!business?.id) throw new Error("No business found for this account.");
      const businessId = business.id;

      // 1. Reuse an existing customer with the same phone, otherwise create one.
      const { data: existing, error: findError } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", values.phone)
        .maybeSingle();
      if (findError) throw findError;

      let customerId = existing?.id ?? null;
      if (!customerId) {
        const { data: created, error: createError } = await supabase
          .from("customers")
          .insert({
            business_id: businessId,
            name: values.customerName,
            phone: values.phone,
            city: values.city || null,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        customerId = created.id;
      }

      // 2. Order number, sequential per business.
      const { count, error: countError } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId);
      if (countError) throw countError;
      const orderNumber = `ORD-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const total = values.quantity * values.unitPrice;

      // 3. Order.
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          order_number: orderNumber,
          status: values.status,
          payment_status: values.paymentStatus,
          delivery_address: values.deliveryAddress || null,
          customer_notes: values.notes || null,
          total,
        })
        .select("id, order_number")
        .single();
      if (orderError) throw orderError;

      // 4. Order item.
      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_name: values.productName,
        quantity: values.quantity,
        unit_price: values.unitPrice,
      });
      if (itemError) throw itemError;

      return order;
    },
    onSuccess: (order) => {
      toast.success(`Order ${order.order_number} created`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForm(emptyForm);
      setErrors({});
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Could not create the order. Please try again.");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    mutation.mutate(parsed.data);
  };

  const total =
    (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>
            Record an order manually. Existing customers are matched by phone number.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" error={errors.customerName} htmlFor="customerName">
              <Input
                id="customerName"
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Phone number" error={errors.phone} htmlFor="phone">
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 555 010 2030"
                inputMode="tel"
              />
            </Field>
            <Field label="City" error={errors.city} htmlFor="city" optional>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field
              label="Delivery address"
              error={errors.deliveryAddress}
              htmlFor="deliveryAddress"
              optional
            >
              <Input
                id="deliveryAddress"
                value={form.deliveryAddress}
                onChange={(e) => set("deliveryAddress", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Product name" error={errors.productName} htmlFor="productName">
                <Input
                  id="productName"
                  value={form.productName}
                  onChange={(e) => set("productName", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Quantity" error={errors.quantity} htmlFor="quantity">
              <Input
                id="quantity"
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value as any)}
              />
            </Field>
            <Field label="Unit price" error={errors.unitPrice} htmlFor="unitPrice">
              <Input
                id="unitPrice"
                type="number"
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => set("unitPrice", e.target.value as any)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment status" htmlFor="paymentStatus">
              <Select
                value={form.paymentStatus}
                onValueChange={(v) => set("paymentStatus", v as FormValues["paymentStatus"])}
              >
                <SelectTrigger id="paymentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Order status" htmlFor="status">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as FormValues["status"])}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="awaiting_information">Awaiting info</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes" error={errors.notes} htmlFor="notes" optional>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything the customer mentioned…"
            />
          </Field>

          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            Order total <span className="font-semibold">{formatCurrency(total)}</span>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
