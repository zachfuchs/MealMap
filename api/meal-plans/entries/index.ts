import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { weekStart, date, mealSlot, recipeId, customMealText, servingsOverride, notes } = req.body;
    const plan = await storage.upsertMealPlan(auth.householdId, weekStart, auth.userId);

    await storage.deleteMealPlanEntriesBySlot(plan.id, date, mealSlot);

    if (!recipeId && !customMealText) {
      return res.json({ cleared: true });
    }

    const entry = await storage.createMealPlanEntry({
      mealPlanId: plan.id,
      date,
      mealSlot,
      recipeId: recipeId || null,
      customMealText: customMealText || null,
      servingsOverride: servingsOverride || null,
      notes: notes || null,
    });

    let recipe = null;
    if (recipeId) recipe = await storage.getRecipe(recipeId);
    res.status(201).json({ ...entry, recipe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
}
