import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [{ title: "Customers — OrderFlow AI" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: business } = useBusiness();
  const [q, setQ] = useState("");

  const { data: rows = [] } = useQuery({
    enabled: !!business?.id,
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, orders(id, created_at)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      rows.filter((c: any) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return c.name?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s) || c.city?.toLowerCase().includes(s);
      }),
    [rows, q],
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Total orders</TableHead>
                <TableHead>Last order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => {
                const last = c.orders?.length
                  ? c.orders.map((o: any) => new Date(o.created_at).getTime()).sort((a: number, b: number) => b - a)[0]
                  : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to="/customers/$customerId" params={{ customerId: c.id }} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
                    <TableCell>{c.orders?.length ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {last ? format(new Date(last), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No customers yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
