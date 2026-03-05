import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Users, Plus, Pencil, Trash2, Loader2, ShieldCheck, User,
  Lock, Building2, KeyRound
} from "lucide-react";
import { useLocation } from "wouter";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  householdId: string | null;
  role: "admin" | "user";
  createdAt: string;
};

type AdminHousehold = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

function CreateUserDialog({
  open, onClose, households
}: {
  open: boolean;
  onClose: () => void;
  households: AdminHousehold[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "user" as "admin" | "user",
    householdMode: "invite" as "invite" | "new",
    inviteCode: "",
    householdName: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
        role: form.role,
      };
      if (form.householdMode === "invite") {
        payload.inviteCode = form.inviteCode.trim().toUpperCase();
      } else {
        payload.householdName = form.householdName.trim();
      }
      const res = await apiRequest("POST", "/api/admin/users", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/households"] });
      toast({ title: "User created successfully" });
      onClose();
      setForm({ email: "", password: "", displayName: "", role: "user", householdMode: "invite", inviteCode: "", householdName: "" });
    },
    onError: (err: Error) => toast({ title: "Failed to create user", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Display Name</Label>
            <Input
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="e.g. Jane Smith"
              autoFocus
              data-testid="input-new-user-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
              data-testid="input-new-user-email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Temporary password"
              data-testid="input-new-user-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as "admin" | "user" }))}>
              <SelectTrigger data-testid="select-new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Household</Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, householdMode: "invite" }))}
                className={`p-2 rounded-md border text-sm transition-colors ${form.householdMode === "invite" ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
                data-testid="button-mode-invite"
              >
                Join Existing
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, householdMode: "new" }))}
                className={`p-2 rounded-md border text-sm transition-colors ${form.householdMode === "new" ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
                data-testid="button-mode-new-household"
              >
                Create New
              </button>
            </div>
            {form.householdMode === "invite" ? (
              <Input
                value={form.inviteCode}
                onChange={e => setForm(f => ({ ...f, inviteCode: e.target.value }))}
                placeholder="Invite code (e.g. ABC12345)"
                data-testid="input-invite-code"
              />
            ) : (
              <Input
                value={form.householdName}
                onChange={e => setForm(f => ({ ...f, householdName: e.target.value }))}
                placeholder="Household name (e.g. The Smiths)"
                data-testid="input-household-name"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.email || !form.password || !form.displayName}
            data-testid="button-create-user-submit"
          >
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user, open, onClose, isSelf
}: {
  user: AdminUser;
  open: boolean;
  onClose: () => void;
  isSelf: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    displayName: user.displayName,
    password: "",
    role: user.role,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { displayName: form.displayName };
      if (form.password) payload.password = form.password;
      if (!isSelf) payload.role = form.role;
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}`, payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Failed to update user", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="text-xs bg-primary/20 text-primary font-medium">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">Member since {format(new Date(user.createdAt), "MMM d, yyyy")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Display Name</Label>
            <Input
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              autoFocus
              data-testid="input-edit-display-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>New Password <span className="text-muted-foreground">(leave blank to keep current)</span></Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              data-testid="input-edit-password"
            />
          </div>
          {!isSelf && (
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as "admin" | "user" }))}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !form.displayName.trim()}
            data-testid="button-save-user"
          >
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const currentUser = getStoredUser();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <div>
          <h2 className="font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/recipes")}>Go Back</Button>
      </div>
    );
  }

  const { data: adminUsers = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: households = [] } = useQuery<AdminHousehold[]>({
    queryKey: ["/api/admin/households"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => toast({ title: "Failed to delete user", description: err.message, variant: "destructive" }),
  });

  const householdMap = Object.fromEntries(households.map(h => [h.id, h]));
  const adminCount = adminUsers.filter(u => u.role === "admin").length;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-foreground">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">{adminUsers.length} user{adminUsers.length !== 1 ? "s" : ""} · {adminCount} admin{adminCount !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-user">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add User
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl flex flex-col gap-3">

          {households.length > 0 && (
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                Households
              </h2>
              <div className="flex flex-col gap-2">
                {households.map(h => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card"
                    data-testid={`household-${h.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {adminUsers.filter(u => u.householdId === h.id).length} member{adminUsers.filter(u => u.householdId === h.id).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                        <KeyRound className="w-3 h-3" />
                        <span className="font-mono">{h.inviteCode}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Users
          </h2>

          {usersLoading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {adminUsers.map(user => {
                const isSelf = user.id === currentUser?.id;
                const household = user.householdId ? householdMap[user.householdId] : null;
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-card"
                    data-testid={`user-row-${user.id}`}
                  >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className={`text-xs font-medium ${user.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {initials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className="text-xs"
                          data-testid={`badge-role-${user.id}`}
                        >
                          {user.role === "admin" ? (
                            <><ShieldCheck className="w-3 h-3 mr-1" />Admin</>
                          ) : (
                            <><User className="w-3 h-3 mr-1" />User</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      {household && (
                        <p className="text-xs text-muted-foreground">{household.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditUser(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Delete ${user.displayName}? This cannot be undone.`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        households={households}
      />

      {editUser && (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onClose={() => setEditUser(null)}
          isSelf={editUser.id === currentUser?.id}
        />
      )}
    </div>
  );
}
