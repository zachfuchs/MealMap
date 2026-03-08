import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const items = await storage.getPantryItems(auth.householdId);
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (req.method === "POST") {
    try {
      const item = await storage.createPantryItem({ ...req.body, householdId: auth.householdId });
      res.status(201).json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
