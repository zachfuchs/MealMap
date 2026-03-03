import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, Clock, Search } from "lucide-react";
import { getToken } from "@/lib/auth";
import type { Recipe } from "@shared/schema";

const MEAL_SLOTS = ["dinner", "breakfast", "lunch", "snack"] as const;
const SLOT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const SLOT_COLORS = {
  breakfast: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50",
  lunch: "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50",
  dinner: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50",
  snack: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50",
};
const SLOT_TEXT = {
  breakfast: "text-amber-700 dark:text-amber-300",
  lunch: "text-sky-700 dark:text-sky-300",
  dinner: "text-indigo-700 dark:text-indigo-300",
  snack: "text-green-700 dark:text-green-300",
};

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

type DragSource = {
  entryId: number;
  date: string;
  slot: string;
  recipeId: string | null;
  customMealText: string | null;
};

function AddMealDialog({
  open, onClose, date, slot, onSave
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  slot: string;
  onSave: (data: any) => void;
}) {
  const [search, setSearch] = useState("");
  const [customText, setCustomText] = useState("");
  const [mode, setMode] = useState<"recipe" | "custom">("recipe");

  const { data: recipes = [] } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });

  const filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (recipe: Recipe) => {
    onSave({ recipeId: recipe.id, customMealText: null });
    onClose();
  };

  const handleCustom = () => {
    if (!customText.trim()) return;
    onSave({ recipeId: null, customMealText: customText });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to {SLOT_LABELS[slot as keyof typeof SLOT_LABELS]}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{format(new Date(date + "T12:00"), "EEEE, MMMM d")}</p>

        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={mode === "recipe" ? "default" : "outline"} onClick={() => setMode("recipe")} data-testid="button-mode-recipe">
            From Library
          </Button>
          <Button size="sm" variant={mode === "custom" ? "default" : "outline"} onClick={() => setMode("custom")} data-testid="button-mode-custom">
            Free Text
          </Button>
        </div>

        {mode === "recipe" ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 text-sm"
                placeholder="Search recipes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search-meal"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-4">No recipes found</p>
              ) : (
                filtered.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => handleSelect(recipe)}
                    className="text-left px-3 py-2 rounded-md hover-elevate border border-transparent flex items-center justify-between gap-2"
                    data-testid={`meal-recipe-${recipe.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{recipe.title}</p>
                      {(recipe.prepTimeEstimated || recipe.cookTimeEstimated) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(recipe.prepTimeEstimated || 0) + (recipe.cookTimeEstimated || 0)} min
                        </p>
                      )}
                    </div>
                    {recipe.rating && (
                      <span className="text-xs text-amber-500 flex-shrink-0">★ {recipe.rating}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="e.g. Leftovers, Takeout, Eating out..."
              onKeyDown={e => e.key === "Enter" && handleCustom()}
              data-testid="input-custom-meal"
              autoFocus
            />
            <Button onClick={handleCustom} disabled={!customText.trim()} data-testid="button-add-custom-meal">
              Add
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MealSlotCell({ slot, entry, onAdd, onRemove, onDragStart, onDrop, date }: {
  slot: string;
  entry: any;
  onAdd: (date: string, slot: string) => void;
  onRemove: (id: number) => void;
  onDragStart: (source: DragSource) => void;
  onDrop: (targetDate: string, targetSlot: string) => void;
  date: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const colorClass = SLOT_COLORS[slot as keyof typeof SLOT_COLORS];
  const textClass = SLOT_TEXT[slot as keyof typeof SLOT_TEXT];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(date, slot);
  };

  return (
    <div
      className={`min-h-[60px] p-1.5 rounded border ${colorClass} flex flex-col gap-1 transition-all duration-150 ${isDragOver ? "ring-2 ring-primary ring-inset brightness-95" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`cell-${date}-${slot}`}
    >
      {entry ? (
        <div
          className="flex items-start justify-between gap-1 group cursor-grab active:cursor-grabbing select-none"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart({ entryId: entry.id, date, slot, recipeId: entry.recipeId, customMealText: entry.customMealText });
          }}
        >
          <p className={`text-xs font-medium leading-snug ${textClass} flex-1 min-w-0`}>
            {entry.recipe?.title || entry.customMealText}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0"
            data-testid={`button-remove-entry-${entry.id}`}
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onAdd(date, slot)}
          className="flex-1 flex items-center justify-center text-muted-foreground/50 min-h-[44px]"
          data-testid={`button-add-meal-${date}-${slot}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function MealPlannerPage() {
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [addDialog, setAddDialog] = useState<{ date: string; slot: string } | null>(null);
  const dragSourceRef = useRef<DragSource | null>(null);

  const weekStart = format(currentWeek, "yyyy-MM-dd");
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const { data: mealPlan, isLoading } = useQuery<any>({
    queryKey: ["/api/meal-plans", weekStart],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`/api/meal-plans?weekStart=${weekStart}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const entryMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    if (mealPlan?.entries) {
      for (const entry of mealPlan.entries) {
        if (!map[entry.date]) map[entry.date] = {};
        map[entry.date][entry.mealSlot] = entry;
      }
    }
    return map;
  }, [mealPlan]);

  const addMealMutation = useMutation({
    mutationFn: async ({ date, slot, data }: any) => {
      const res = await apiRequest("POST", "/api/meal-plans/entries", {
        weekStart,
        date,
        mealSlot: slot,
        ...data,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
    onError: () => toast({ title: "Failed to add meal", variant: "destructive" }),
  });

  const removeMealMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meal-plans/entries/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
    onError: () => toast({ title: "Failed to remove meal", variant: "destructive" }),
  });

  const moveMealMutation = useMutation({
    mutationFn: async ({ source, targetDate, targetSlot }: { source: DragSource; targetDate: string; targetSlot: string }) => {
      await apiRequest("POST", "/api/meal-plans/entries", {
        weekStart,
        date: targetDate,
        mealSlot: targetSlot,
        recipeId: source.recipeId || null,
        customMealText: source.customMealText || null,
      });
      await apiRequest("DELETE", `/api/meal-plans/entries/${source.entryId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
    onError: () => toast({ title: "Failed to move meal", variant: "destructive" }),
  });

  const handleDragStart = (source: DragSource) => {
    dragSourceRef.current = source;
  };

  const handleDrop = (targetDate: string, targetSlot: string) => {
    const source = dragSourceRef.current;
    dragSourceRef.current = null;
    if (!source) return;
    if (source.date === targetDate && source.slot === targetSlot) return;
    moveMealMutation.mutate({ source, targetDate, targetSlot });
  };

  const today = new Date();
  const isCurrentWeek = isSameDay(getMonday(today), currentWeek);

  const totalTime = useMemo(() => {
    const times: Record<string, number> = {};
    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = entryMap[dateStr] || {};
      let total = 0;
      for (const entry of Object.values(dayEntries)) {
        if ((entry as any).recipe) {
          total += ((entry as any).recipe.prepTimeEstimated || 0) + ((entry as any).recipe.cookTimeEstimated || 0);
        }
      }
      times[dateStr] = total;
    }
    return times;
  }, [entryMap, days]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bold text-foreground">Meal Planner</h1>
          <p className="text-xs text-muted-foreground">
            Week of {format(currentWeek, "MMMM d, yyyy")}
            {isCurrentWeek && <span className="ml-1 text-primary font-medium">(This week)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setCurrentWeek(w => subWeeks(w, 1))} data-testid="button-prev-week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCurrentWeek(getMonday(new Date()))} data-testid="button-today">
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => setCurrentWeek(w => addWeeks(w, 1))} data-testid="button-next-week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {days.map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isToday = isSameDay(day, today);
                  const time = totalTime[dateStr] || 0;
                  return (
                    <div key={dateStr} className="text-center">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {format(day, "EEE")}
                      </p>
                      <p className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </p>
                      {time > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{time}m
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {MEAL_SLOTS.map(slot => (
                <div key={slot} className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1 ml-0.5">{SLOT_LABELS[slot]}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {days.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const entry = entryMap[dateStr]?.[slot];
                      return (
                        <MealSlotCell
                          key={dateStr}
                          slot={slot}
                          entry={entry}
                          date={dateStr}
                          onAdd={(d, s) => setAddDialog({ date: d, slot: s })}
                          onRemove={(id) => removeMealMutation.mutate(id)}
                          onDragStart={handleDragStart}
                          onDrop={handleDrop}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {addDialog && (
        <AddMealDialog
          open={!!addDialog}
          onClose={() => setAddDialog(null)}
          date={addDialog.date}
          slot={addDialog.slot}
          onSave={(data) => {
            addMealMutation.mutate({ date: addDialog.date, slot: addDialog.slot, data });
            setAddDialog(null);
          }}
        />
      )}
    </div>
  );
}
