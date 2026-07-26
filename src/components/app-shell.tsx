import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  MessageCircle,
  Bot,
  Package,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useBusiness } from "@/hooks/use-business";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const nav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Messages", url: "/messages", icon: MessageCircle },
  { title: "Assistant", url: "/assistant", icon: Bot },
  { title: "Products", url: "/products", icon: Package },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

function AppSidebarInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: business } = useBusiness();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">OrderFlow AI</div>
              <div className="truncate text-xs text-muted-foreground">
                {business?.business_name ?? "Your business"}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SignOutButton collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      }}
    >
      <LogOut className="h-4 w-4" />
      {!collapsed && <span>Sign out</span>}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title =
    nav.find((n) => pathname === n.url || pathname.startsWith(n.url + "/"))?.title ??
    "OrderFlow AI";
  const { data: business } = useBusiness();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebarInner />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
            <SidebarTrigger />
            <h1 className="truncate text-base font-semibold">{title}</h1>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {(business?.owner_name ?? business?.business_name ?? "OA").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
