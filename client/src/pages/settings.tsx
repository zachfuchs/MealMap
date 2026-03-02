import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Users } from "lucide-react";
import { getStoredUser } from "@/lib/auth";

export default function SettingsPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: "", currentPassword: "", newPassword: "" });
  const storedUser = getStoredUser();

  const { data: household, isLoading } = useQuery<any>({ queryKey: ["/api/household"] });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const data: any = {};
      if (profileForm.displayName) data.displayName = profileForm.displayName;
      if (profileForm.newPassword) data.password = profileForm.newPassword;
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated!" });
      setProfileForm({ displayName: "", currentPassword: "", newPassword: "" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const copyInviteCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Invite code copied!" });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3">
        <h1 className="font-bold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your profile and household</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md flex flex-col gap-6">
          <div className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-foreground">Your Profile</h2>
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/20 text-primary font-semibold text-lg">
                  {storedUser?.displayName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) || "MM"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{storedUser?.displayName}</p>
                <p className="text-sm text-muted-foreground">{storedUser?.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Display Name</Label>
                <Input
                  value={profileForm.displayName}
                  onChange={e => setProfileForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder={storedUser?.displayName || "Your name"}
                  data-testid="input-display-name-update"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={profileForm.newPassword}
                  onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  data-testid="input-new-password"
                />
              </div>
              <Button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending || (!profileForm.displayName && !profileForm.newPassword)}
                data-testid="button-update-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-4">
            <h2 className="font-semibold text-foreground">Household</h2>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground">{household?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{household?.members?.length || 0} member{(household?.members?.length || 0) !== 1 ? "s" : ""}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Invite Code</Label>
                  <p className="text-xs text-muted-foreground">Share this code so others can join your household</p>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-muted rounded-md px-3 py-2">
                      <span className="font-mono font-bold text-lg text-foreground tracking-widest">{household?.inviteCode}</span>
                    </div>
                    <Button size="icon" variant="outline" onClick={copyInviteCode} data-testid="button-copy-invite">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <Label>Members</Label>
                  </div>
                  {household?.members?.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/40" data-testid={`member-${m.id}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {m.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.displayName}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      {m.id === storedUser?.id && <Badge variant="secondary" className="ml-auto text-xs">You</Badge>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
