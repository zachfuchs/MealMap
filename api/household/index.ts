import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    if (!auth.householdId) return res.status(404).json({ error: "No household" });
    const household = await storage.getHousehold(auth.householdId);
    const members = await storage.getHouseholdMembers(auth.householdId);
    res.json({ ...household, members: members.map(m => ({ id: m.id, email: m.email, displayName: m.displayName })) });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}
