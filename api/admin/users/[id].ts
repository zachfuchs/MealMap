import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const auth = authenticate(req, res);
  if (!auth) return null;
  const user = await storage.getUserById(auth.userId);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return auth;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const id = req.query.id as string;

  if (req.method === "PATCH") {
    try {
      const { displayName, password, role, householdId } = req.body;
      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (password) updates.passwordHash = await bcrypt.hash(password, 10);
      if (role === "admin" || role === "user") updates.role = role;
      if (householdId !== undefined) updates.householdId = householdId;
      const user = await storage.updateUser(id, updates);
      res.json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role, createdAt: user.createdAt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update user" });
    }
  } else if (req.method === "DELETE") {
    try {
      if (id === auth.userId) return res.status(400).json({ error: "You cannot delete your own account" });
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
