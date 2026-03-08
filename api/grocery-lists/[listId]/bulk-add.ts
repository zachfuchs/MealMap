import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseClaudeJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch {
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not find JSON in AI response");
    return JSON.parse(match[0]);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  const listId = req.query.listId as string;
  try {
    const list = await storage.getGroceryList(listId);
    if (!list || list.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });

    const VALID_CATEGORIES = ["produce", "meat_seafood", "dairy", "bakery", "frozen", "canned_jarred", "grains_pasta", "condiments_sauces", "spices", "snacks", "beverages", "other"];
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Categorize these grocery items and extract quantity/unit where present. Valid categories: produce, meat_seafood, dairy, bakery, frozen, canned_jarred, grains_pasta, condiments_sauces, spices, snacks, beverages, other\n\nItems:\n${items.join("\n")}\n\nReturn JSON array ONLY:\n[{"name":"clean name","category":"category","quantity":"number or null","unit":"unit or null"}]`,
      }],
    });
    const content = message.content[0];
    if (content.type !== "text") return res.status(500).json({ error: "AI error" });
    const parsed = parseClaudeJson(content.text);
    const created = await storage.bulkCreateGroceryListItems(
      parsed.map((item: any) => ({
        groceryListId: listId,
        ingredientName: item.name || "Unknown item",
        totalQuantity: item.quantity || null,
        unit: item.unit || null,
        category: VALID_CATEGORIES.includes(item.category) ? item.category as any : "other",
        sourceRecipes: [],
        isChecked: false,
        isPantryCovered: false,
        manuallyAdded: true,
        notes: null,
      }))
    );
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk add items" });
  }
}
