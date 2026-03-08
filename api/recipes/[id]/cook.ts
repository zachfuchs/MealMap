import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  const id = req.query.id as string;
  try {
    const recipe = await storage.getRecipe(id);
    if (!recipe || recipe.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
    const { prepTimeActual, cookTimeActual, rating, notes } = req.body;
    const updated = await storage.updateRecipe(id, {
      cooked: true,
      cookedCount: (recipe.cookedCount || 0) + 1,
      lastCookedAt: new Date(),
      ...(prepTimeActual != null && { prepTimeActual }),
      ...(cookTimeActual != null && { cookTimeActual }),
      ...(rating != null && { rating }),
      ...(notes != null && { notes }),
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}
