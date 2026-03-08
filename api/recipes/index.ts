import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const { q } = req.query;
      const recipeList = q
        ? await storage.searchRecipes(auth.householdId, q as string)
        : await storage.getRecipesByHousehold(auth.householdId);
      res.json(recipeList);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  } else if (req.method === "POST") {
    try {
      const { ingredients: ings, steps, ...recipeData } = req.body;
      const recipe = await storage.createRecipe({
        ...recipeData,
        householdId: auth.householdId,
        createdBy: auth.userId,
      });

      let savedIngredients: any[] = [];
      let savedSteps: any[] = [];

      if (ings && ings.length > 0) {
        const ingData = ings.map((ing: any, i: number) => ({
          recipeId: recipe.id,
          name: ing.name?.toLowerCase() || "",
          quantity: ing.quantity ? String(ing.quantity) : null,
          unit: ing.unit || null,
          preparation: ing.preparation || null,
          category: ing.category || "other",
          isPantryStaple: ing.isPantryStaple || false,
          sortOrder: i,
        }));
        savedIngredients = await storage.bulkCreateIngredients(ingData);
      }

      if (steps && steps.length > 0) {
        const stepData = steps.map((s: any, i: number) => ({
          recipeId: recipe.id,
          stepNumber: s.stepNumber || i + 1,
          instruction: s.instruction,
          durationMinutes: s.durationMinutes || null,
        }));
        savedSteps = await storage.bulkCreateSteps(stepData);
      }

      res.status(201).json({ ...recipe, ingredients: savedIngredients, steps: savedSteps });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
