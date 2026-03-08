import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { items } = req.body;
    const created = await Promise.all(items.map((item: any) =>
      storage.createPantryItem({ ...item, householdId: auth.householdId })
    ));
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}
