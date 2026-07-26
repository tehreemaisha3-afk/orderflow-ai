import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — OrderFlow AI" },
      {
        name: "description",
        content:
          "Manage your product catalogue, prices, stock and customer aliases so the AI assistant recognises every product name.",
      },
      { property: "og:title", content: "Products — OrderFlow AI" },
      {
        property: "og:description",
        content: "Manage products, prices, stock and aliases used by your AI assistant.",
      },
    ],
  }),
  component: ProductsPage,
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  category: z.string().trim().max(80).optional(),
  sku: z.string().trim().max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0, "Price cannot be negative"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  unit: z.string().trim().min(1).max(30),
  image_url: z.string().trim().max(500).optional(),
  is_active: z.boolean(),
});

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  description: string | null;
  price: number;
  stock: number;
  unit: string;
  image_url: string | null;
  is_active: boolean;
};

interface FormState extends Omit<ProductRow, "id" | "price" | "stock"> {
  id?: string;
  price: string;
  stock: string;
  aliases: string;
}

const emptyForm: FormState = {
  name: "",
  category: "",
  sku: "",
  description: "",
  price: "0",
  stock: "0",
  unit: "piece",
  image_url: "",
  is_active: true,
  aliases: "",
};

function ProductsPage() {
  const { data: business } = useBusiness();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const products = useQuery({
    queryKey: ["products", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const [{ data: rows, error }, { data: aliasRows, error: aliasError }] = await Promise.all([
        supabase.from("products").select("*").eq("business_id", business!.id).order("name"),
        supabase
          .from("product_aliases")
          .select("product_id, alias")
          .eq("business_id", business!.id),
      ]);
      if (error) throw error;
      if (aliasError) throw aliasError;
      const map = new Map<string, string[]>();
      for (const a of aliasRows ?? []) map.set(a.product_id, [...(map.get(a.product_id) ?? []), a.alias]);
      return (rows ?? []).map((p) => ({ ...(p as ProductRow), aliases: map.get(p.id) ?? [] }));
    },
  });

  const save = useMutation({
    mutationFn: async (state: FormState) => {
      if (!business) throw new Error("Business not loaded");
      const parsed = productSchema.parse({
        name: state.name,
        category: state.category || undefined,
        sku: state.sku || undefined,
        description: state.description || undefined,
        price: Number(state.price),
        stock: Number(state.stock),
        unit: state.unit,
        image_url: state.image_url || undefined,
        is_active: state.is_active,
      });

      const payload = {
        business_id: business.id,
        name: parsed.name,
        category: parsed.category ?? null,
        sku: parsed.sku ?? null,
        description: parsed.description ?? null,
        price: parsed.price,
        stock: parsed.stock,
        unit: parsed.unit,
        image_url: parsed.image_url ?? null,
        is_active: parsed.is_active,
      };

      let productId = state.id;
      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      const aliases = Array.from(
        new Set(
          state.aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
            .slice(0, 30),
        ),
      );
      const { error: delError } = await supabase
        .from("product_aliases")
        .delete()
        .eq("product_id", productId);
      if (delError) throw delError;
      if (aliases.length) {
        const { error: insError } = await supabase.from("product_aliases").insert(
          aliases.map((alias) => ({ product_id: productId!, business_id: business.id, alias })),
        );
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      toast.success("Product saved");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Could not save product",
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete product"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Product catalogue</h2>
          <p className="text-sm text-muted-foreground">
            Your AI assistant only sells and quotes what is listed here.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add product
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {products.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
          {!products.isLoading && (products.data ?? []).length === 0 && (
            <div className="grid place-items-center gap-2 p-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No products yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your products with prices, stock and the alternative names customers use.
              </p>
            </div>
          )}
          {(products.data ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden md:table-cell">Aliases</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="hidden sm:table-cell">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category ?? "—"}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.aliases.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {p.aliases.map((a) => (
                            <Badge key={a} variant="outline" className="text-[10px]">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.price} <span className="text-xs text-muted-foreground">/ {p.unit}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.stock}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "secondary" : "outline"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => {
                              setForm({
                                id: p.id,
                                name: p.name,
                                category: p.category ?? "",
                                sku: p.sku ?? "",
                                description: p.description ?? "",
                                price: String(p.price),
                                stock: String(p.stock),
                                unit: p.unit,
                                image_url: p.image_url ?? "",
                                is_active: p.is_active,
                                aliases: p.aliases.join(", "),
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => remove.mutate(p.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              Aliases let the assistant recognise the names your customers actually use.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <Field label="Product name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Category">
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="SKU (optional)">
              <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Price">
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
            <Field label="Stock">
              <Input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
            </Field>
            <Field label="Unit">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="piece, box, kg…" required />
            </Field>
            <Field label="Image URL (optional)">
              <Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Aliases (comma separated)" className="sm:col-span-2">
              <Input
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="e.g. BP apparatus, BP machine"
              />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border p-3 sm:col-span-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive products are never offered by the AI.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
