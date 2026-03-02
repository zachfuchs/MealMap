# Family Meal Planner App — Replit Build Prompt

## Overview

Build a full-stack family meal planner web app called **MealMap**. It is used by a household of adults (2+) who share cooking, shopping, and feeding a toddler. The app has six core modules: Recipe Engine, Recipe Library, Pantry & Fridge Tracker, Weekly Meal Planner, Grocery List Generator, and Household Accounts. The UI should be clean, fast, and mobile-first (most usage will be on a phone in the kitchen or grocery store).

---

## Tech Stack

- **Frontend:** React + Tailwind CSS. Use shadcn/ui components. Mobile-first responsive layout.
- **Backend:** Node.js (Express) or Python (FastAPI) — dealer's choice based on what works best with Replit.
- **Database:** PostgreSQL via Replit's built-in database or Supabase. Use proper relational schema, not JSON blobs.
- **Auth:** Simple email/password auth with support for multiple adults per household (same role, no admin/member distinction). All adults in a household share the same recipe library, pantry, and meal plan.
- **AI Integration:** Use Anthropic Claude API (claude-sonnet-4-5-20250929) for: recipe extraction from URLs, recipe generation from natural language prompts, and ingredient categorization. Store the API key as a Replit secret.
- **URL Scraping:** Use a server-side scraping approach (cheerio, or a headless browser if needed) to extract recipe content from URLs before passing to Claude for structured parsing.

---

## Data Model

### Household
- id, name, created_at

### User
- id, household_id (FK), email, password_hash, display_name, created_at

### Recipe
- id, household_id (FK), created_by (FK to User)
- title, source_url (nullable), source_type (enum: 'imported', 'generated', 'manual')
- description (short, 1-2 sentences)
- servings_base (integer, the default number of servings)
- prep_time_estimated (minutes, from source or AI)
- cook_time_estimated (minutes, from source or AI)
- prep_time_actual (minutes, nullable, user-entered after cooking)
- cook_time_actual (minutes, nullable, user-entered after cooking)
- tags (array of strings — e.g., 'quick', 'vegetarian', 'kid-friendly', 'high-protein', 'meal-prep', 'weeknight', 'date-night')
- notes (free text, user tips/comments)
- cooked (boolean, default false)
- cooked_count (integer, increments each time marked cooked)
- last_cooked_at (timestamp, nullable)
- rating (1-5 stars, nullable)
- kid_friendly (boolean, default false)
- kid_modification_notes (text, nullable — e.g., "Serve rice and beans deconstructed, skip the hot sauce")
- is_favorite (boolean)
- created_at, updated_at

### Ingredient (per recipe)
- id, recipe_id (FK)
- name (normalized lowercase, e.g., 'chicken thighs')
- quantity (decimal)
- unit (string — tsp, tbsp, cup, oz, lb, g, kg, ml, L, clove, bunch, piece, can, etc.)
- preparation (nullable — e.g., 'diced', 'minced', 'drained and rinsed')
- category (enum: 'produce', 'meat_seafood', 'dairy', 'bakery', 'frozen', 'canned_jarred', 'grains_pasta', 'condiments_sauces', 'spices', 'snacks', 'beverages', 'other')
- is_pantry_staple (boolean — if true, exclude from grocery list by default)
- sort_order (integer, for display in recipe)

### RecipeStep
- id, recipe_id (FK)
- step_number (integer)
- instruction (text)
- duration_minutes (nullable, for timers)

### PantryItem
- id, household_id (FK)
- name, category (same enum as Ingredient category)
- location (enum: 'pantry', 'fridge', 'freezer', 'snack_bin')
- quantity_note (optional free text — e.g., '1/2 bag', 'almost out', 'full')
- expiry_date (nullable, mainly useful for fridge items)
- auto_restock (boolean — if true, always add to grocery list when low)
- updated_at

### MealPlan
- id, household_id (FK)
- week_start_date (date, always a Monday)
- created_by (FK to User)

### MealPlanEntry
- id, meal_plan_id (FK)
- date (date)
- meal_slot (enum: 'breakfast', 'lunch', 'dinner', 'snack')
- recipe_id (FK, nullable — null if free text entry)
- custom_meal_text (nullable — for quick entries like "leftovers" or "takeout")
- servings_override (integer, nullable — overrides recipe default for grocery calc)
- notes (nullable)

### GroceryList
- id, meal_plan_id (FK), household_id (FK)
- generated_at (timestamp)
- status (enum: 'draft', 'finalized', 'shopping', 'completed')

### GroceryListItem
- id, grocery_list_id (FK)
- ingredient_name (normalized)
- total_quantity (decimal, aggregated across recipes)
- unit
- category (aisle grouping)
- source_recipes (array of recipe titles, for reference)
- is_checked (boolean, for in-store use)
- is_pantry_covered (boolean — true if pantry already has this item)
- manually_added (boolean)
- notes (nullable)

