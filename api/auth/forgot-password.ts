import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (!user) return res.json({ message: "If that email exists, a reset link has been generated." });

    await storage.deleteExpiredResetTokens();

    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await storage.createResetToken(user.id, token, expiresAt);

    res.json({ token, message: "Reset token generated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate reset token" });
  }
}
