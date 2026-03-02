import { useState } from "react";
import { formatQty } from "@/lib/format";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Star, Clock, Users, Heart, ChefHat, Maximize2, Minimize2,
  Check, Edit, Trash2, BookOpen, Timer, ExternalLink
} from "lucide-react";
import type { Recipe, Ingredient, RecipeStep } from "@shared/schema";

interface RecipeWithDetails extends Recipe {
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

function StarRating({ rating, onChange }: { rating: number | null; onChange?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`w-5 h-5 ${s <= (hover || rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

function CookModal({ recipe, open, onClose }: { recipe: RecipeWithDetails; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    prepTimeActual: recipe.prepTimeEstimated || "",
    cookTimeActual: recipe.cookTimeEstimated || "",
    rating: recipe.rating || 0,
    notes: recipe.notes || "",
  });

  const cookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/recipes/${recipe.id}/cook`, {
        prepTimeActual: form.prepTimeActual ? Number(form.prepTimeActual) : null,
        cookTimeActual: form.cookTimeActual ? Number(form.cookTimeActual) : null,
        rating: form.rating || null,
        notes: form.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", recipe.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Marked as cooked!", description: "Great job cooking this recipe." });
      onClose();
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Mark as Cooked
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Actual Prep Time (min)</Label>
              <Input
                type="number"
                value={form.prepTimeActual}
                onChange={e => setForm(f => ({ ...f, prepTimeActual: e.target.value }))}
                data-testid="input-prep-actual"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Actual Cook Time (min)</Label>
              <Input
                type="number"
                value={form.cookTimeActual}
                onChange={e => setForm(f => ({ ...f, cookTimeActual: e.target.value }))}
                data-testid="input-cook-actual"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rating</Label>
            <StarRating rating={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="How did it go? Any tweaks?"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              data-testid="input-cook-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => cookMutation.mutate()} disabled={cookMutation.isPending} data-testid="button-confirm-cook">
            {cookMutation.isPending ? "Saving..." : "Mark as Cooked"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [cookMode, setCookMode] = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const { data: recipe, isLoading } = useQuery<RecipeWithDetails>({
    queryKey: ["/api/recipes", id],
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/recipes/${id}`, { isFavorite: !recipe?.isFavorite });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/recipes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      navigate("/recipes");
      toast({ title: "Recipe deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients(s => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleStep = (idx: number) => {
    setCheckedSteps(s => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Recipe not found</p>
          <Button variant="link" onClick={() => navigate("/recipes")}>Back to library</Button>
        </div>
      </div>
    );
  }

  const totalTime = (recipe.prepTimeEstimated || 0) + (recipe.cookTimeEstimated || 0);
  const sortedIngredients = [...(recipe.ingredients || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedSteps = [...(recipe.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber);

  if (cookMode) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="sticky top-0 z-50 border-b border-border bg-background px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg text-foreground truncate flex-1">{recipe.title}</h1>
          <Button size="sm" variant="outline" onClick={() => setCookMode(false)} data-testid="button-exit-cook-mode">
            <Minimize2 className="w-4 h-4 mr-1.5" />
            Exit Cook Mode
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">Ingredients</h2>
            <div className="flex flex-col gap-3">
              {sortedIngredients.map((ing, i) => (
                <div key={ing.id} className="flex items-start gap-3" onClick={() => toggleIngredient(i)}>
                  <Checkbox checked={checkedIngredients.has(i)} className="mt-0.5 flex-shrink-0" />
                  <span className={`text-lg leading-relaxed ${checkedIngredients.has(i) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {formatQty(ing.quantity) ? `${formatQty(ing.quantity)}${ing.unit ? ` ${ing.unit}` : ""} ` : ""}{ing.name}{ing.preparation ? `, ${ing.preparation}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4">Steps</h2>
            <div className="flex flex-col gap-6">
              {sortedSteps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-4" onClick={() => toggleStep(i)}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors ${checkedSteps.has(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {checkedSteps.has(i) ? <Check className="w-4 h-4" /> : step.stepNumber}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`text-xl leading-relaxed ${checkedSteps.has(i) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {step.instruction}
                    </p>
                    {step.durationMinutes && (
                      <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                        <Timer className="w-4 h-4" />
                        <span className="text-base">{step.durationMinutes} min</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="icon" variant="ghost" onClick={() => navigate("/recipes")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-bold text-foreground truncate">{recipe.title}</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="icon" variant="ghost" onClick={() => favoriteMutation.mutate()} data-testid="button-favorite">
            <Heart className={`w-4 h-4 ${recipe.isFavorite ? "fill-red-400 text-red-400" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCookMode(true)} data-testid="button-cook-mode">
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Cook Mode
          </Button>
          <Button size="sm" onClick={() => setShowCookModal(true)} data-testid="button-cook-this">
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Cook This
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-6 max-w-2xl">
          {recipe.description && (
            <p className="text-muted-foreground leading-relaxed">{recipe.description}</p>
          )}

          <div className="flex flex-wrap gap-4">
            {recipe.prepTimeEstimated && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Prep:</span>
                <span className="font-medium">{recipe.prepTimeEstimated}m</span>
              </div>
            )}
            {recipe.cookTimeEstimated && (
              <div className="flex items-center gap-1.5 text-sm">
                <ChefHat className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cook:</span>
                <span className="font-medium">{recipe.cookTimeEstimated}m</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">{totalTime}m</span>
              </div>
            )}
            {recipe.servingsBase && (
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{recipe.servingsBase} servings</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {recipe.rating && <StarRating rating={recipe.rating} />}
            {(recipe.cookedCount || 0) > 0 && (
              <Badge variant="secondary">Cooked {recipe.cookedCount}x</Badge>
            )}
            {recipe.kidFriendly && <Badge variant="outline">Kid-Friendly</Badge>}
            {recipe.isFavorite && <Badge variant="outline" className="text-red-500 border-red-200">Favorite</Badge>}
            {recipe.tags?.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>

          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
              View original recipe
            </a>
          )}

          {recipe.kidModificationNotes && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Kid-Friendly Tips</p>
              <p className="text-sm text-blue-800 dark:text-blue-300">{recipe.kidModificationNotes}</p>
            </div>
          )}

          {sortedIngredients.length > 0 && (
            <div>
              <h2 className="font-semibold text-foreground mb-3">Ingredients</h2>
              <div className="flex flex-col gap-2">
                {sortedIngredients.map((ing, i) => (
                  <div key={ing.id} className="flex items-start gap-3 py-1">
                    <Checkbox
                      checked={checkedIngredients.has(i)}
                      onCheckedChange={() => toggleIngredient(i)}
                      id={`ing-${i}`}
                      data-testid={`ingredient-check-${i}`}
                    />
                    <label htmlFor={`ing-${i}`} className={`text-sm cursor-pointer ${checkedIngredients.has(i) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {formatQty(ing.quantity) ? (
                        <span className="font-medium">{formatQty(ing.quantity)}{ing.unit ? ` ${ing.unit}` : ""} </span>
                      ) : null}
                      {ing.name}
                      {ing.preparation && <span className="text-muted-foreground">, {ing.preparation}</span>}
                      {ing.isPantryStaple && <span className="text-xs text-muted-foreground ml-1">(staple)</span>}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortedSteps.length > 0 && (
            <div>
              <h2 className="font-semibold text-foreground mb-3">Instructions</h2>
              <div className="flex flex-col gap-4">
                {sortedSteps.map((step, i) => (
                  <div key={step.id} className="flex gap-4" onClick={() => toggleStep(i)}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold cursor-pointer transition-colors mt-0.5 ${checkedSteps.has(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {checkedSteps.has(i) ? <Check className="w-3.5 h-3.5" /> : step.stepNumber}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm leading-relaxed ${checkedSteps.has(i) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {step.instruction}
                      </p>
                      {step.durationMinutes && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                          <Timer className="w-3 h-3" />
                          {step.durationMinutes} min
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recipe.notes && (
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{recipe.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => navigate(`/add-recipe?edit=${recipe.id}`)} data-testid="button-edit-recipe">
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/20" onClick={() => {
              if (confirm("Delete this recipe?")) deleteMutation.mutate();
            }} data-testid="button-delete-recipe">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {showCookModal && recipe && (
        <CookModal recipe={recipe} open={showCookModal} onClose={() => setShowCookModal(false)} />
      )}
    </div>
  );
}
