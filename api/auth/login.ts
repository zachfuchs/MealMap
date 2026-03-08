import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { storage } from "../_lib/storage";
import { signToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user.id, user.householdId ?? "");
    const household = user.householdId ? await storage.getHousehold(user.householdId) : null;
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role }, household });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
}
