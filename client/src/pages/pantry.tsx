import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, ShoppingCart, CheckCircle2, Package, Loader2 } from "lucide-react";
import type { PantryItem } from "@shared/schema";

const CATEGORIES = [
  "produce", "meat_seafood", "dairy", "bakery", "frozen",
  "canned_jarred", "grains_pasta", "condiments_sauces", "spices", "snacks", "beverages", "other"
];

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat_seafood: "Meat & Seafood",
  dairy: "Dairy",
  bakery: "Bakery",
  frozen: "Frozen",
  canned_jarred: "Canned & Jarred",
  grains_pasta: "Grains & Pasta",
  condiments_sauces: "Condiments & Sauces",
  spices: "Spices",
  snacks: "Snacks",
  beverages: "Beverages",
  other: "Other",
};

const LOCATIONS = ["pantry", "fridge", "freezer", "snack_bin"];
const LOCATION_LABELS: Record<string, string> = {
  pantry: "Pantry",
  fridge: "Fridge",
  freezer: "Freezer",
  snack_bin: "Snack Bin",
};

function AddItemDialog({ open, onClose, defaultLocation }: { open: boolean; onClose: () => void; defaultLocation: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    category: "other",
    location: defaultLocation,
    quantityNote: "",
    expiryDate: "",
    autoRestock: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pantry", {
        ...form,
        expiryDate: form.expiryDate || null,
        quantityNote: form.quantityNote || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: "Item added" });
      setForm({ name: "", category: "other", location: defaultLocation, quantityNote: "", expiryDate: "", autoRestock: false });
      onClose();
    },
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Pantry Item</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Item Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. olive oil, chicken thighs" data-testid="input-pantry-name" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Location</Label>
              <Select value={form.location} onValueChange={v => setForm(f => ({ ...f, location: v }))}>
                <SelectTrigger data-testid="select-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map(l => <SelectItem key={l} value={l}>{LOCATION_LABELS[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-pantry-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Quantity Note</Label>
              <Input value={form.quantityNote} onChange={e => setForm(f => ({ ...f, quantityNote: e.target.value }))} placeholder="e.g. almost out, full" data-testid="input-quantity-note" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} data-testid="input-expiry-date" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.autoRestock} onCheckedChange={v => setForm(f => ({ ...f, autoRestock: v }))} id="auto-restock" data-testid="switch-auto-restock" />
            <Label htmlFor="auto-restock">Auto-restock (always add to grocery list)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} data-testid="button-save-pantry-item">
            {mutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAddDialog({ open, onClose, location }: { open: boolean; onClose: () => void; location: string }) {
  const { toast } = useToast();
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const items = lines.map(name => ({ name, category: "other", location }));
      const res = await apiRequest("POST", "/api/pantry/bulk", { items });
      return res.json();
    },
    onSuccess: (items) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: `Added ${items.length} items` });
      setText("");
      onClose();
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Items</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">One item per line</p>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"olive oil\ngarlic\nblack beans\npasta"}
          rows={8}
          data-testid="input-bulk-add"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!text || mutation.isPending} data-testid="button-bulk-save">
            {mutation.isPending ? "Adding..." : "Add Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestockConfirmDialog({
  item,
  open,
  onClose,
}: {
  item: PantryItem;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pantry/${item.id}/restock`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
      if (data.alreadyPresent) {
        toast({ title: `"${item.name}" marked as running low`, description: "Already on your grocery list." });
      } else {
        toast({ title: `"${item.name}" added to grocery list`, description: `Added to "${data.listName}"` });
      }
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to add to grocery list", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !mutation.isPending) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to Grocery List?</DialogTitle>
          <DialogDescription>
            Mark <span className="font-semibold text-foreground">"{item.name}"</span> as running low and add it to your grocery list for the next shopping trip.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid={`button-confirm-restock-${item.id}`}
          >
            {mutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding...</>
            ) : (
              <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Add to Grocery List</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PantryItemCard({ item }: { item: PantryItem }) {
  const { toast } = useToast();
  const [showRestockConfirm, setShowRestockConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/pantry/${item.id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pantry"] }),
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const clearLowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/pantry/${item.id}`, { quantityNote: null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: `"${item.name}" marked as restocked` });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const isLow = item.quantityNote === "running low";

  const isExpiringSoon = item.expiryDate && (() => {
    const d = new Date(item.expiryDate!);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  })();

  return (
    <>
      <div
        className="flex items-center gap-3 py-2 px-3 rounded-md border border-border bg-card group"
        data-testid={`pantry-item-${item.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{item.name}</span>
            {isLow && (
              <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                Low
              </Badge>
            )}
            {!isLow && item.quantityNote && (
              <span className="text-xs text-muted-foreground">({item.quantityNote})</span>
            )}
            {isExpiringSoon && (
              <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Expiring soon
              </Badge>
            )}
            {item.autoRestock && (
              <Badge variant="outline" className="text-xs">Auto-restock</Badge>
            )}
          </div>
          {item.expiryDate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Expires: {new Date(item.expiryDate).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isLow ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={() => clearLowMutation.mutate()}
              disabled={clearLowMutation.isPending}
              title="Mark as restocked"
              data-testid={`button-restocked-${item.id}`}
            >
              {clearLowMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle2 className="w-3.5 h-3.5" />
              }
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
              onClick={() => setShowRestockConfirm(true)}
              title="Need to restock — add to grocery list"
              data-testid={`button-low-${item.id}`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            title="Used up / Remove"
            data-testid={`button-delete-pantry-${item.id}`}
          >
            {deleteMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </Button>
        </div>
      </div>

      {showRestockConfirm && (
        <RestockConfirmDialog
          item={item}
          open={showRestockConfirm}
          onClose={() => setShowRestockConfirm(false)}
        />
      )}
    </>
  );
}

function LocationTab({ items, location }: { items: PantryItem[]; location: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const byCategory = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, PantryItem[]>);

  const lowCount = items.filter(i => i.quantityNote === "running low").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid={`button-add-${location}`}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Item
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} data-testid={`button-bulk-${location}`}>
            Bulk Add
          </Button>
        </div>
        {lowCount > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {lowCount} item{lowCount !== 1 ? "s" : ""} running low
          </span>
        )}
      </div>

      {Object.keys(byCategory).length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center gap-3">
          <Package className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No items in {LOCATION_LABELS[location].toLowerCase()}</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>Add first item</Button>
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, catItems]) => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="flex flex-col gap-1">
              {catItems.map(item => <PantryItemCard key={item.id} item={item} />)}
            </div>
          </div>
        ))
      )}

      <AddItemDialog open={showAdd} onClose={() => setShowAdd(false)} defaultLocation={location} />
      <BulkAddDialog open={showBulk} onClose={() => setShowBulk(false)} location={location} />
    </div>
  );
}

export default function PantryPage() {
  const { data: allItems = [], isLoading } = useQuery<PantryItem[]>({ queryKey: ["/api/pantry"] });

  const byLocation = LOCATIONS.reduce((acc, loc) => {
    acc[loc] = allItems.filter(i => i.location === loc);
    return acc;
  }, {} as Record<string, PantryItem[]>);

  const totalLow = allItems.filter(i => i.quantityNote === "running low").length;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3">
        <h1 className="font-bold text-foreground">Pantry & Fridge</h1>
        <p className="text-xs text-muted-foreground">
          {allItems.length} item{allItems.length !== 1 ? "s" : ""} tracked
          {totalLow > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">· {totalLow} running low</span>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
          </div>
        ) : (
          <Tabs defaultValue="pantry">
            <TabsList className="w-full mb-4">
              {LOCATIONS.map(loc => (
                <TabsTrigger key={loc} value={loc} className="flex-1 text-xs" data-testid={`tab-${loc}`}>
                  {LOCATION_LABELS[loc]}
                  {byLocation[loc].length > 0 && (
                    <span className="ml-1 text-xs bg-muted rounded-full px-1">{byLocation[loc].length}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCATIONS.map(loc => (
              <TabsContent key={loc} value={loc}>
                <LocationTab items={byLocation[loc]} location={loc} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
