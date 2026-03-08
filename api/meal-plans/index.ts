import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { weekStart } = req.query;
    if (weekStart) {
      const plan = await storage.getMealPlanByWeek(auth.householdId, weekStart as string);
      if (!plan) return res.json(null);
      const entries = await storage.getMealPlanEntries(plan.id);
      const enriched = await Promise.all(entries.map(async (e) => {
        if (e.recipeId) {
          const recipe = await storage.getRecipe(e.recipeId);
          return { ...e, recipe };
        }
        return e;
      }));
      return res.json({ ...plan, entries: enriched });
    }
    const plans = await storage.getMealPlansByHousehold(auth.householdId);
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
}
