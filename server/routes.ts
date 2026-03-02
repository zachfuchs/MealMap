import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import * as cheerio from "cheerio";

const JWT_SECRET = process.env.SESSION_SECRET || "mealmap-secret-2024";

function parseClaudeJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not find JSON in AI response");
    return JSON.parse(match[0]);
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; householdId: string };
    (req as any).userId = decoded.userId;
    (req as any).householdId = decoded.householdId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
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
  "ingredients": [
    {
      "name": "string (lowercase, normalized)",
      "quantity": number or null,
      "unit": "string or null",
      "preparation": "string or null",
      "category": "string (from enum)"
    }
  ],
  "steps": [
    {
      "step_number": number,
      "instruction": "string",
      "duration_minutes": number or null
    }
  ],
  "suggested_tags": ["string"],
  "kid_friendly_guess": boolean,
  "kid_modification_suggestion": "string or null"
}`;

const RECIPE_GENERATE_PROMPT = `You are a home cook's recipe assistant. Generate a recipe based on the user's request. Prioritize practical weeknight cooking — realistic prep times, common equipment, ingredients available at a standard grocery store. If the user specifies ingredients to include, feature them prominently. If they specify dietary constraints, respect them strictly.

Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "description": "string (1-2 sentences)",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "ingredients": [
    {
      "name": "string (lowercase, normalized)",
      "quantity": number or null,
      "unit": "string or null",
      "preparation": "string or null",
      "category": "string (produce/meat_seafood/dairy/bakery/frozen/canned_jarred/grains_pasta/condiments_sauces/spices/snacks/beverages/other)"
    }
  ],
  "steps": [
    {
      "step_number": number,
      "instruction": "string",
      "duration_minutes": number or null
    }
  ],
  "suggested_tags": ["string"],
  "kid_friendly_guess": boolean,
  "kid_modification_suggestion": "string or null"
}`;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, displayName, householdName, inviteCode } = req.body;
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

      const user = await storage.createUser({ email, passwordHash, displayName, householdId });
      const token = jwt.sign({ userId: user.id, householdId }, JWT_SECRET, { expiresIn: "30d" });
      const household = await storage.getHousehold(householdId);
      res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, householdId }, household });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
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
      res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId }, household });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const household = user.householdId ? await storage.getHousehold(user.householdId) : null;
      res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId }, household });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/auth/profile", authMiddleware, async (req: any, res) => {
    try {
      const { displayName, password } = req.body;
      const updates: any = {};
      if (displayName) updates.displayName = displayName;
      if (password) updates.passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.updateUser(req.userId, updates);
      res.json({ id: user.id, email: user.email, displayName: user.displayName, householdId: user.householdId });
    } catch {
      res.status(500).json({ error: "Update failed" });
    }
  });

  // Household routes
  app.get("/api/household", authMiddleware, async (req: any, res) => {
    try {
      if (!req.householdId) return res.status(404).json({ error: "No household" });
      const household = await storage.getHousehold(req.householdId);
      const members = await storage.getHouseholdMembers(req.householdId);
      res.json({ ...household, members: members.map(m => ({ id: m.id, email: m.email, displayName: m.displayName })) });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  // Recipe routes
  // What can I make? - must be before :id route
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/recipes", authMiddleware, async (req: any, res) => {
    try {
      const { q } = req.query;
      const recipeList = q
        ? await storage.searchRecipes(req.householdId, q as string)
        : await storage.getRecipesByHousehold(req.householdId);
      res.json(recipeList);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/:id", authMiddleware, async (req: any, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Recipe not found" });
      const ings = await storage.getIngredientsByRecipe(recipe.id);
      const steps = await storage.getStepsByRecipe(recipe.id);
      res.json({ ...recipe, ingredients: ings, steps });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/recipes", authMiddleware, async (req: any, res) => {
    try {
      const { ingredients: ings, steps, ...recipeData } = req.body;
      const recipe = await storage.createRecipe({
        ...recipeData,
        householdId: req.householdId,
        createdBy: req.userId,
      });

      let savedIngredients: any[] = [];
      let savedSteps: any[] = [];

      if (ings && ings.length > 0) {
        const ingData = ings.map((ing: any, i: number) => ({
          recipeId: recipe.id,
          name: ing.name?.toLowerCase() || "",
          quantity: ing.quantity ? String(ing.quantity) : null,
          unit: ing.unit || null,
          preparation: ing.preparation || null,
          category: ing.category || "other",
          isPantryStaple: ing.isPantryStaple || false,
          sortOrder: i,
        }));
        savedIngredients = await storage.bulkCreateIngredients(ingData);
      }

      if (steps && steps.length > 0) {
        const stepData = steps.map((s: any, i: number) => ({
          recipeId: recipe.id,
          stepNumber: s.stepNumber || i + 1,
          instruction: s.instruction,
          durationMinutes: s.durationMinutes || null,
        }));
        savedSteps = await storage.bulkCreateSteps(stepData);
      }

      res.status(201).json({ ...recipe, ingredients: savedIngredients, steps: savedSteps });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  app.patch("/api/recipes/:id", authMiddleware, async (req: any, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Recipe not found" });

      const { ingredients: ings, steps, ...recipeData } = req.body;
      const updated = await storage.updateRecipe(req.params.id, recipeData);

      if (ings !== undefined) {
        await storage.deleteIngredientsByRecipe(recipe.id);
        if (ings.length > 0) {
          await storage.bulkCreateIngredients(ings.map((ing: any, i: number) => ({
            recipeId: recipe.id,
            name: ing.name?.toLowerCase() || "",
            quantity: ing.quantity ? String(ing.quantity) : null,
            unit: ing.unit || null,
            preparation: ing.preparation || null,
            category: ing.category || "other",
            isPantryStaple: ing.isPantryStaple || false,
            sortOrder: i,
          })));
        }
      }

      if (steps !== undefined) {
        await storage.deleteStepsByRecipe(recipe.id);
        if (steps.length > 0) {
          await storage.bulkCreateSteps(steps.map((s: any, i: number) => ({
            recipeId: recipe.id,
            stepNumber: s.stepNumber || i + 1,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes || null,
          })));
        }
      }

      const finalIngredients = await storage.getIngredientsByRecipe(recipe.id);
      const finalSteps = await storage.getStepsByRecipe(recipe.id);
      res.json({ ...updated, ingredients: finalIngredients, steps: finalSteps });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update recipe" });
    }
  });

  app.delete("/api/recipes/:id", authMiddleware, async (req: any, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Recipe not found" });
      await storage.deleteRecipe(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/recipes/:id/cook", authMiddleware, async (req: any, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      if (!recipe || recipe.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      const { prepTimeActual, cookTimeActual, rating, notes } = req.body;
      const updated = await storage.updateRecipe(req.params.id, {
        cooked: true,
        cookedCount: (recipe.cookedCount || 0) + 1,
        lastCookedAt: new Date(),
        ...(prepTimeActual != null && { prepTimeActual }),
        ...(cookTimeActual != null && { cookTimeActual }),
        ...(rating != null && { rating }),
        ...(notes != null && { notes }),
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  // AI routes
  app.post("/api/ai/import-url", authMiddleware, async (req: any, res) => {
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
      } catch (err) {
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

      const parsed = parseClaudeJson(content.text);

      res.json(parsed);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to import recipe" });
    }
  });

  app.post("/api/ai/import-text", authMiddleware, async (req: any, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text required" });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: RECIPE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Extract the recipe from this text:\n\n${text}` }],
      });

      const content = message.content[0];
      if (content.type !== "text") throw new Error("No text response");
      const parsed = parseClaudeJson(content.text);
      res.json(parsed);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to parse recipe text" });
    }
  });

  app.post("/api/ai/generate", authMiddleware, async (req: any, res) => {
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
      const parsed = parseClaudeJson(content.text);
      res.json(parsed);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate recipe" });
    }
  });

  // Pantry routes
  app.get("/api/pantry", authMiddleware, async (req: any, res) => {
    try {
      const items = await storage.getPantryItems(req.householdId);
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/pantry", authMiddleware, async (req: any, res) => {
    try {
      const item = await storage.createPantryItem({ ...req.body, householdId: req.householdId });
      res.status(201).json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/pantry/bulk", authMiddleware, async (req: any, res) => {
    try {
      const { items } = req.body;
      const created = await Promise.all(items.map((item: any) =>
        storage.createPantryItem({ ...item, householdId: req.householdId })
      ));
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.patch("/api/pantry/:id", authMiddleware, async (req: any, res) => {
    try {
      const item = await storage.getPantryItem(parseInt(req.params.id));
      if (!item || item.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      const updated = await storage.updatePantryItem(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.delete("/api/pantry/:id", authMiddleware, async (req: any, res) => {
    try {
      const item = await storage.getPantryItem(parseInt(req.params.id));
      if (!item || item.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      await storage.deletePantryItem(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  // Meal Plan routes
  app.get("/api/meal-plans", authMiddleware, async (req: any, res) => {
    try {
      const { weekStart } = req.query;
      if (weekStart) {
        const plan = await storage.getMealPlanByWeek(req.householdId, weekStart as string);
        if (!plan) return res.json(null);
        const entries = await storage.getMealPlanEntries(plan.id);
        const enriched = await Promise.all(entries.map(async (e) => {
          if (e.recipeId) {
            const recipe = await storage.getRecipe(e.recipeId);
            return { ...e, recipe };
          }
          return e;
        }));
        return res.json({ ...plan, entries: enriched });
      }
      const plans = await storage.getMealPlansByHousehold(req.householdId);
      res.json(plans);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/meal-plans/entries", authMiddleware, async (req: any, res) => {
    try {
      const { weekStart, date, mealSlot, recipeId, customMealText, servingsOverride, notes } = req.body;
      const plan = await storage.upsertMealPlan(req.householdId, weekStart, req.userId);

      await storage.deleteMealPlanEntriesBySlot(plan.id, date, mealSlot);

      if (!recipeId && !customMealText) {
        return res.json({ cleared: true });
      }

      const entry = await storage.createMealPlanEntry({
        mealPlanId: plan.id,
        date,
        mealSlot,
        recipeId: recipeId || null,
        customMealText: customMealText || null,
        servingsOverride: servingsOverride || null,
        notes: notes || null,
      });

      let recipe = null;
      if (recipeId) recipe = await storage.getRecipe(recipeId);
      res.status(201).json({ ...entry, recipe });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.delete("/api/meal-plans/entries/:id", authMiddleware, async (req: any, res) => {
    try {
      await storage.deleteMealPlanEntry(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  // Grocery List routes
  app.get("/api/grocery-lists", authMiddleware, async (req: any, res) => {
    try {
      const lists = await storage.getGroceryListsByHousehold(req.householdId);
      res.json(lists);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/grocery-lists/:id", authMiddleware, async (req: any, res) => {
    try {
      const list = await storage.getGroceryList(req.params.id);
      if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      const items = await storage.getGroceryListItems(list.id);
      res.json({ ...list, items });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/grocery-lists/generate", authMiddleware, async (req: any, res) => {
    try {
      const { weekStart } = req.body;
      const plan = await storage.getMealPlanByWeek(req.householdId, weekStart);
      if (!plan) return res.status(404).json({ error: "No meal plan for this week" });

      const entries = await storage.getMealPlanEntries(plan.id);
      const pantry = await storage.getPantryItems(req.householdId);
      const pantryNames = pantry.map(p => p.name.toLowerCase());

      const ingredientMap = new Map<string, { quantity: number; unit: string; category: string; recipes: string[] }>();

      for (const entry of entries) {
        if (!entry.recipeId) continue;
        const recipe = await storage.getRecipe(entry.recipeId);
        if (!recipe) continue;
        const ings = await storage.getIngredientsByRecipe(entry.recipeId);
        const servings = entry.servingsOverride || recipe.servingsBase || 1;
        const ratio = servings / (recipe.servingsBase || 1);

        for (const ing of ings) {
          if (ing.isPantryStaple) continue;
          const key = `${ing.name.toLowerCase()}__${ing.unit || ""}`;
          const qty = parseFloat(ing.quantity || "0") * ratio;
          if (ingredientMap.has(key)) {
            const existing = ingredientMap.get(key)!;
            existing.quantity += qty;
            if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
          } else {
            ingredientMap.set(key, {
              quantity: qty,
              unit: ing.unit || "",
              category: ing.category || "other",
              recipes: [recipe.title],
            });
          }
        }
      }

      const existingList = await storage.getGroceryListByMealPlan(plan.id);
      if (existingList) {
        await storage.deleteGroceryListItems(existingList.id);
        await storage.deleteGroceryList(existingList.id);
      }

      const list = await storage.createGroceryList({ householdId: req.householdId, mealPlanId: plan.id, status: "draft" });

      const itemsToCreate = Array.from(ingredientMap.entries()).map(([key, val]) => {
        const name = key.split("__")[0];
        const isPantryCovered = pantryNames.some(p => p.includes(name) || name.includes(p));
        return {
          groceryListId: list.id,
          ingredientName: name,
          totalQuantity: val.quantity > 0 ? String(Math.round(val.quantity * 100) / 100) : null,
          unit: val.unit || null,
          category: val.category as any,
          sourceRecipes: val.recipes,
          isChecked: false,
          isPantryCovered,
          manuallyAdded: false,
          notes: null,
        };
      });

      const items = await storage.bulkCreateGroceryListItems(itemsToCreate);
      res.status(201).json({ ...list, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate grocery list" });
    }
  });

  app.patch("/api/grocery-lists/:id", authMiddleware, async (req: any, res) => {
    try {
      const list = await storage.getGroceryList(req.params.id);
      if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      const updated = await storage.updateGroceryList(req.params.id, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.patch("/api/grocery-lists/:listId/items/:itemId", authMiddleware, async (req: any, res) => {
    try {
      const updated = await storage.updateGroceryListItem(parseInt(req.params.itemId), req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/grocery-lists/:id/items", authMiddleware, async (req: any, res) => {
    try {
      const list = await storage.getGroceryList(req.params.id);
      if (!list || list.householdId !== req.householdId) return res.status(404).json({ error: "Not found" });
      const item = await storage.createGroceryListItem({ ...req.body, groceryListId: list.id, manuallyAdded: true });
      res.status(201).json(item);
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.delete("/api/grocery-lists/:listId/items/:itemId", authMiddleware, async (req: any, res) => {
    try {
      await storage.deleteGroceryListItem(parseInt(req.params.itemId));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  });

  return httpServer;
}
