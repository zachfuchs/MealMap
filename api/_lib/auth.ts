import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "mealmap-secret-2024";

export interface AuthContext {
  userId: string;
  householdId: string;
}

export function authenticate(req: VercelRequest, res: VercelResponse): AuthContext | null {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthContext;
    return decoded;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
}

export function signToken(userId: string, householdId: string): string {
  return jwt.sign({ userId, householdId }, JWT_SECRET, { expiresIn: "30d" });
}
