import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  ShoppingCart, ChevronLeft, ChevronRight, RefreshCw, Plus,
  Copy, Check, Maximize2, Minimize2, Loader2, PackageCheck,
  Pencil, Sparkles, GripVertical, Trash2
} from "lucide-react";
import { formatQty } from "@/lib/format";
import type { GroceryListItem } from "@shared/schema";

const CATEGORY_ORDER = [
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

const INGREDIENT_TO_PANTRY_CATEGORY: Record<string, string> = {
  produce: "produce",
  meat_seafood: "meat_seafood",
  dairy: "dairy",
  bakery: "other",
  frozen: "other",
  canned_jarred: "canned_jarred",
  grains_pasta: "grains_pasta",
  condiments_sauces: "condiments_sauces",
  spices: "spices",
  snacks: "snacks",
  beverages: "beverages",
  other: "other",
};

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function AddItemDialog({
  open, onClose, listId, onCreated
}: {
  open: boolean;
  onClose: () => void;
  listId: string | null;
  onCreated?: (id: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("other");

  const createListMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/grocery-lists", { name: "My grocery list" });
      return res.json();
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (targetListId: string) => {
      const res = await apiRequest("POST", `/api/grocery-lists/${targetListId}/items`, {
        ingredientName: name.trim(),
        totalQuantity: qty || null,
        unit: unit || null,
        category,
        sourceRecipes: [],
        isChecked: false,
        isPantryCovered: false,
        manuallyAdded: true,
        notes: null,
      });
      return res.json();
    },
    onSuccess: (_, targetListId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", targetListId] });
      toast({ title: "Item added to grocery list" });
      setName(""); setQty(""); setUnit(""); setCategory("other");
      onClose();
    },
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  const handleAdd = async () => {
    let targetId = listId;
    if (!targetId) {
      const newList = await createListMutation.mutateAsync();
      targetId = newList.id;
      onCreated?.(newList.id);
    }
    addItemMutation.mutate(targetId);
  };

  const isPending = createListMutation.isPending || addItemMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Item to List</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Item name (e.g. olive oil)"
            data-testid="input-grocery-item-name"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) handleAdd(); }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (optional)" data-testid="input-grocery-qty" />
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (optional)" data-testid="input-grocery-unit" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-grocery-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!name.trim() || isPending} data-testid="button-add-grocery-item">
            {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Add to List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({
  item, listId, open, onClose
}: {
  item: GroceryListItem;
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(item.ingredientName);
  const [qty, setQty] = useState(item.totalQuantity || "");
  const [unit, setUnit] = useState(item.unit || "");
  const [category, setCategory] = useState(item.category || "other");

  useEffect(() => {
    if (open) {
      setName(item.ingredientName);
      setQty(item.totalQuantity || "");
      setUnit(item.unit || "");
      setCategory(item.category || "other");
    }
  }, [open, item.id]);

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/grocery-lists/${listId}/items/${item.id}`, {
        ingredientName: name.trim(),
        totalQuantity: qty || null,
        unit: unit || null,
        category,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", listId] });
      toast({ title: "Item updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/grocery-lists/${listId}/items/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", listId] });
      toast({ title: "Item removed" });
      onClose();
    },
    onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Item name"
            autoFocus
            data-testid="input-edit-item-name"
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) editMutation.mutate(); }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (optional)" data-testid="input-edit-qty" />
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (optional)" data-testid="input-edit-unit" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-edit-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-grocery-item"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={editMutation.isPending}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={!name.trim() || editMutation.isPending} data-testid="button-save-grocery-item">
              {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAddDialog({
  open, onClose, listId, onCreated
}: {
  open: boolean;
  onClose: () => void;
  listId: string | null;
  onCreated?: (id: string) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");

  const createListMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/grocery-lists", { name: "My grocery list" });
      return res.json();
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (targetListId: string) => {
      const items = text.split("\n").map(l => l.trim()).filter(Boolean);
      const res = await apiRequest("POST", `/api/grocery-lists/${targetListId}/bulk-add`, { items });
      return res.json();
    },
    onSuccess: (data, targetListId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", targetListId] });
      toast({ title: `${data.length} items added!` });
      setText("");
      onClose();
    },
    onError: () => toast({ title: "Failed to add items", variant: "destructive" }),
  });

  const handleAdd = async () => {
    let targetId = listId;
    if (!targetId) {
      const newList = await createListMutation.mutateAsync();
      targetId = newList.id;
      onCreated?.(newList.id);
    }
    bulkAddMutation.mutate(targetId);
  };

  const isPending = createListMutation.isPending || bulkAddMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Items</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            Enter one item per line. AI will automatically assign categories.
          </p>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"milk\n2 cups flour\nchicken breast\nolive oil\n6 eggs"}
            className="min-h-[160px] font-mono text-sm resize-none"
            autoFocus
            data-testid="textarea-bulk-add"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!text.trim() || isPending} data-testid="button-bulk-add-submit">
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding with AI...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Add with AI</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroceryItemRow({
  item, listId, storeMode, onCategoryChange
}: {
  item: GroceryListItem;
  listId: string;
  storeMode: boolean;
  onCategoryChange: (itemId: number, category: string) => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const checkMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      const res = await apiRequest("PATCH", `/api/grocery-lists/${listId}/items/${item.id}`, { isChecked: checked });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", listId] }),
  });

  const haveItMutation = useMutation({
    mutationFn: async () => {
      const pantryCategory = INGREDIENT_TO_PANTRY_CATEGORY[item.category || "other"] || "other";
      await apiRequest("POST", "/api/pantry", {
        name: item.ingredientName,
        category: pantryCategory,
        location: "pantry",
        quantityNote: formatQty(item.totalQuantity)
          ? `${formatQty(item.totalQuantity)}${item.unit ? ` ${item.unit}` : ""}`
          : null,
        expiryDate: null,
        autoRestock: false,
      });
      const res = await apiRequest("PATCH", `/api/grocery-lists/${listId}/items/${item.id}`, {
        isPantryCovered: true,
        isChecked: true,
        notes: "pantry",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: `"${item.ingredientName}" added to pantry` });
    },
    onError: () => toast({ title: "Failed to add to pantry", variant: "destructive" }),
  });

  const isRecipeItem = !item.manuallyAdded;
  const alreadyInPantry = item.isPantryCovered;

  return (
    <>
      <div
        className={`flex items-start gap-2 py-2 px-3 rounded-md transition-opacity group ${item.isChecked ? "opacity-40" : alreadyInPantry ? "opacity-60" : "hover:bg-muted/40"}`}
        data-testid={`grocery-item-${item.id}`}
        draggable={!storeMode}
        onDragStart={e => {
          e.dataTransfer.setData("grocery-item-id", String(item.id));
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        {!storeMode && (
          <GripVertical className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <Checkbox
          checked={item.isChecked}
          onCheckedChange={v => checkMutation.mutate(!!v)}
          className="mt-0.5 flex-shrink-0"
          data-testid={`check-grocery-${item.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${storeMode ? "text-base" : "text-sm"} font-medium text-foreground ${item.isChecked ? "line-through" : ""}`}>
              {item.ingredientName}
              {formatQty(item.totalQuantity) && (
                <span className="font-normal text-muted-foreground">
                  {" "}{formatQty(item.totalQuantity)}{item.unit ? ` ${item.unit}` : ""}
                </span>
              )}
            </span>
            {alreadyInPantry && !item.isChecked && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 dark:text-green-400 dark:border-green-900">
                <Check className="w-2.5 h-2.5 mr-1" />
                {item.notes === "fridge" ? "In fridge"
                  : item.notes === "freezer" ? "In freezer"
                  : item.notes === "snack_bin" ? "In snack bin"
                  : "In pantry"}
              </Badge>
            )}
            {item.manuallyAdded && !alreadyInPantry && (
              <Badge variant="secondary" className="text-xs">Added</Badge>
            )}
          </div>
          {item.sourceRecipes && item.sourceRecipes.length > 0 && !storeMode && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.sourceRecipes.join(", ")}</p>
          )}
        </div>

        {!storeMode && (
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {isRecipeItem && !alreadyInPantry && !item.isChecked && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={() => haveItMutation.mutate()}
                disabled={haveItMutation.isPending}
                title="I already have this — add to pantry"
                data-testid={`button-have-it-${item.id}`}
              >
                {haveItMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <><PackageCheck className="w-3 h-3 mr-1" />Have it</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
              title="Edit item"
              data-testid={`button-edit-grocery-${item.id}`}
            >
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {isEditing && (
        <EditItemDialog
          item={item}
          listId={listId}
          open={isEditing}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
}

export default function GroceryListPage() {
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [storeMode, setStoreMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const weekStart = format(currentWeek, "yyyy-MM-dd");

  const { data: allLists = [], isLoading: listsLoading } = useQuery<any[]>({
    queryKey: ["/api/grocery-lists"],
  });

  const latestListId = activeListId || (allLists.length > 0 ? allLists[allLists.length - 1]?.id : null);

  const { data: groceryList, isLoading: listLoading } = useQuery<any>({
    queryKey: ["/api/grocery-lists", latestListId],
    enabled: !!latestListId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/grocery-lists/generate", { weekStart });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveListId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", data.id] });
      toast({ title: "Grocery list generated!" });
    },
    onError: (err: Error) => toast({ title: "Failed to generate", description: err.message, variant: "destructive" }),
  });

  const categoryMutation = useMutation({
    mutationFn: async ({ itemId, category }: { itemId: number; category: string }) => {
      const res = await apiRequest("PATCH", `/api/grocery-lists/${latestListId}/items/${itemId}`, { category });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists", latestListId] });
    },
    onError: () => toast({ title: "Failed to move item", variant: "destructive" }),
  });

  const handleCategoryDrop = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDragOverCat(null);
    const itemId = e.dataTransfer.getData("grocery-item-id");
    if (!itemId) return;
    const item = items.find(i => i.id === parseInt(itemId));
    if (item && item.category !== cat) {
      categoryMutation.mutate({ itemId: parseInt(itemId), category: cat });
    }
  };

  const items: GroceryListItem[] = groceryList?.items || [];
  const checkedCount = items.filter(i => i.isChecked).length;
  const uncheckedCount = items.filter(i => !i.isChecked && !i.isPantryCovered).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const grouped = useMemo(() => {
    const map: Record<string, GroceryListItem[]> = {};
    for (const item of items) {
      const cat = item.category || "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    const sorted: Record<string, GroceryListItem[]> = {};
    for (const cat of CATEGORY_ORDER) {
      if (map[cat]) {
        if (storeMode) {
          sorted[cat] = [...map[cat]].sort((a, b) => Number(a.isChecked) - Number(b.isChecked));
        } else {
          sorted[cat] = map[cat];
        }
      }
    }
    return sorted;
  }, [items, storeMode]);

  const copyToClipboard = () => {
    const text = [`Grocery List — Week of ${format(currentWeek, "MMM d")}\n`];
    for (const cat of CATEGORY_ORDER) {
      const catItems = grouped[cat];
      if (!catItems?.length) continue;
      text.push(`\n${CATEGORY_LABELS[cat].toUpperCase()}`);
      for (const item of catItems) {
        const qty = formatQty(item.totalQuantity)
          ? `, ${formatQty(item.totalQuantity)}${item.unit ? ` ${item.unit}` : ""}`
          : "";
        const checked = item.isChecked ? "[x] " : "[ ] ";
        text.push(`${checked}${item.ingredientName}${qty}`);
      }
    }
    navigator.clipboard.writeText(text.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const isLoading = listsLoading || listLoading;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bold text-foreground">Grocery List</h1>
          {!storeMode && (
            <p className="text-xs text-muted-foreground">Week of {format(currentWeek, "MMMM d, yyyy")}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!storeMode && (
            <>
              <Button size="icon" variant="outline" onClick={() => setCurrentWeek(w => subWeeks(w, 1))} data-testid="button-prev-week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => setCurrentWeek(w => addWeeks(w, 1))} data-testid="button-next-week">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-list">
                {generateMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Generate</>
                )}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(true)}
            data-testid="button-add-grocery"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Item
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBulkAdd(true)}
            data-testid="button-bulk-add"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Bulk Add
          </Button>
          {groceryList && (
            <>
              <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-list">
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copy
              </Button>
              <Button size="sm" variant={storeMode ? "default" : "outline"} onClick={() => setStoreMode(s => !s)} data-testid="button-store-mode">
                {storeMode ? <Minimize2 className="w-3.5 h-3.5 mr-1.5" /> : <Maximize2 className="w-3.5 h-3.5 mr-1.5" />}
                {storeMode ? "Exit" : "Shopping"}
              </Button>
            </>
          )}
        </div>
      </div>

      {groceryList && (
        <div className="px-4 py-2.5 border-b border-border bg-background flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {checkedCount}/{totalCount} checked
            {uncheckedCount > 0 && <span className="text-foreground font-medium"> · {uncheckedCount} to get</span>}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
          </div>
        ) : !groceryList ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">No grocery list yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Generate from your meal plan, or add items manually</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-first">
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Generate from Meal Plan</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-manual-first">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
              <Button variant="outline" onClick={() => setShowBulkAdd(true)} data-testid="button-bulk-add-first">
                <Sparkles className="w-4 h-4 mr-2" />
                Bulk Add
              </Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No items yet.</p>
            <div className="flex gap-2 justify-center mt-3">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Add items
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowBulkAdd(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />Bulk Add
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 max-w-xl">
            {!storeMode && (
              <p className="text-xs text-muted-foreground -mb-2">
                Hover items to <span className="font-medium">edit</span> or use <span className="font-medium">Have it</span>. Drag items between categories.
              </p>
            )}
            {Object.entries(grouped).map(([cat, catItems]) => (
              <div
                key={cat}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverCat(cat);
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCat(null);
                  }
                }}
                onDrop={e => handleCategoryDrop(e, cat)}
                className={`rounded-lg transition-colors duration-150 ${dragOverCat === cat ? "bg-muted/50 ring-2 ring-primary/20" : ""}`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className={`font-semibold text-foreground ${storeMode ? "text-lg" : "text-sm"}`}>
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {catItems.filter(i => !i.isChecked).length} left
                  </span>
                </div>
                <div className="flex flex-col">
                  {catItems.map(item => (
                    <GroceryItemRow
                      key={item.id}
                      item={item}
                      listId={groceryList.id}
                      storeMode={storeMode}
                      onCategoryChange={(itemId, category) => categoryMutation.mutate({ itemId, category })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddItemDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        listId={latestListId}
        onCreated={(id) => {
          setActiveListId(id);
          queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
        }}
      />

      <BulkAddDialog
        open={showBulkAdd}
        onClose={() => setShowBulkAdd(false)}
        listId={latestListId}
        onCreated={(id) => {
          setActiveListId(id);
          queryClient.invalidateQueries({ queryKey: ["/api/grocery-lists"] });
        }}
      />
    </div>
  );
}