---

## Module Specs

### 1. Recipe Engine (Add Recipes)

Three input modes, accessible from a single "Add Recipe" screen with tabs:

#### A. Import from URL
- User pastes a URL (NYT Cooking, Serious Eats, any food blog).
- Backend scrapes the page HTML server-side.
- Send the scraped HTML/text to Claude with a structured prompt that extracts: title, description, servings, prep time, cook time, ingredients (with quantity, unit, preparation, and category), and ordered steps.
- Claude returns structured JSON. Display a preview card to the user.
- User can edit any field before saving. This is important — AI extraction is imperfect.
- If the page is behind a paywall or fails to scrape, show a clear error and suggest manual entry or paste-the-text mode (a textarea where user can paste the recipe text directly).

#### B. Generate with AI
- User types a natural language prompt, e.g.: "Healthy quick taco recipe using black beans and cauliflower, 4 servings."
- Send to Claude with instructions to return the same structured JSON format.
- Display the generated recipe as a preview. User can edit, adjust servings, then save.
- Include a "regenerate" button that sends the same prompt again for a different variation.
- Optionally, cross-reference the prompt against the user's current pantry/fridge to suggest recipes that use what they already have.

#### C. Manual Entry
- Standard form: title, servings, prep time, cook time, ingredient rows (add/remove dynamically), step rows, tags, notes.
- Keep it fast. Auto-suggest ingredient names from previously used ingredients.

#### After saving (all modes):
- Prompt to add tags (with suggested defaults based on content).
- Review out of five stars
- Prompt for kid-friendly flag and optional kid modification notes.
- Recipe appears immediately in the library.

### 2. Recipe Library

- Default view: card grid showing title, tags, rating stars, cooked count, last cooked date, prep+cook time, and a small thumbnail (placeholder color block if no image).
- **Filter bar** (persistent at top): tags (multi-select), source type, cooked/uncooked, kid-friendly, rating, max total time, favorites only.
- **Search:** full-text search across title, ingredients, notes, tags.
- **Sort options:** newest, most cooked, highest rated, fastest, alphabetical.
- **Recipe detail view:** full recipe with ingredient list (with checkboxes for in-kitchen use), steps (with optional timers), and a "Cook Mode" that makes the text large and keeps the screen awake.
- **"Cook this" action:** marks as cooked, increments count, sets last_cooked_at, prompts for actual prep/cook times and optional rating/notes update.
- **"What Can I Make?" mode:** user taps this button, and the app cross-references the recipe library against current pantry + fridge items. Returns recipes ranked by % of ingredients already on hand. Show "missing ingredients" count per recipe.

### 3. Pantry & Fridge Tracker

Four tabs: **Pantry** (shelf-stable), **Fridge**, **Freezer**, **Snack Bin**.

- Each tab shows items sorted by category.
- Add item: name, category (auto-suggest from known items), quantity note, expiry date (optional), auto-restock flag.
- Quick actions: "used up" (removes), "running low" (updates quantity note), "restocked" (resets).
- Items here are cross-referenced when generating grocery lists — if the meal plan needs cumin and cumin is in the pantry, it's excluded (or shown as "already have" in the list).
- **Bulk add:** a textarea where user can type or paste a list of items, one per line, and the app parses them in.

### 4. Weekly Meal Planner

- **Calendar view:** 7-day grid (Mon-Sun) with rows for breakfast, lunch, dinner, snack.
- Default to current week. Navigate forward/back by week.
- **Add meal to slot:** search and select from recipe library, or type a free-text entry ("leftovers", "eating out", etc.).
- **Servings per slot:** defaults to recipe base servings, but user can override (e.g., cooking double for leftovers).
- **Drag and drop** to rearrange meals between slots/days.
- **Copy previous week** button for recurring patterns.
- **Leftover logic:** if a recipe makes 6 servings and you only need 4 for dinner, the app could suggest slotting "leftovers — [recipe name]" into a lunch slot later in the week. Don't force this, just offer it.
- Visual indicators: show total estimated prep/cook time per day, flag days with nothing planned.

### 5. Grocery List Generator

- **Auto-generate** from the current week's meal plan. One button: "Generate Grocery List."
- Aggregation logic: combine identical ingredients across recipes. If Recipe A needs 1 cup diced onion and Recipe B needs 1/2 cup sliced onion, show "Onions — 1.5 cups (diced + sliced)" or intelligently round to "2 medium onions."
- **Subtract pantry/fridge items** automatically. Show these as greyed-out "already have" items that the user can un-check if they actually need more.
- **Group by aisle/category:** produce, meat & seafood, dairy, bakery, frozen, canned & jarred goods, grains & pasta, condiments & sauces, spices, snacks, beverages, other.
- Each item shows source recipe(s) in small text underneath.
- **Manual add** items to the list (e.g., paper towels, diapers — non-food household items).
- **In-store mode:** large text, checkboxes, items checked off move to bottom. Progress bar at top.
- **Copy as text:** generate a clean plaintext version grouped by aisle that can be pasted into Notes, Messages, etc.
- **Export format example:**

