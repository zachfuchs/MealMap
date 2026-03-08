import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(403).json({ error: "Self-registration is disabled. Contact your admin to create an account." });
}
