import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    await storage.deleteMealPlanEntry(parseInt(req.query.id as string));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}
