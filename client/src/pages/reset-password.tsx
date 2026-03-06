import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token, password });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      toast({ title: "Password updated! You can now sign in." });
    },
    onError: (err: Error) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    resetMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">MealMap</h1>
            <p className="text-sm text-muted-foreground mt-1">Set a new password</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          {!token ? (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <XCircle className="w-10 h-10 text-destructive" />
              <p className="font-semibold text-foreground">Invalid Reset Link</p>
              <p className="text-sm text-muted-foreground">This link is missing a reset token. Please request a new one.</p>
              <Button variant="outline" onClick={() => navigate("/auth")} className="mt-2">
                Back to Sign In
              </Button>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
              <p className="font-semibold text-foreground">Password Updated!</p>
              <p className="text-sm text-muted-foreground">Your password has been changed. You can now sign in with your new password.</p>
              <Button onClick={() => navigate("/auth")} className="mt-2 w-full" data-testid="button-go-to-login">
                Sign In
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground mb-4">Choose a New Password</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    autoFocus
                    required
                    data-testid="input-new-password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    minLength={6}
                    required
                    data-testid="input-confirm-password"
                  />
                  {confirm && password !== confirm && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full mt-1"
                  disabled={resetMutation.isPending || !password || !confirm || password !== confirm}
                  data-testid="button-reset-submit"
                >
                  {resetMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Updating...</>
                  ) : "Set New Password"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-back-to-login"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
