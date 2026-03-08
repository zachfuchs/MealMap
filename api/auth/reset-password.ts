import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const row = await storage.getResetToken(token);
    if (!row) return res.status(400).json({ error: "Invalid or expired reset link" });
    if (row.usedAt) return res.status(400).json({ error: "This reset link has already been used" });
    if (new Date() > row.expiresAt) return res.status(400).json({ error: "This reset link has expired" });

    const passwordHash = await bcrypt.hash(password, 10);
    await storage.updateUser(row.userId, { passwordHash });
    await storage.markResetTokenUsed(row.id);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  }
}
