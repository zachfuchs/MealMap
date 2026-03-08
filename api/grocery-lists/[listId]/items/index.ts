import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../../_lib/auth";
import { storage } from "../../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  const listId = req.query.listId as string;
  try {
    const list = await storage.getGroceryList(listId);
    if (!list || list.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
    const item = await storage.createGroceryListItem({ ...req.body, groceryListId: list.id, manuallyAdded: true });
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}
