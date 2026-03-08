import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { weekStart } = req.body;
    const plan = await storage.getMealPlanByWeek(auth.householdId, weekStart);
    if (!plan) return res.status(404).json({ error: "No meal plan for this week" });

    const entries = await storage.getMealPlanEntries(plan.id);
    const pantry = await storage.getPantryItems(auth.householdId);

    const ingredientMap = new Map<string, { quantity: number; unit: string; category: string; recipes: string[] }>();

    for (const entry of entries) {
      if (!entry.recipeId) continue;
      const recipe = await storage.getRecipe(entry.recipeId);
      if (!recipe) continue;
      const ings = await storage.getIngredientsByRecipe(entry.recipeId);
      const servings = entry.servingsOverride || recipe.servingsBase || 1;
      const ratio = servings / (recipe.servingsBase || 1);

      for (const ing of ings) {
        if (ing.isPantryStaple) continue;
        const key = `${ing.name.toLowerCase()}__${ing.unit || ""}`;
        const qty = parseFloat(ing.quantity || "0") * ratio;
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          existing.quantity += qty;
          if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
        } else {
          ingredientMap.set(key, { quantity: qty, unit: ing.unit || "", category: ing.category || "other", recipes: [recipe.title] });
        }
      }
    }

    const existingList = await storage.getGroceryListByMealPlan(plan.id);
    if (existingList) {
      await storage.deleteGroceryListItems(existingList.id);
      await storage.deleteGroceryList(existingList.id);
    }

    const list = await storage.createGroceryList({ householdId: auth.householdId, mealPlanId: plan.id, status: "draft" });

    const itemsToCreate = Array.from(ingredientMap.entries()).map(([key, val]) => {
      const name = key.split("__")[0];
      const matchedPantryItem = pantry.find(p =>
        p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase())
      );
      const isPantryCovered = !!matchedPantryItem;
      return {
        groceryListId: list.id,
        ingredientName: name,
        totalQuantity: val.quantity > 0 ? String(Math.round(val.quantity * 100) / 100) : null,
        unit: val.unit || null,
        category: val.category as any,
        sourceRecipes: val.recipes,
        isChecked: false,
        isPantryCovered,
        manuallyAdded: false,
        notes: matchedPantryItem ? matchedPantryItem.location : null,
      };
    });

    const items = await storage.bulkCreateGroceryListItems(itemsToCreate);
    res.status(201).json({ ...list, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate grocery list" });
  }
}
