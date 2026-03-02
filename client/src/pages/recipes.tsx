import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";
import {
  Search, Plus, Star, Clock, Heart, ChefHat, Filter,
  SlidersHorizontal, Sparkles, BookOpen, X
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  quick: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  vegetarian: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "kid-friendly": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "high-protein": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "meal-prep": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  weeknight: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "date-night": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "md" }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex gap-0.5">
      {stars.map(s => (
        <Star key={s} className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"} ${s <= (rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [, navigate] = useLocation();
  const totalTime = (recipe.prepTimeEstimated || 0) + (recipe.cookTimeEstimated || 0);

  const tagColor = (tag: string) => CATEGORY_COLORS[tag] || "bg-secondary text-secondary-foreground";

  return (
    <div
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      className="bg-card border border-card-border rounded-lg p-4 cursor-pointer hover-elevate flex flex-col gap-3"
      data-testid={`card-recipe-${recipe.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{recipe.title}</h3>
          {recipe.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{recipe.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {recipe.isFavorite && <Heart className="w-4 h-4 fill-red-400 text-red-400" />}
          {recipe.kidFriendly && <span className="text-xs" title="Kid-friendly">&#x1F476;</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {recipe.tags?.slice(0, 3).map(tag => (
          <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${tagColor(tag)}`}>{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <div className="flex items-center gap-3">
          <StarRating rating={recipe.rating} />
          {totalTime > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {totalTime}m
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(recipe.cookedCount || 0) > 0 && (
            <span className="text-xs text-muted-foreground">Cooked {recipe.cookedCount}x</span>
          )}
          <Badge variant="secondary" className="text-xs">
            {recipe.sourceType === "imported" ? "Imported" : recipe.sourceType === "generated" ? "AI" : "Manual"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function CanMakeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/recipes/can-make/suggestions"],
    enabled: open,
  });
  const [, navigate] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            What Can I Make?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">Recipes ranked by ingredients you already have</p>

        {isLoading ? (
          <div className="flex flex-col gap-3 mt-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        ) : data?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Add pantry items to get suggestions
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {data?.map((s: any) => (
              <div
                key={s.recipe.id}
                onClick={() => { onClose(); navigate(`/recipes/${s.recipe.id}`); }}
                className="flex items-center gap-3 p-3 rounded-md border border-border hover-elevate cursor-pointer"
                data-testid={`can-make-${s.recipe.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{s.recipe.title}</p>
                  {s.missingCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Missing: {s.missingIngredients.slice(0, 3).join(", ")}{s.missingCount > 3 ? ` +${s.missingCount - 3} more` : ""}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`text-sm font-bold ${s.percentHave >= 80 ? "text-green-600 dark:text-green-400" : s.percentHave >= 50 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {s.percentHave}%
                  </div>
                  <div className="text-xs text-muted-foreground">have</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function RecipesPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFav, setFilterFav] = useState(false);
  const [filterKid, setFilterKid] = useState(false);
  const [showCanMake, setShowCanMake] = useState(false);
  const [, navigate] = useLocation();

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach(r => r.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [recipes]);

  const filtered = useMemo(() => {
    let list = [...recipes];
    if (search) list = list.filter(r =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );
    if (filterTag) list = list.filter(r => r.tags?.includes(filterTag));
    if (filterFav) list = list.filter(r => r.isFavorite);
    if (filterKid) list = list.filter(r => r.kidFriendly);

    if (sortBy === "newest") list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "most-cooked") list.sort((a, b) => (b.cookedCount || 0) - (a.cookedCount || 0));
    else if (sortBy === "highest-rated") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "fastest") list.sort((a, b) => ((a.prepTimeEstimated || 0) + (a.cookTimeEstimated || 0)) - ((b.prepTimeEstimated || 0) + (b.cookTimeEstimated || 0)));
    else if (sortBy === "alphabetical") list.sort((a, b) => a.title.localeCompare(b.title));

    return list;
  }, [recipes, search, filterTag, filterFav, filterKid, sortBy]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bold text-foreground">Recipe Library</h1>
          <p className="text-xs text-muted-foreground">{recipes.length} recipe{recipes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowCanMake(true)} data-testid="button-can-make">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            What Can I Make?
          </Button>
          <Button size="sm" onClick={() => navigate("/add-recipe")} data-testid="button-add-recipe">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Recipe
          </Button>
        </div>
      </div>

      <div className="border-b border-border bg-background px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-recipes"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-sort">
            <SlidersHorizontal className="w-3 h-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most-cooked">Most Cooked</SelectItem>
            <SelectItem value="highest-rated">Highest Rated</SelectItem>
            <SelectItem value="fastest">Fastest</SelectItem>
            <SelectItem value="alphabetical">A–Z</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant={filterFav ? "default" : "outline"}
          className="h-8 text-xs px-2.5"
          onClick={() => setFilterFav(f => !f)}
          data-testid="button-filter-favorites"
        >
          <Heart className="w-3 h-3 mr-1" />
          Favorites
        </Button>
        <Button
          size="sm"
          variant={filterKid ? "default" : "outline"}
          className="h-8 text-xs px-2.5"
          onClick={() => setFilterKid(f => !f)}
          data-testid="button-filter-kid"
        >
          Kid-Friendly
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-background flex gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filterTag === tag ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              data-testid={`tag-filter-${tag}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {search || filterTag || filterFav || filterKid ? "No matching recipes" : "No recipes yet"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search || filterTag || filterFav || filterKid
                  ? "Try adjusting your filters"
                  : "Add your first recipe to get started"
                }
              </p>
            </div>
            {!search && !filterTag && !filterFav && !filterKid && (
              <Button onClick={() => navigate("/add-recipe")} data-testid="button-add-first-recipe">
                <Plus className="w-4 h-4 mr-2" />
                Add Recipe
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
          </div>
        )}
      </div>

      <CanMakeDialog open={showCanMake} onClose={() => setShowCanMake(false)} />
    </div>
  );
}
