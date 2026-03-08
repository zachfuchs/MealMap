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
  if (req.method === "GET") {
    const auth = await requireAdmin(req, res);
    if (!auth) return;
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id, email: u.email, displayName: u.displayName,
        householdId: u.householdId, role: u.role, createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  } else if (req.method === "POST") {
    const auth = await requireAdmin(req, res);
    if (!auth) return;
    try {
      const { email, password, displayName, householdName, inviteCode, role } = req.body;
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: "Email, password, and display name are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ error: "Email already in use" });

      const passwordHash = await bcrypt.hash(password, 10);
      let householdId: string;

      if (inviteCode) {
        const household = await storage.getHouseholdByInviteCode(inviteCode.trim().toUpperCase());
        if (!household) return res.status(404).json({ error: "Invalid invite code" });
        householdId = household.id;
      } else if (householdName) {
        const household = await storage.createHousehold({ name: householdName });
        householdId = household.id;
      } else {
        return res.status(400).json({ error: "Either household name or invite code is required" });
      }

      const user = await storage.createUser({
        email, passwordHash, displayName, householdId,
        role: role === "admin" ? "admin" : "user",
      });
      res.status(201).json({
        id: user.id, email: user.email, displayName: user.displayName,
        householdId: user.householdId, role: user.role, createdAt: user.createdAt,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create user" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