```
🛒 Grocery List — Week of Jan 6

PRODUCE
☐ Broccoli, 2 heads (Chicken Stir Fry, Sheet Pan Veg)
☐ Cilantro, 1 bunch (Tacos, Rice Bowl)
☐ Avocados, 3 (Tacos, Toast)

MEAT & SEAFOOD
☐ Chicken thighs, 2 lbs (Stir Fry)
☐ Salmon fillets, 4 (Baked Salmon)

DAIRY
☐ Greek yogurt, 32oz (Breakfast, Marinade)

...
```

### 6. Household Accounts

- On first use, a user creates a household and their account. They receive a household invite code/link.
- Other adults join by entering the invite code or clicking the link. All users in a household are equal — no roles or permissions hierarchy.
- All data (recipes, pantry, meal plans, grocery lists) is shared across the household.
- Show "added by [name]" on recipes and meal plan entries for context, not for access control.
- Simple profile: display name, email, password change.

---

## AI Integration Details

All Claude API calls should use this pattern:

**System prompt for recipe extraction:**
```
You are a recipe parser. Given raw text or HTML from a recipe webpage, extract the recipe into the following JSON structure. Be precise with quantities and units. Normalize ingredient names to lowercase. Categorize each ingredient into one of these categories: produce, meat_seafood, dairy, bakery, frozen, canned_jarred, grains_pasta, condiments_sauces, spices, snacks, beverages, other. If information is missing or ambiguous, use your best judgment and flag it with a "confidence": "low" field.

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
      "quantity": number,
      "unit": "string",
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
}
```

**System prompt for recipe generation:**
Same JSON output format as above, plus:
```
You are a home cook's recipe assistant. Generate a recipe based on the user's request. Prioritize practical weeknight cooking — realistic prep times, common equipment, ingredients available at a standard grocery store. If the user specifies ingredients to include, feature them prominently. If they specify dietary constraints, respect them strictly.

The user's household pantry contains: [inject current pantry items list here]

Assume they already have common pantry staples (salt, pepper, olive oil, butter, common dried spices) unless the recipe needs an unusual quantity.
```

---

## UI/UX Requirements

- **Mobile-first.** 90% of usage is on a phone. Touch targets must be large. No hover-dependent interactions.
- **Bottom navigation bar** with 5 icons: Recipes, Plan, Groceries, Pantry, Account.
- **Dark mode support** (follow system preference).
- **Fast.** Pages should load instantly. Use optimistic UI updates. Don't show loading spinners for local operations.
- **Color palette:** warm, appetizing tones. Earthy greens, warm oranges, cream backgrounds. Not sterile blue/white SaaS aesthetic.
- **Typography:** clean sans-serif. Good hierarchy between headers, body, and metadata.
- **Empty states:** every screen should have a helpful empty state with a clear CTA. E.g., the recipe library when empty shows "Your recipe library is empty. Add your first recipe →".
- **Toast notifications** for confirmations (recipe saved, item added, etc.), not modal dialogs.
- **Keyboard shortcuts** for desktop: Cmd+N for new recipe, Cmd+K for search, etc.

---

## Nice-to-Have Extensions (implement if straightforward)

1. **Nutrition estimates:** after extracting/generating a recipe, show estimated calories, protein, carbs, fat per serving. Use Claude to estimate if a nutrition API is too complex.
2. **Seasonal suggestions:** when in recipe generation mode, bias toward seasonal produce based on current month.
3. **Recipe scaling:** on the recipe detail view, a slider or input to scale servings (2x, 0.5x, etc.) with all ingredient quantities recalculated live.
4. **Meal plan templates:** save a week's plan as a reusable template (e.g., "Standard Weeknight Rotation").
5. **Quick-add from history:** when adding meals to the planner, show recently cooked and frequently cooked recipes at the top.
6. **Print view:** a clean, single-page print layout for a recipe (for taping to the fridge).
7. **"Tonight" shortcut:** prominent button on the home screen — "What should I cook tonight?" — that considers pantry contents, fridge items nearing expiry, time of day, and any meal already slotted in the plan.

---

## What NOT to Build

- No social features, sharing, or public profiles.
- No image upload or photo storage (keep it lightweight).
- No integration with smart home devices.
- No subscription/payment system.
- No chatbot interface — AI is used behind the scenes for extraction and generation, not as a conversational UI.
