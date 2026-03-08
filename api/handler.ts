import { config } from "dotenv";
config({ path: ".env" });

import express, { type Request, type Response } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import * as cheerio from "cheerio";
import { storage } from "./_lib/storage";

const JWT_SECRET = process.env.SESSION_SECRET || "mealmap-secret-2024";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseClaudeJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch {
    const match = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("Could not find JSON in AI response");
    return JSON.parse(match[0]);
  }
}

const RECIPE_SYSTEM_PROMPT = `You are a recipe parser. Given raw text or HTML from a recipe webpage, extract the recipe into the following JSON structure. Be precise with quantities and units. Normalize ingredient names to lowercase. Categorize each ingredient into one of these categories: produce, meat_seafood, dairy, bakery, frozen, canned_jarred, grains_pasta, condiments_sauces, spices, snacks, beverages, other. If information is missing or ambiguous, use your best judgment.
Return ONLY valid JSON, no markdown fences, no preamble.
{"title":"string","description":"string","servings":4,"prep_time_minutes":0,"cook_time_minutes":0,"ingredients":[{"name":"string","quantity":null,"unit":null,"preparation":null,"category":"string"}],"steps":[{"step_number":1,"instruction":"string","duration_minutes":null}],"suggested_tags":["string"],"kid_friendly_guess":false,"kid_modification_suggestion":null}`;

const RECIPE_GENERATE_PROMPT = `You are a home cook's recipe assistant. Generate a recipe based on the user's request. Prioritize practical weeknight cooking.
Return ONLY valid JSON:
{"title":"string","description":"string","servings":4,"prep_time_minutes":0,"cook_time_minutes":0,"ingredients":[{"name":"string","quantity":null,"unit":null,"preparation":null,"category":"produce/meat_seafood/dairy/bakery/frozen/canned_jarred/grains_pasta/condiments_sauces/spices/snacks/beverages/other"}],"steps":[{"step_number":1,"instruction":"string","duration_minutes":null}],"suggested_tags":["string"],"kid_friendly_guess":false,"kid_modification_suggestion":null}`;

function authMiddleware(req: any, res: Response, next: Function) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; householdId: string };
    req.userId = decoded.userId;
    req.householdId = decoded.householdId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

async function adminMiddleware(req: any, res: Response, next: Function) {
  const user = await storage.getUserById(req.userId);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

const app = express();
app.use(express.json());

// ── Auth ────────────────────────────────────────────────────────────────────

app.post("/api/auth/register", (_req, res) => {
  res.status(403).json({ error: "Self-registration is disabled. Contact your admin." });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user.id, householdId: user.householdId }, JWT_SECRET, { expiresIn: "30d" });
    const household = user.householdId ? await storage.getHousehold(user.householdId) : null;
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role }, household });
  } catch (err) { console.error(err); res.status(500).json({ error: "Login failed" }); }
});

app.get("/api/auth/me", authMiddleware, async (req: any, res) => {
  try {
    const user = await storage.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const household = user.householdId ? await storage.getHousehold(user.householdId) : null;
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role }, household });
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/auth/forgot-password", async (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/auth/reset-password", async (req, res) => {
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
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/auth/profile", authMiddleware, async (req: any, res) => {
  try {
    const { displayName, password } = req.body;
    const updates: any = {};
    if (displayName) updates.displayName = displayName;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.updateUser(req.userId, updates);
    res.json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId });
  } catch { res.status(500).json({ error: "Update failed" }); }
});

// ── Household ───────────────────────────────────────────────────────────────

