import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import * as cheerio from "cheerio";
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

const RECIPE_SYSTEM_PROMPT = `You are a recipe parser. Given raw text or HTML from a recipe webpage, extract the recipe into the following JSON structure. Be precise with quantities and units. Normalize ingredient names to lowercase. Categorize each ingredient into one of these categories: produce, meat_seafood, dairy, bakery, frozen, canned_jarred, grains_pasta, condiments_sauces, spices, snacks, beverages, other. If information is missing or ambiguous, use your best judgment.

Return ONLY valid JSON, no markdown fences, no preamble.

{
  "title": "string",
  "description": "string (1-2 sentences)",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "ingredients": [{"name": "string","quantity": number,"unit": "string","preparation": "string","category": "string"}],
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
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    let htmlContent = "";
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MealMap/1.0)" },
      });
      const $ = cheerio.load(response.data);
      $("script, style, nav, footer, header, aside, .advertisement, .ads").remove();
      htmlContent = $("body").text().replace(/\s+/g, " ").trim().substring(0, 8000);
    } catch {
      return res.status(422).json({ error: "Failed to fetch URL. Try pasting the recipe text manually." });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: RECIPE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Extract the recipe from this webpage content:\n\n${htmlContent}` }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("No text response");
    res.json(parseClaudeJson(content.text));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to import recipe" });
  }
}
