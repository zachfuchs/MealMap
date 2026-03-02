import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Users, Plus } from "lucide-react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    displayName: "",
    householdName: "",
    inviteCode: "",
    mode: "create" as "create" | "join",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: typeof loginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.household);
      navigate("/recipes");
      window.location.reload();
    },
    onError: (err: Error) => {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof registerForm) => {
      const payload: any = {
        email: data.email,
        password: data.password,
        displayName: data.displayName,
      };
      if (data.mode === "create") payload.householdName = data.householdName;
      else payload.inviteCode = data.inviteCode;
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.household);
      navigate("/recipes");
      window.location.reload();
    },
    onError: (err: Error) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">MealMap</h1>
            <p className="text-sm text-muted-foreground mt-1">Family meal planning, simplified</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1" data-testid="tab-login">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="flex-1" data-testid="tab-register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(loginForm); }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    data-testid="input-login-email"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    data-testid="input-login-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={loginMutation.isPending} data-testid="button-login">
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={(e) => { e.preventDefault(); registerMutation.mutate(registerForm); }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-name">Display Name</Label>
                  <Input
                    id="reg-name"
                    placeholder="Your name"
                    value={registerForm.displayName}
                    onChange={e => setRegisterForm(f => ({ ...f, displayName: e.target.value }))}
                    data-testid="input-display-name"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerForm.email}
                    onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))}
                    data-testid="input-register-email"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                    data-testid="input-register-password"
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Household</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterForm(f => ({ ...f, mode: "create" }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-md border text-sm transition-colors ${registerForm.mode === "create" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                      data-testid="button-create-household"
                    >
                      <Plus className="w-4 h-4" />
                      Create New
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterForm(f => ({ ...f, mode: "join" }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-md border text-sm transition-colors ${registerForm.mode === "join" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                      data-testid="button-join-household"
                    >
                      <Users className="w-4 h-4" />
                      Join Existing
                    </button>
                  </div>

                  {registerForm.mode === "create" ? (
                    <Input
                      placeholder="Household name (e.g. The Smiths)"
                      value={registerForm.householdName}
                      onChange={e => setRegisterForm(f => ({ ...f, householdName: e.target.value }))}
                      data-testid="input-household-name"
                      required
                    />
                  ) : (
                    <Input
                      placeholder="Invite code (e.g. ABC12345)"
                      value={registerForm.inviteCode}
                      onChange={e => setRegisterForm(f => ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
                      data-testid="input-invite-code"
                      required
                    />
                  )}
                </div>

                <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending} data-testid="button-register">
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
