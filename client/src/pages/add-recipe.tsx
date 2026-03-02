import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, Link, Sparkles, PenLine, RefreshCw,
  Loader2, ChevronUp, ChevronDown, X, Save, Star
} from "lucide-react";
import type { Recipe } from "@shared/schema";

const INGREDIENT_CATEGORIES = [
  "produce", "meat_seafood", "dairy", "bakery", "frozen",
  "canned_jarred", "grains_pasta", "condiments_sauces", "spices", "snacks", "beverages", "other"
];

const COMMON_TAGS = ["quick", "vegetarian", "vegan", "kid-friendly", "high-protein", "meal-prep", "weeknight", "date-night", "gluten-free", "dairy-free", "comfort-food", "healthy"];

interface IngredientRow {
  name: string; quantity: string; unit: string; preparation: string; category: string; isPantryStaple: boolean;
}

interface StepRow {
  instruction: string; durationMinutes: string;
}

function IngredientRowComp({ ing, index, onChange, onRemove, onMove }: {
  ing: IngredientRow; index: number;
  onChange: (i: number, field: string, val: any) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: "up" | "down") => void;
}) {
  return (
    <div className="flex gap-2 items-start">
      <div className="flex flex-col gap-0.5 mt-2">
        <button type="button" onClick={() => onMove(index, "up")} className="text-muted-foreground">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onMove(index, "down")} className="text-muted-foreground">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 grid grid-cols-12 gap-2">
        <Input
          className="col-span-4 text-sm h-8"
          placeholder="Ingredient name"
          value={ing.name}
          onChange={e => onChange(index, "name", e.target.value)}
          data-testid={`input-ingredient-name-${index}`}
        />
        <Input
          className="col-span-2 text-sm h-8"
          placeholder="Qty"
          value={ing.quantity}
          onChange={e => onChange(index, "quantity", e.target.value)}
          data-testid={`input-ingredient-qty-${index}`}
        />
        <Input
          className="col-span-2 text-sm h-8"
          placeholder="Unit"
          value={ing.unit}
          onChange={e => onChange(index, "unit", e.target.value)}
          data-testid={`input-ingredient-unit-${index}`}
        />
        <Select value={ing.category} onValueChange={v => onChange(index, "category", v)}>
          <SelectTrigger className="col-span-4 text-xs h-8">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {INGREDIENT_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="mt-0.5 flex-shrink-0 text-muted-foreground"
        onClick={() => onRemove(index)}
        data-testid={`button-remove-ingredient-${index}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

const emptyIngredient = (): IngredientRow => ({ name: "", quantity: "", unit: "", preparation: "", category: "other", isPantryStaple: false });
const emptyStep = (): StepRow => ({ instruction: "", durationMinutes: "" });

function RecipeForm({ initialData, onSave, editId }: {
  initialData?: any;
  onSave: (data: any) => void;
  editId?: string;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [servings, setServings] = useState(String(initialData?.servings || initialData?.servingsBase || 4));
  const [prepTime, setPrepTime] = useState(String(initialData?.prep_time_minutes || initialData?.prepTimeEstimated || ""));
  const [cookTime, setCookTime] = useState(String(initialData?.cook_time_minutes || initialData?.cookTimeEstimated || ""));
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [kidFriendly, setKidFriendly] = useState(initialData?.kidFriendly || initialData?.kid_friendly_guess || false);
  const [kidNotes, setKidNotes] = useState(initialData?.kidModificationNotes || initialData?.kid_modification_suggestion || "");
  const [rating, setRating] = useState(initialData?.rating || 0);
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl || "");
  const [tags, setTags] = useState<string[]>(initialData?.tags || initialData?.suggested_tags || []);
  const [tagInput, setTagInput] = useState("");

  const [ings, setIngs] = useState<IngredientRow[]>(
    (initialData?.ingredients || []).length > 0
      ? (initialData.ingredients || []).map((ing: any) => ({
          name: ing.name || "",
          quantity: ing.quantity ? String(ing.quantity) : "",
          unit: ing.unit || "",
          preparation: ing.preparation || "",
          category: ing.category || "other",
          isPantryStaple: ing.isPantryStaple || false,
        }))
      : [emptyIngredient()]
  );

  const [steps, setSteps] = useState<StepRow[]>(
    (initialData?.steps || []).length > 0
      ? (initialData.steps || []).map((s: any) => ({
          instruction: s.instruction || "",
          durationMinutes: s.durationMinutes ? String(s.durationMinutes) : "",
        }))
      : [emptyStep()]
  );

  const updateIng = (i: number, field: string, val: any) => {
    setIngs(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  };
  const removeIng = (i: number) => setIngs(prev => prev.filter((_, idx) => idx !== i));
  const moveIng = (i: number, dir: "up" | "down") => {
    setIngs(prev => {
      const next = [...prev];
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput("");
  };

  const handleSubmit = (sourceType: "manual" | "imported" | "generated") => {
    onSave({
      title,
      description,
      servingsBase: Number(servings) || 4,
      prepTimeEstimated: prepTime ? Number(prepTime) : null,
      cookTimeEstimated: cookTime ? Number(cookTime) : null,
      notes: notes || null,
      kidFriendly,
      kidModificationNotes: kidNotes || null,
      rating: rating || null,
      sourceUrl: sourceUrl || null,
      sourceType,
      tags,
      isFavorite: false,
      ingredients: ings.filter(i => i.name.trim()).map((ing, idx) => ({
        name: ing.name.toLowerCase().trim(),
        quantity: ing.quantity ? parseFloat(ing.quantity) : null,
        unit: ing.unit || null,
        preparation: ing.preparation || null,
        category: ing.category,
        isPantryStaple: ing.isPantryStaple,
        sortOrder: idx,
      })),
      steps: steps.filter(s => s.instruction.trim()).map((s, idx) => ({
        stepNumber: idx + 1,
        instruction: s.instruction,
        durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : null,
      })),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Recipe name" data-testid="input-recipe-title" required />
        </div>
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." rows={2} data-testid="input-recipe-description" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Servings</Label>
          <Input type="number" value={servings} onChange={e => setServings(e.target.value)} min="1" data-testid="input-recipe-servings" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Source URL (optional)</Label>
          <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." data-testid="input-recipe-url" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Prep Time (min)</Label>
          <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="15" data-testid="input-prep-time" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Cook Time (min)</Label>
          <Input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="30" data-testid="input-cook-time" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COMMON_TAGS.map(tag => (
            <button
              type="button"
              key={tag}
              onClick={() => tags.includes(tag) ? setTags(prev => prev.filter(t => t !== tag)) : addTag(tag)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              data-testid={`tag-btn-${tag}`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag(tagInput))}
            placeholder="Add custom tag..."
            className="h-8 text-sm"
            data-testid="input-custom-tag"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => addTag(tagInput)}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Ingredients</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setIngs(prev => [...prev, emptyIngredient()])} data-testid="button-add-ingredient">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {ings.map((ing, i) => (
            <IngredientRowComp key={i} ing={ing} index={i} onChange={updateIng} onRemove={removeIng} onMove={moveIng} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Steps</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setSteps(prev => [...prev, emptyStep()])} data-testid="button-add-step">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground mt-2 flex-shrink-0">{i + 1}</div>
              <div className="flex-1 flex flex-col gap-1">
                <Textarea
                  value={step.instruction}
                  onChange={e => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, instruction: e.target.value } : s))}
                  placeholder="Describe this step..."
                  rows={2}
                  className="text-sm"
                  data-testid={`input-step-${i}`}
                />
                <Input
                  type="number"
                  value={step.durationMinutes}
                  onChange={e => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, durationMinutes: e.target.value } : s))}
                  placeholder="Duration (min, optional)"
                  className="h-7 text-xs"
                />
              </div>
              <Button type="button" size="icon" variant="ghost" className="mt-1.5 flex-shrink-0" onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Rating</Label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => (
              <button type="button" key={s} onClick={() => setRating(s)}>
                <Star className={`w-5 h-5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={kidFriendly} onCheckedChange={setKidFriendly} id="kid-friendly" data-testid="switch-kid-friendly" />
          <Label htmlFor="kid-friendly">Kid-Friendly</Label>
        </div>
        {kidFriendly && (
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label>Kid Modification Notes</Label>
            <Textarea value={kidNotes} onChange={e => setKidNotes(e.target.value)} placeholder="e.g., Serve deconstructed, skip the spicy sauce" rows={2} data-testid="input-kid-notes" />
          </div>
        )}
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tips, variations, storage notes..." rows={3} data-testid="input-notes" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          className="flex-1"
          onClick={() => handleSubmit(editId ? "manual" : "manual")}
          data-testid="button-save-recipe"
        >
          <Save className="w-4 h-4 mr-2" />
          {editId ? "Update Recipe" : "Save Recipe"}
        </Button>
      </div>
    </div>
  );
}

export default function AddRecipePage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const editId = params.get("edit") || undefined;
  const { toast } = useToast();

  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("url");

  const { data: existingRecipe } = useQuery<any>({
    queryKey: ["/api/recipes", editId],
    enabled: !!editId,
  });

  const { data: pantryItems = [] } = useQuery<any[]>({ queryKey: ["/api/pantry"], staleTime: 0, refetchOnMount: "always" });

  const importUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/import-url", { url: urlInput });
      return res.json();
    },
    onSuccess: (data) => setPreviewData(data),
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const importTextMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/import-text", { text: textInput });
      return res.json();
    },
    onSuccess: (data) => setPreviewData(data),
    onError: (err: Error) => toast({ title: "Parse failed", description: err.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const pantryContext = pantryItems.map((p: any) => p.name).join(", ");
      const res = await apiRequest("POST", "/api/ai/generate", { prompt: aiPrompt, pantryContext });
      return res.json();
    },
    onSuccess: (data) => setPreviewData(data),
    onError: (err: Error) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editId) {
        const res = await apiRequest("PATCH", `/api/recipes/${editId}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/recipes", data);
        return res.json();
      }
    },
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: editId ? "Recipe updated!" : "Recipe saved!" });
      navigate(`/recipes/${recipe.id}`);
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    const sourceType = previewData
      ? (activeTab === "url" ? "imported" : "generated")
      : (editId ? (existingRecipe?.sourceType || "manual") : "manual");
    saveMutation.mutate({ ...data, sourceType });
  };

  const initialData = previewData || (editId ? existingRecipe : undefined);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => navigate(editId ? `/recipes/${editId}` : "/recipes")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="font-bold text-foreground">{editId ? "Edit Recipe" : "Add Recipe"}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!editId ? (
          <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setPreviewData(null); }}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="url" className="flex-1 gap-1.5" data-testid="tab-import-url">
                <Link className="w-3.5 h-3.5" />
                Import URL
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1 gap-1.5" data-testid="tab-generate">
                <Sparkles className="w-3.5 h-3.5" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-1.5" data-testid="tab-manual">
                <PenLine className="w-3.5 h-3.5" />
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url">
              {!previewData ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="font-semibold mb-1">Import from URL</h2>
                    <p className="text-sm text-muted-foreground">Paste a recipe URL and we'll extract it using AI</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://www.seriouseats.com/recipe..."
                      data-testid="input-recipe-url"
                    />
                    <Button onClick={() => importUrlMutation.mutate()} disabled={!urlInput || importUrlMutation.isPending} data-testid="button-import-url">
                      {importUrlMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                      ) : (
                        "Import Recipe"
                      )}
                    </Button>
                  </div>
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or paste recipe text directly</span></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      placeholder="Paste recipe text here (useful if URL is behind a paywall)..."
                      rows={5}
                      data-testid="input-recipe-text"
                    />
                    <Button variant="outline" onClick={() => importTextMutation.mutate()} disabled={!textInput || importTextMutation.isPending} data-testid="button-parse-text">
                      {importTextMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsing...</> : "Parse Text"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Preview & Edit</h2>
                      <p className="text-xs text-muted-foreground">Review and adjust before saving</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPreviewData(null)} data-testid="button-reimport">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Re-import
                    </Button>
                  </div>
                  <RecipeForm initialData={{ ...previewData, sourceUrl: urlInput }} onSave={handleSave} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai">
              {!previewData ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="font-semibold mb-1">Generate with AI</h2>
                    <p className="text-sm text-muted-foreground">Describe what you want and we'll create a recipe</p>
                  </div>
                  <Textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g. Healthy quick taco recipe using black beans and cauliflower, 4 servings, kid-friendly"
                    rows={4}
                    data-testid="input-ai-prompt"
                  />
                  {pantryItems.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      We'll try to use your {pantryItems.length} pantry items where appropriate
                    </p>
                  )}
                  <Button onClick={() => generateMutation.mutate()} disabled={!aiPrompt || generateMutation.isPending} data-testid="button-generate">
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Generate Recipe</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Preview & Edit</h2>
                      <p className="text-xs text-muted-foreground">Review the generated recipe</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-regenerate">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Regenerate
                    </Button>
                  </div>
                  <RecipeForm initialData={previewData} onSave={handleSave} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual">
              <RecipeForm onSave={handleSave} />
            </TabsContent>
          </Tabs>
        ) : (
          existingRecipe ? (
            <RecipeForm initialData={existingRecipe} onSave={handleSave} editId={editId} />
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )
        )}
      </div>
    </div>
  );
}
