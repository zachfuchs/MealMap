import { useLocation, Link } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BookOpen, ChefHat, ShoppingCart, Calendar, Package, Settings, LogOut, Sparkles
} from "lucide-react";
import { clearAuth, getStoredUser, getStoredHousehold } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Recipes", url: "/recipes", icon: BookOpen },
  { title: "Add Recipe", url: "/add-recipe", icon: Sparkles },
  { title: "Pantry", url: "/pantry", icon: Package },
  { title: "Meal Planner", url: "/meal-planner", icon: Calendar },
  { title: "Grocery List", url: "/grocery", icon: ShoppingCart },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const user = getStoredUser();
  const household = getStoredHousehold();

  const handleLogout = () => {
    clearAuth();
    navigate("/auth");
    window.location.reload();
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)
    : "MM";

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sidebar-foreground text-sm leading-none">MealMap</p>
            {household && <p className="text-xs text-muted-foreground mt-0.5 truncate">{household.name}</p>}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary/20 text-primary font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.displayName || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={handleLogout} data-testid="button-logout" className="flex-shrink-0">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
