import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  const user = await storage.getUserById(auth.userId);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  try {
    const allUsers = await storage.getAllUsers();
    const householdIds = [...new Set(allUsers.map(u => u.householdId).filter(Boolean))];
    const households = await Promise.all(householdIds.map(id => storage.getHousehold(id!)));
    res.json(households.filter(Boolean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch households" });
  }
}
