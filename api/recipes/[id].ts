import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;
  const id = req.query.id as string;

  if (req.method === "GET") {
    try {
      const recipe = await storage.getRecipe(id);
      if (!recipe || recipe.householdId !== auth.householdId) return res.status(404).json({ error: "Recipe not found" });
      const ings = await storage.getIngredientsByRecipe(recipe.id);
      const steps = await storage.getStepsByRecipe(recipe.id);
      res.json({ ...recipe, ingredients: ings, steps });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "PATCH") {
    try {
      const recipe = await storage.getRecipe(id);
      if (!recipe || recipe.householdId !== auth.householdId) return res.status(404).json({ error: "Recipe not found" });

      const { ingredients: ings, steps, ...recipeData } = req.body;
      const updated = await storage.updateRecipe(id, recipeData);

      if (ings !== undefined) {
        await storage.deleteIngredientsByRecipe(recipe.id);
        if (ings.length > 0) {
          await storage.bulkCreateIngredients(ings.map((ing: any, i: number) => ({
            recipeId: recipe.id,
            name: ing.name?.toLowerCase() || "",
            quantity: ing.quantity ? String(ing.quantity) : null,
            unit: ing.unit || null,
            preparation: ing.preparation || null,
            category: ing.category || "other",
            isPantryStaple: ing.isPantryStaple || false,
            sortOrder: i,
          })));
        }
      }

      if (steps !== undefined) {
        await storage.deleteStepsByRecipe(recipe.id);
        if (steps.length > 0) {
          await storage.bulkCreateSteps(steps.map((s: any, i: number) => ({
            recipeId: recipe.id,
            stepNumber: s.stepNumber || i + 1,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes || null,
          })));
        }
      }

      const finalIngredients = await storage.getIngredientsByRecipe(recipe.id);
      const finalSteps = await storage.getStepsByRecipe(recipe.id);
      res.json({ ...updated, ingredients: finalIngredients, steps: finalSteps });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update recipe" });
    }
  } else if (req.method === "DELETE") {
    try {
      const recipe = await storage.getRecipe(id);
      if (!recipe || recipe.householdId !== auth.householdId) return res.status(404).json({ error: "Recipe not found" });
      await storage.deleteRecipe(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
