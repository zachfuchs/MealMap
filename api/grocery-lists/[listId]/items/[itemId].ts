import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../../_lib/auth";
import { storage } from "../../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;
  const itemId = parseInt(req.query.itemId as string);

  if (req.method === "PATCH") {
    try {
      const updated = await storage.updateGroceryListItem(itemId, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "DELETE") {
    try {
      await storage.deleteGroceryListItem(itemId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
