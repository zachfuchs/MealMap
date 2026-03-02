import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getToken } from "./lib/auth";

import AuthPage from "@/pages/auth";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipe-detail";
import AddRecipePage from "@/pages/add-recipe";
import PantryPage from "@/pages/pantry";
import MealPlannerPage from "@/pages/meal-planner";
import GroceryListPage from "@/pages/grocery-list";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/recipes" component={RecipesPage} />
              <Route path="/recipes/:id" component={RecipeDetailPage} />
              <Route path="/add-recipe" component={AddRecipePage} />
              <Route path="/pantry" component={PantryPage} />
              <Route path="/meal-planner" component={MealPlannerPage} />
              <Route path="/grocery" component={GroceryListPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/" component={() => <Redirect to="/recipes" />} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const token = getToken();
  const [location] = useLocation();

  if (!token && location !== "/auth") {
    return <Redirect to="/auth" />;
  }

  if (token && location === "/auth") {
    return <Redirect to="/recipes" />;
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route component={ProtectedLayout} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