app.get("/api/household", authMiddleware, async (req: any, res) => {
  try {
    if (!req.householdId) return res.status(404).json({ error: "No household" });
    const household = await storage.getHousehold(req.householdId);
    const members = await storage.getHouseholdMembers(req.householdId);
    res.json({ ...household, members: members.map(m => ({ id: m.id, email: m.email, displayName: m.displayName })) });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── Recipes ─────────────────────────────────────────────────────────────────

app.get("/api/recipes/can-make/suggestions", authMiddleware, async (req: any, res) => {
  try {
    const allRecipes = await storage.getRecipesByHousehold(req.householdId);
    const pantry = await storage.getPantryItems(req.householdId);
    const pantryNames = pantry.map(p => p.name.toLowerCase());
    const suggestions = await Promise.all(allRecipes.map(async (recipe) => {
      const ings = await storage.getIngredientsByRecipe(recipe.id);
      const nonStaple = ings.filter(i => !i.isPantryStaple);
      const have = nonStaple.filter(i => pantryNames.some(p => p.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(p)));
      const missing = nonStaple.filter(i => !pantryNames.some(p => p.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(p)));
      const pct = nonStaple.length > 0 ? Math.round((have.length / nonStaple.length) * 100) : 100;
      return { recipe, percentHave: pct, missingCount: missing.length, missingIngredients: missing.map(m => m.name) };
    }));
    suggestions.sort((a, b) => b.percentHave - a.percentHave);
    res.json(suggestions.slice(0, 10));
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/api/recipes", authMiddleware, async (req: any, res) => {
  try {
    const { q } = req.query;
    const list = q ? await storage.searchRecipes(req.householdId, q as string) : await storage.getRecipesByHousehold(req.householdId);
    res.json(list);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/recipes", authMiddleware, async (req: any, res) => {
  try {
    const { ingredients: ings, steps, ...recipeData } = req.body;
    const recipe = await storage.createRecipe({ ...recipeData, householdId: req.householdId, createdBy: req.userId });
    let savedIngredients: any[] = [];
    let savedSteps: any[] = [];
    if (ings?.length) {
      savedIngredients = await storage.bulkCreateIngredients(ings.map((ing: any, i: number) => ({
        recipeId: recipe.id, name: ing.name?.toLowerCase() || "", quantity: ing.quantity ? String(ing.quantity) : null,
        unit: ing.unit || null, preparation: ing.preparation || null, category: ing.category || "other",
        isPantryStaple: ing.isPantryStaple || false, sortOrder: i,
      })));
    }
    if (steps?.length) {
      savedSteps = await storage.bulkCreateSteps(steps.map((s: any, i: number) => ({
        recipeId: recipe.id, stepNumber: s.stepNumber || i + 1, instruction: s.instruction, durationMinutes: s.durationMinutes || null,
      })));
    }
    res.status(201).json({ ...recipe, ingredients: savedIngredients, steps: savedSteps });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create recipe" }); }
});

app.get("/api/recipes/:id", authMiddleware, async (req: any, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    const ings = await storage.getIngredientsByRecipe(recipe.id);
    const steps = await storage.getStepsByRecipe(recipe.id);
    res.json({ ...recipe, ingredients: ings, steps });
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/recipes/:id", authMiddleware, async (req: any, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    const { ingredients: ings, steps, ...recipeData } = req.body;
    const updated = await storage.updateRecipe(req.params.id, recipeData);
    if (ings !== undefined) {
      await storage.deleteIngredientsByRecipe(recipe.id);
      if (ings.length > 0) await storage.bulkCreateIngredients(ings.map((ing: any, i: number) => ({
        recipeId: recipe.id, name: ing.name?.toLowerCase() || "", quantity: ing.quantity ? String(ing.quantity) : null,
        unit: ing.unit || null, preparation: ing.preparation || null, category: ing.category || "other",
        isPantryStaple: ing.isPantryStaple || false, sortOrder: i,
      })));
    }
    if (steps !== undefined) {
      await storage.deleteStepsByRecipe(recipe.id);
      if (steps.length > 0) await storage.bulkCreateSteps(steps.map((s: any, i: number) => ({
        recipeId: recipe.id, stepNumber: s.stepNumber || i + 1, instruction: s.instruction, durationMinutes: s.durationMinutes || null,
      })));
    }
    const finalIngredients = await storage.getIngredientsByRecipe(recipe.id);
    const finalSteps = await storage.getStepsByRecipe(recipe.id);
    res.json({ ...updated, ingredients: finalIngredients, steps: finalSteps });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/recipes/:id", authMiddleware, async (req: any, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    await storage.deleteRecipe(req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/recipes/:id/cook", authMiddleware, async (req: any, res) => {
  try {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    const { prepTimeActual, cookTimeActual, rating, notes } = req.body;
    const updated = await storage.updateRecipe(req.params.id, {
      cooked: true, cookedCount: (recipe.cookedCount || 0) + 1, lastCookedAt: new Date(),
      ...(prepTimeActual != null && { prepTimeActual }), ...(cookTimeActual != null && { cookTimeActual }),
      ...(rating != null && { rating }), ...(notes != null && { notes }),
    });
    res.json(updated);
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── AI ──────────────────────────────────────────────────────────────────────

app.post("/api/ai/import-url", authMiddleware, async (req: any, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    let htmlContent = "";
    try {
      const response = await axios.get(url, { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0 (compatible; MealMap/1.0)" } });
      const $ = cheerio.load(response.data);
      $("script, style, nav, footer, header, aside, .advertisement, .ads").remove();
      htmlContent = $("body").text().replace(/\s+/g, " ").trim().substring(0, 8000);
    } catch { return res.status(422).json({ error: "Failed to fetch URL. Try pasting the recipe text manually." }); }
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 8192, system: RECIPE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Extract the recipe from this webpage content:\n\n${htmlContent}` }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("No text response");
    res.json(parseClaudeJson(content.text));
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message || "Failed" }); }
});

app.post("/api/ai/import-text", authMiddleware, async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 8192, system: RECIPE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Extract the recipe from this text:\n\n${text}` }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("No text response");
    res.json(parseClaudeJson(content.text));
  } catch (err: any) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/ai/generate", authMiddleware, async (req: any, res) => {
  try {
    const { prompt, pantryContext } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });
    let fullPrompt = prompt;
    if (pantryContext) fullPrompt += `\n\nHousehold pantry: ${pantryContext}. Try to incorporate these where appropriate.`;
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 8192, system: RECIPE_GENERATE_PROMPT,
      messages: [{ role: "user", content: fullPrompt }],
    });
    const content = message.content[0];
    if (content.type !== "text") throw new Error("No response");
    res.json(parseClaudeJson(content.text));
  } catch (err: any) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Pantry ──────────────────────────────────────────────────────────────────

app.get("/api/pantry", authMiddleware, async (req: any, res) => {
  try { res.json(await storage.getPantryItems(req.householdId)); }
  catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/pantry", authMiddleware, async (req: any, res) => {
  try { res.status(201).json(await storage.createPantryItem({ ...req.body, householdId: req.householdId })); }
  catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/pantry/bulk", authMiddleware, async (req: any, res) => {
  try {
    const created = await Promise.all(req.body.items.map((item: any) => storage.createPantryItem({ ...item, householdId: req.householdId })));
    res.status(201).json(created);
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/pantry/:id/restock", authMiddleware, async (req: any, res) => {
  try {
    const item = await storage.getPantryItem(parseInt(req.params.id));
    if (!item || item.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    const updatedItem = await storage.updatePantryItem(item.id, { quantityNote: "running low" });
    const lists = await storage.getGroceryListsByHousehold(req.householdId);
    let list = lists.length > 0 ? lists[lists.length - 1] : null;
    if (!list) list = await storage.createGroceryList({ householdId: req.householdId, mealPlanId: null, name: "Shopping list", weekStart: null });
    const existingItems = await storage.getGroceryListItems(list.id);
    const alreadyPresent = existingItems.some(i => i.ingredientName.toLowerCase() === item.name.toLowerCase());
    if (!alreadyPresent) await storage.createGroceryListItem({
      groceryListId: list.id, ingredientName: item.name, totalQuantity: null, unit: null,
      category: item.category, sourceRecipes: [], isChecked: false, isPantryCovered: false,
      manuallyAdded: true, notes: "Marked as running low in pantry",
    });
    res.json({ pantryItem: updatedItem, listId: list.id, listName: list.name, alreadyPresent });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/pantry/:id", authMiddleware, async (req: any, res) => {
  try {
    const item = await storage.getPantryItem(parseInt(req.params.id));
    if (!item || item.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    res.json(await storage.updatePantryItem(parseInt(req.params.id), req.body));
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/pantry/:id", authMiddleware, async (req: any, res) => {
  try {
    const item = await storage.getPantryItem(parseInt(req.params.id));
    if (!item || item.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    await storage.deletePantryItem(parseInt(req.params.id));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed" }); }
});

// ── Meal Plans ───────────────────────────────────────────────────────────────

app.get("/api/meal-plans", authMiddleware, async (req: any, res) => {
  try {
    const { weekStart } = req.query;
    if (weekStart) {
      const plan = await storage.getMealPlanByWeek(req.householdId, weekStart as string);
      if (!plan) return res.json(null);
      const entries = await storage.getMealPlanEntries(plan.id);
      const enriched = await Promise.all(entries.map(async (e) => {
        if (e.recipeId) return { ...e, recipe: await storage.getRecipe(e.recipeId) };
        return e;
      }));
      return res.json({ ...plan, entries: enriched });
    }
    res.json(await storage.getMealPlansByHousehold(req.householdId));
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/meal-plans/entries", authMiddleware, async (req: any, res) => {
  try {
    const { weekStart, date, mealSlot, recipeId, customMealText, servingsOverride, notes } = req.body;
    const plan = await storage.upsertMealPlan(req.householdId, weekStart, req.userId);
    await storage.deleteMealPlanEntriesBySlot(plan.id, date, mealSlot);
    if (!recipeId && !customMealText) return res.json({ cleared: true });
    const entry = await storage.createMealPlanEntry({
      mealPlanId: plan.id, date, mealSlot, recipeId: recipeId || null,
      customMealText: customMealText || null, servingsOverride: servingsOverride || null, notes: notes || null,
    });
    const recipe = recipeId ? await storage.getRecipe(recipeId) : null;
    res.status(201).json({ ...entry, recipe });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/meal-plans/entries/:id", authMiddleware, async (req: any, res) => {
  try { await storage.deleteMealPlanEntry(parseInt(req.params.id)); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

// ── Grocery Lists ────────────────────────────────────────────────────────────

app.get("/api/grocery-lists", authMiddleware, async (req: any, res) => {
  try { res.json(await storage.getGroceryListsByHousehold(req.householdId)); }
  catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/grocery-lists", authMiddleware, async (req: any, res) => {
  try {
    const list = await storage.createGroceryList({ householdId: req.householdId, mealPlanId: null, name: req.body.name || "My grocery list", weekStart: null });
    res.status(201).json({ ...list, items: await storage.getGroceryListItems(list.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/grocery-lists/generate", authMiddleware, async (req: any, res) => {
  try {
    const { weekStart } = req.body;
    const plan = await storage.getMealPlanByWeek(req.householdId, weekStart);
    if (!plan) return res.status(404).json({ error: "No meal plan for this week" });
    const entries = await storage.getMealPlanEntries(plan.id);
    const pantry = await storage.getPantryItems(req.householdId);
    const ingredientMap = new Map<string, { quantity: number; unit: string; category: string; recipes: string[] }>();
    for (const entry of entries) {
      if (!entry.recipeId) continue;
      const recipe = await storage.getRecipe(entry.recipeId);
      if (!recipe) continue;
      const ings = await storage.getIngredientsByRecipe(entry.recipeId);
      const ratio = (entry.servingsOverride || recipe.servingsBase || 1) / (recipe.servingsBase || 1);
      for (const ing of ings) {
        if (ing.isPantryStaple) continue;
        const key = `${ing.name.toLowerCase()}__${ing.unit || ""}`;
        const qty = parseFloat(ing.quantity || "0") * ratio;
        if (ingredientMap.has(key)) {
          const ex = ingredientMap.get(key)!;
          ex.quantity += qty;
          if (!ex.recipes.includes(recipe.title)) ex.recipes.push(recipe.title);
        } else {
          ingredientMap.set(key, { quantity: qty, unit: ing.unit || "", category: ing.category || "other", recipes: [recipe.title] });
        }
      }
    }
    const existingList = await storage.getGroceryListByMealPlan(plan.id);
    if (existingList) { await storage.deleteGroceryListItems(existingList.id); await storage.deleteGroceryList(existingList.id); }
    const list = await storage.createGroceryList({ householdId: req.householdId, mealPlanId: plan.id, status: "draft" });
    const itemsToCreate = Array.from(ingredientMap.entries()).map(([key, val]) => {
      const name = key.split("__")[0];
      const matched = pantry.find(p => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase()));
      return {
        groceryListId: list.id, ingredientName: name,
        totalQuantity: val.quantity > 0 ? String(Math.round(val.quantity * 100) / 100) : null,
        unit: val.unit || null, category: val.category as any, sourceRecipes: val.recipes,
        isChecked: false, isPantryCovered: !!matched, manuallyAdded: false,
        notes: matched ? matched.location : null,
      };
    });
    const items = await storage.bulkCreateGroceryListItems(itemsToCreate);
    res.status(201).json({ ...list, items });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/api/grocery-lists/:id", authMiddleware, async (req: any, res) => {
  try {
    const list = await storage.getGroceryList(req.params.id);
    if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    res.json({ ...list, items: await storage.getGroceryListItems(list.id) });
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/grocery-lists/:id", authMiddleware, async (req: any, res) => {
  try {
    const list = await storage.getGroceryList(req.params.id);
    if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    res.json(await storage.updateGroceryList(req.params.id, req.body));
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/grocery-lists/:listId/items", authMiddleware, async (req: any, res) => {
  try {
    const list = await storage.getGroceryList(req.params.listId);
    if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    res.status(201).json(await storage.createGroceryListItem({ ...req.body, groceryListId: list.id, manuallyAdded: true }));
  } catch { res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/grocery-lists/:listId/items/:itemId", authMiddleware, async (req: any, res) => {
  try { res.json(await storage.updateGroceryListItem(parseInt(req.params.itemId), req.body)); }
  catch { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/grocery-lists/:listId/items/:itemId", authMiddleware, async (req: any, res) => {
  try { await storage.deleteGroceryListItem(parseInt(req.params.itemId)); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/grocery-lists/:listId/bulk-add", authMiddleware, async (req: any, res) => {
  try {
    const list = await storage.getGroceryList(req.params.listId);
    if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });
    const VALID_CATEGORIES = ["produce","meat_seafood","dairy","bakery","frozen","canned_jarred","grains_pasta","condiments_sauces","spices","snacks","beverages","other"];
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2048,
      messages: [{ role: "user", content: `Categorize these grocery items. Valid categories: ${VALID_CATEGORIES.join(", ")}\n\nItems:\n${items.join("\n")}\n\nReturn JSON array ONLY:\n[{"name":"clean name","category":"category","quantity":"number or null","unit":"unit or null"}]` }],
    });
    const content = message.content[0];
    if (content.type !== "text") return res.status(500).json({ error: "AI error" });
    const parsed = parseClaudeJson(content.text);
    res.json(await storage.bulkCreateGroceryListItems(parsed.map((item: any) => ({
      groceryListId: req.params.listId, ingredientName: item.name || "Unknown item",
      totalQuantity: item.quantity || null, unit: item.unit || null,
      category: VALID_CATEGORIES.includes(item.category) ? item.category as any : "other",
      sourceRecipes: [], isChecked: false, isPantryCovered: false, manuallyAdded: true, notes: null,
    }))));
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Admin ────────────────────────────────────────────────────────────────────

app.get("/api/admin/users", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({ id: u.id, email: u.email, displayName: u.displayName, householdId: u.householdId, role: u.role, createdAt: u.createdAt })));
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const { email, password, displayName, householdName, inviteCode, role } = req.body;
    if (!email || !password || !displayName) return res.status(400).json({ error: "Email, password, and display name are required" });
    if (await storage.getUserByEmail(email)) return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    let householdId: string;
    if (inviteCode) {
      const household = await storage.getHouseholdByInviteCode(inviteCode.trim().toUpperCase());
      if (!household) return res.status(404).json({ error: "Invalid invite code" });
      householdId = household.id;
    } else if (householdName) {
      householdId = (await storage.createHousehold({ name: householdName })).id;
    } else {
      return res.status(400).json({ error: "Either household name or invite code is required" });
    }
    const user = await storage.createUser({ email, passwordHash, displayName, householdId, role: role === "admin" ? "admin" : "user" });
    res.status(201).json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role, createdAt: user.createdAt });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.patch("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const { displayName, password, role, householdId } = req.body;
    const updates: any = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    if (role === "admin" || role === "user") updates.role = role;
    if (householdId !== undefined) updates.householdId = householdId;
    const user = await storage.updateUser(req.params.id, updates);
    res.json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId, role: user.role, createdAt: user.createdAt });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ error: "You cannot delete your own account" });
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

app.get("/api/admin/households", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    const ids = [...new Set(allUsers.map(u => u.householdId).filter(Boolean))];
    const households = await Promise.all(ids.map(id => storage.getHousehold(id!)));
    res.json(households.filter(Boolean));
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// ── Export ───────────────────────────────────────────────────────────────────

export default (req: VercelRequest, res: VercelResponse) => {
  app(req as any, res as any);
};
