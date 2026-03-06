import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  decimal,
  timestamp,
  date,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const sourceTypeEnum = pgEnum("source_type", ["imported", "generated", "manual"]);
export const ingredientCategoryEnum = pgEnum("ingredient_category", [
  "produce", "meat_seafood", "dairy", "bakery", "frozen",
  "canned_jarred", "grains_pasta", "condiments_sauces", "spices", "snacks", "beverages", "other"
]);
export const pantryLocationEnum = pgEnum("pantry_location", ["pantry", "fridge", "freezer", "snack_bin"]);
export const mealSlotEnum = pgEnum("meal_slot", ["breakfast", "lunch", "dinner", "snack"]);
export const groceryListStatusEnum = pgEnum("grocery_list_status", ["draft", "finalized", "shopping", "completed"]);

// Households
export const households = pgTable("households", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  inviteCode: varchar("invite_code").notNull().unique().default(sql`substr(md5(random()::text), 1, 8)`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdId: varchar("household_id").references(() => households.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Recipes
export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdId: varchar("household_id").references(() => households.id),
  createdBy: varchar("created_by").references(() => users.id),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  sourceType: sourceTypeEnum("source_type").notNull().default("manual"),
  description: text("description"),
  servingsBase: integer("servings_base").notNull().default(4),
  prepTimeEstimated: integer("prep_time_estimated"),
  cookTimeEstimated: integer("cook_time_estimated"),
  prepTimeActual: integer("prep_time_actual"),
  cookTimeActual: integer("cook_time_actual"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  cooked: boolean("cooked").notNull().default(false),
  cookedCount: integer("cooked_count").notNull().default(0),
  lastCookedAt: timestamp("last_cooked_at"),
  rating: integer("rating"),
  kidFriendly: boolean("kid_friendly").notNull().default(false),
  kidModificationNotes: text("kid_modification_notes"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Ingredients
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }),
  unit: text("unit"),
  preparation: text("preparation"),
  category: ingredientCategoryEnum("category").notNull().default("other"),
  isPantryStaple: boolean("is_pantry_staple").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Recipe Steps
export const recipeSteps = pgTable("recipe_steps", {
  id: serial("id").primaryKey(),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  instruction: text("instruction").notNull(),
  durationMinutes: integer("duration_minutes"),
});

// Pantry Items
export const pantryItems = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  householdId: varchar("household_id").notNull().references(() => households.id),
  name: text("name").notNull(),
  category: ingredientCategoryEnum("category").notNull().default("other"),
  location: pantryLocationEnum("location").notNull().default("pantry"),
  quantityNote: text("quantity_note"),
  expiryDate: date("expiry_date"),
  autoRestock: boolean("auto_restock").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Meal Plans
export const mealPlans = pgTable("meal_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdId: varchar("household_id").notNull().references(() => households.id),
  weekStartDate: date("week_start_date").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Meal Plan Entries
export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: serial("id").primaryKey(),
  mealPlanId: varchar("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  mealSlot: mealSlotEnum("meal_slot").notNull(),
  recipeId: varchar("recipe_id").references(() => recipes.id),
  customMealText: text("custom_meal_text"),
  servingsOverride: integer("servings_override"),
  notes: text("notes"),
});

// Grocery Lists
export const groceryLists = pgTable("grocery_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id),
  householdId: varchar("household_id").notNull().references(() => households.id),
  generatedAt: timestamp("generated_at").notNull().default(sql`now()`),
  status: groceryListStatusEnum("status").notNull().default("draft"),
});

// Grocery List Items
export const groceryListItems = pgTable("grocery_list_items", {
  id: serial("id").primaryKey(),
  groceryListId: varchar("grocery_list_id").notNull().references(() => groceryLists.id, { onDelete: "cascade" }),
  ingredientName: text("ingredient_name").notNull(),
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 3 }),
  unit: text("unit"),
  category: ingredientCategoryEnum("category").notNull().default("other"),
  sourceRecipes: text("source_recipes").array().notNull().default(sql`'{}'::text[]`),
  isChecked: boolean("is_checked").notNull().default(false),
  isPantryCovered: boolean("is_pantry_covered").notNull().default(false),
  manuallyAdded: boolean("manually_added").notNull().default(false),
  notes: text("notes"),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Chat tables (for Anthropic integration)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Relations
export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  recipes: many(recipes),
  pantryItems: many(pantryItems),
  mealPlans: many(mealPlans),
  groceryLists: many(groceryLists),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, { fields: [users.householdId], references: [households.id] }),
  recipes: many(recipes),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  household: one(households, { fields: [recipes.householdId], references: [households.id] }),
  createdByUser: one(users, { fields: [recipes.createdBy], references: [users.id] }),
  ingredients: many(ingredients),
  steps: many(recipeSteps),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, { fields: [ingredients.recipeId], references: [recipes.id] }),
}));

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeSteps.recipeId], references: [recipes.id] }),
}));

export const pantryItemsRelations = relations(pantryItems, ({ one }) => ({
  household: one(households, { fields: [pantryItems.householdId], references: [households.id] }),
}));

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  household: one(households, { fields: [mealPlans.householdId], references: [households.id] }),
  entries: many(mealPlanEntries),
  groceryLists: many(groceryLists),
}));

export const mealPlanEntriesRelations = relations(mealPlanEntries, ({ one }) => ({
  mealPlan: one(mealPlans, { fields: [mealPlanEntries.mealPlanId], references: [mealPlans.id] }),
  recipe: one(recipes, { fields: [mealPlanEntries.recipeId], references: [recipes.id] }),
}));

export const groceryListsRelations = relations(groceryLists, ({ one, many }) => ({
  mealPlan: one(mealPlans, { fields: [groceryLists.mealPlanId], references: [mealPlans.id] }),
  household: one(households, { fields: [groceryLists.householdId], references: [households.id] }),
  items: many(groceryListItems),
}));

export const groceryListItemsRelations = relations(groceryListItems, ({ one }) => ({
  groceryList: one(groceryLists, { fields: [groceryListItems.groceryListId], references: [groceryLists.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

// Insert schemas
export const insertHouseholdSchema = createInsertSchema(households).omit({ id: true, inviteCode: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIngredientSchema = createInsertSchema(ingredients).omit({ id: true });
export const insertRecipeStepSchema = createInsertSchema(recipeSteps).omit({ id: true });
export const insertPantryItemSchema = createInsertSchema(pantryItems).omit({ id: true, updatedAt: true });
export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({ id: true, createdAt: true });
export const insertMealPlanEntrySchema = createInsertSchema(mealPlanEntries).omit({ id: true });
export const insertGroceryListSchema = createInsertSchema(groceryLists).omit({ id: true, generatedAt: true });
export const insertGroceryListItemSchema = createInsertSchema(groceryListItems).omit({ id: true });

// Types
export type Household = typeof households.$inferSelect;
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type RecipeStep = typeof recipeSteps.$inferSelect;
export type InsertRecipeStep = z.infer<typeof insertRecipeStepSchema>;
export type PantryItem = typeof pantryItems.$inferSelect;
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type InsertMealPlanEntry = z.infer<typeof insertMealPlanEntrySchema>;
export type GroceryList = typeof groceryLists.$inferSelect;
export type InsertGroceryList = z.infer<typeof insertGroceryListSchema>;
export type GroceryListItem = typeof groceryListItems.$inferSelect;
export type InsertGroceryListItem = z.infer<typeof insertGroceryListItemSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
