import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { authenticate } from "../_lib/auth";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { displayName, password } = req.body;
    const updates: any = {};
    if (displayName) updates.displayName = displayName;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.updateUser(auth.userId, updates);
    res.json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId });
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
}
