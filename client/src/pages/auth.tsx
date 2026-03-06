import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, ShieldCheck, Copy, Check, KeyRound, Loader2 } from "lucide-react";

function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token) {
        const link = `${window.location.origin}/reset-password?token=${data.token}`;
        setResetLink(link);
      } else {
        toast({ title: "If that email exists, a reset link was generated." });
        onClose();
      }
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const handleCopy = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setResetLink(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>

        {!resetLink ? (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll generate a reset link for you.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                data-testid="input-forgot-email"
                onKeyDown={e => { if (e.key === "Enter" && email) forgotMutation.mutate(); }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button
                onClick={() => forgotMutation.mutate()}
                disabled={!email || forgotMutation.isPending}
                className="flex-1"
                data-testid="button-forgot-submit"
              >
                {forgotMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Get Reset Link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300">
              <KeyRound className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">Reset link generated!</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Copy this link and open it in your browser to set a new password. It expires in <strong>1 hour</strong>.
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground font-mono flex-1 min-w-0 truncate" data-testid="text-reset-link">
                {resetLink}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="flex-shrink-0 h-7 px-2"
                onClick={handleCopy}
                data-testid="button-copy-reset-link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Button onClick={() => { window.open(resetLink, "_self"); handleClose(); }} data-testid="button-go-to-reset">
              Open Reset Page
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showForgot, setShowForgot] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (data: typeof form) => {
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">MealMap</h1>
            <p className="text-sm text-muted-foreground mt-1">Family meal planning, simplified</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Sign In</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(form); }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                data-testid="input-login-email"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-primary hover:underline"
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                data-testid="input-login-password"
                required
              />
            </div>
            <Button type="submit" className="w-full mt-1" disabled={loginMutation.isPending} data-testid="button-login">
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <p>New accounts are created by an admin. Contact your household admin to get access.</p>
          </div>
        </div>
      </div>

      <ForgotPasswordDialog open={showForgot} onClose={() => setShowForgot(false)} />
    </div>
  );
}
