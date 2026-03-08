import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;
  const id = req.query.listId as string;

  if (req.method === "GET") {
    try {
      const list = await storage.getGroceryList(id);
      if (!list || list.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
      const items = await storage.getGroceryListItems(list.id);
      res.json({ ...list, items });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "PATCH") {
    try {
      const list = await storage.getGroceryList(id);
      if (!list || list.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
      const updated = await storage.updateGroceryList(id, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
