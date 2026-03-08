import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;
  const id = parseInt(req.query.id as string);

  if (req.method === "PATCH") {
    try {
      const item = await storage.getPantryItem(id);
      if (!item || item.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
      const updated = await storage.updatePantryItem(id, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "DELETE") {
    try {
      const item = await storage.getPantryItem(id);
      if (!item || item.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
      await storage.deletePantryItem(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
