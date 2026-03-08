import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const lists = await storage.getGroceryListsByHousehold(auth.householdId);
      res.json(lists);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "POST") {
    try {
      const { name } = req.body;
      const list = await storage.createGroceryList({
        householdId: auth.householdId,
        mealPlanId: null,
        name: name || "My grocery list",
        weekStart: null,
      });
      const items = await storage.getGroceryListItems(list.id);
      res.status(201).json({ ...list, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create grocery list" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
