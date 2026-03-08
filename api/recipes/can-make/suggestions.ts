import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const allRecipes = await storage.getRecipesByHousehold(auth.householdId);
    const pantry = await storage.getPantryItems(auth.householdId);
    const pantryNames = pantry.map(p => p.name.toLowerCase());

    const suggestions = await Promise.all(allRecipes.map(async (recipe) => {
      const ings = await storage.getIngredientsByRecipe(recipe.id);
      const nonStaple = ings.filter(i => !i.isPantryStaple);
      const have = nonStaple.filter(i => pantryNames.some(p => p.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(p)));
      const missing = nonStaple.filter(i => !pantryNames.some(p => p.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(p)));
      const pct = nonStaple.length > 0 ? Math.round((have.length / nonStaple.length) * 100) : 100;
      return { recipe, percentHave: pct, missingCount: missing.length, missingIngredients: missing.map(m => m.name) };
    }));

    suggestions.sort((a, b) => b.percentHave - a.percentHave);
    res.json(suggestions.slice(0, 10));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
}
