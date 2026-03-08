import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const user = await storage.getUserById(auth.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const household = user.householdId ? await storage.getHousehold(user.householdId) : null;
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role }, household });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
}
