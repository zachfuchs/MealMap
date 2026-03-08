import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate } from "../_lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseClaudeJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not find JSON in AI response");
    return JSON.parse(match[0]);
  }
}

const RECIPE_GENERATE_PROMPT = `You are a home cook's recipe assistant. Generate a recipe based on the user's request. Prioritize practical weeknight cooking — realistic prep times, common equipment, ingredients available at a standard grocery store. If the user specifies ingredients to include, feature them prominently. If they specify dietary constraints, respect them strictly.

Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "description": "string (1-2 sentences)",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "ingredients": [{"name": "string","quantity": number,"unit": "string","preparation": "string","category": "string (produce/meat_seafood/dairy/bakery/frozen/canned_jarred/grains_pasta/condiments_sauces/spices/snacks/beverages/other)"}],
  "steps": [{"step_number": number,"instruction": "string","duration_minutes": number}],
  "suggested_tags": ["string"],
  "kid_friendly_guess": boolean,
  "kid_modification_suggestion": "string"
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  try {
    const { prompt, pantryContext } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    let fullPrompt = prompt;
    if (pantryContext) {
      fullPrompt += `\n\nThe household currently has these items in their pantry/fridge: ${pantryContext}. Try to incorporate these where appropriate.`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: RECIPE_GENERATE_PROMPT,
      messages: [{ role: "user", content: fullPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("No response");
    res.json(parseClaudeJson(content.text));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
}
