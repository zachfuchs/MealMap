import {
  type User, type InsertUser,
  type Household, type InsertHousehold,
  type Recipe, type InsertRecipe,
  type Ingredient, type InsertIngredient,
  type RecipeStep, type InsertRecipeStep,
  type PantryItem, type InsertPantryItem,
  type MealPlan, type InsertMealPlan,
  type MealPlanEntry, type InsertMealPlanEntry,
  type GroceryList, type InsertGroceryList,
  type GroceryListItem, type InsertGroceryListItem,
  users, households, recipes, ingredients, recipeSteps, pantryItems,
  mealPlans, mealPlanEntries, groceryLists, groceryListItems, passwordResetTokens,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  // Auth & Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Password Reset Tokens
  createResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getResetToken(token: string): Promise<{ id: number; userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markResetTokenUsed(id: number): Promise<void>;
  deleteExpiredResetTokens(): Promise<void>;

  // Households
  getHousehold(id: string): Promise<Household | undefined>;
  getHouseholdByInviteCode(code: string): Promise<Household | undefined>;
  createHousehold(household: InsertHousehold): Promise<Household>;
  getHouseholdMembers(householdId: string): Promise<User[]>;

  // Recipes
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipesByHousehold(householdId: string): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, data: Partial<InsertRecipe>): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  searchRecipes(householdId: string, query: string): Promise<Recipe[]>;

  // Ingredients
  getIngredientsByRecipe(recipeId: string): Promise<Ingredient[]>;
  createIngredient(ingredient: InsertIngredient): Promise<Ingredient>;
  updateIngredient(id: number, data: Partial<InsertIngredient>): Promise<Ingredient>;
  deleteIngredientsByRecipe(recipeId: string): Promise<void>;
  bulkCreateIngredients(ingredients: InsertIngredient[]): Promise<Ingredient[]>;

  // Recipe Steps
  getStepsByRecipe(recipeId: string): Promise<RecipeStep[]>;
  createStep(step: InsertRecipeStep): Promise<RecipeStep>;
  deleteStepsByRecipe(recipeId: string): Promise<void>;
  bulkCreateSteps(steps: InsertRecipeStep[]): Promise<RecipeStep[]>;

  // Pantry
  getPantryItems(householdId: string): Promise<PantryItem[]>;
  getPantryItem(id: number): Promise<PantryItem | undefined>;
  createPantryItem(item: InsertPantryItem): Promise<PantryItem>;
  updatePantryItem(id: number, data: Partial<InsertPantryItem>): Promise<PantryItem>;
  deletePantryItem(id: number): Promise<void>;

  // Meal Plans
  getMealPlan(id: string): Promise<MealPlan | undefined>;
  getMealPlanByWeek(householdId: string, weekStart: string): Promise<MealPlan | undefined>;
  getMealPlansByHousehold(householdId: string): Promise<MealPlan[]>;
  createMealPlan(plan: InsertMealPlan): Promise<MealPlan>;
  upsertMealPlan(householdId: string, weekStart: string, createdBy: string): Promise<MealPlan>;

  // Meal Plan Entries
  getMealPlanEntries(mealPlanId: string): Promise<MealPlanEntry[]>;
  createMealPlanEntry(entry: InsertMealPlanEntry): Promise<MealPlanEntry>;
  updateMealPlanEntry(id: number, data: Partial<InsertMealPlanEntry>): Promise<MealPlanEntry>;
  deleteMealPlanEntry(id: number): Promise<void>;
  deleteMealPlanEntriesBySlot(mealPlanId: string, date: string, slot: string): Promise<void>;

  // Grocery Lists
  getGroceryList(id: string): Promise<GroceryList | undefined>;
  getGroceryListsByHousehold(householdId: string): Promise<GroceryList[]>;
  getGroceryListByMealPlan(mealPlanId: string): Promise<GroceryList | undefined>;
  createGroceryList(list: InsertGroceryList): Promise<GroceryList>;
  updateGroceryList(id: string, data: Partial<InsertGroceryList>): Promise<GroceryList>;
  deleteGroceryList(id: string): Promise<void>;

  // Grocery List Items
  getGroceryListItems(groceryListId: string): Promise<GroceryListItem[]>;
  createGroceryListItem(item: InsertGroceryListItem): Promise<GroceryListItem>;
  updateGroceryListItem(id: number, data: Partial<InsertGroceryListItem>): Promise<GroceryListItem>;
  deleteGroceryListItem(id: number): Promise<void>;
  deleteGroceryListItems(groceryListId: string): Promise<void>;
  bulkCreateGroceryListItems(items: InsertGroceryListItem[]): Promise<GroceryListItem[]>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async createResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getResetToken(token: string) {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markResetTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async deleteExpiredResetTokens(): Promise<void> {
    await db.delete(passwordResetTokens).where(sql`expires_at < now()`);
  }

  async getHousehold(id: string): Promise<Household | undefined> {
    const [h] = await db.select().from(households).where(eq(households.id, id));
    return h;
  }

  async getHouseholdByInviteCode(code: string): Promise<Household | undefined> {
    const [h] = await db.select().from(households).where(eq(households.inviteCode, code));
    return h;
  }

  async createHousehold(household: InsertHousehold): Promise<Household> {
    const [created] = await db.insert(households).values(household).returning();
    return created;
  }

  async getHouseholdMembers(householdId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.householdId, householdId));
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async getRecipesByHousehold(householdId: string): Promise<Recipe[]> {
    return db.select().from(recipes).where(eq(recipes.householdId, householdId));
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [created] = await db.insert(recipes).values(recipe).returning();
    return created;
  }

  async updateRecipe(id: string, data: Partial<InsertRecipe>): Promise<Recipe> {
    const [updated] = await db.update(recipes).set({ ...data, updatedAt: new Date() }).where(eq(recipes.id, id)).returning();
    return updated;
  }

  async deleteRecipe(id: string): Promise<void> {
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  async searchRecipes(householdId: string, query: string): Promise<Recipe[]> {
    const q = `%${query}%`;
    return db.select().from(recipes).where(
      and(
        eq(recipes.householdId, householdId),
        or(ilike(recipes.title, q), ilike(recipes.notes, q), ilike(recipes.description, q))
      )
    );
  }

  async getIngredientsByRecipe(recipeId: string): Promise<Ingredient[]> {
    return db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId));
  }

  async createIngredient(ingredient: InsertIngredient): Promise<Ingredient> {
    const [created] = await db.insert(ingredients).values(ingredient).returning();
    return created;
  }

  async updateIngredient(id: number, data: Partial<InsertIngredient>): Promise<Ingredient> {
    const [updated] = await db.update(ingredients).set(data).where(eq(ingredients.id, id)).returning();
    return updated;
  }

  async deleteIngredientsByRecipe(recipeId: string): Promise<void> {
    await db.delete(ingredients).where(eq(ingredients.recipeId, recipeId));
  }

  async bulkCreateIngredients(ings: InsertIngredient[]): Promise<Ingredient[]> {
    if (ings.length === 0) return [];
    return db.insert(ingredients).values(ings).returning();
  }

  async getStepsByRecipe(recipeId: string): Promise<RecipeStep[]> {
    return db.select().from(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));
  }

  async createStep(step: InsertRecipeStep): Promise<RecipeStep> {
    const [created] = await db.insert(recipeSteps).values(step).returning();
    return created;
  }

  async deleteStepsByRecipe(recipeId: string): Promise<void> {
    await db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));
  }

  async bulkCreateSteps(steps: InsertRecipeStep[]): Promise<RecipeStep[]> {
    if (steps.length === 0) return [];
    return db.insert(recipeSteps).values(steps).returning();
  }

  async getPantryItems(householdId: string): Promise<PantryItem[]> {
    return db.select().from(pantryItems).where(eq(pantryItems.householdId, householdId));
  }

  async getPantryItem(id: number): Promise<PantryItem | undefined> {
    const [item] = await db.select().from(pantryItems).where(eq(pantryItems.id, id));
    return item;
  }

  async createPantryItem(item: InsertPantryItem): Promise<PantryItem> {
    const [created] = await db.insert(pantryItems).values(item).returning();
    return created;
  }

  async updatePantryItem(id: number, data: Partial<InsertPantryItem>): Promise<PantryItem> {
    const [updated] = await db.update(pantryItems).set({ ...data, updatedAt: new Date() }).where(eq(pantryItems.id, id)).returning();
    return updated;
  }

  async deletePantryItem(id: number): Promise<void> {
    await db.delete(pantryItems).where(eq(pantryItems.id, id));
  }

  async getMealPlan(id: string): Promise<MealPlan | undefined> {
    const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, id));
    return plan;
  }

  async getMealPlanByWeek(householdId: string, weekStart: string): Promise<MealPlan | undefined> {
    const [plan] = await db.select().from(mealPlans).where(
      and(eq(mealPlans.householdId, householdId), eq(mealPlans.weekStartDate, weekStart))
    );
    return plan;
  }

  async getMealPlansByHousehold(householdId: string): Promise<MealPlan[]> {
    return db.select().from(mealPlans).where(eq(mealPlans.householdId, householdId));
  }

  async createMealPlan(plan: InsertMealPlan): Promise<MealPlan> {
    const [created] = await db.insert(mealPlans).values(plan).returning();
    return created;
  }

  async upsertMealPlan(householdId: string, weekStart: string, createdBy: string): Promise<MealPlan> {
    const existing = await this.getMealPlanByWeek(householdId, weekStart);
    if (existing) return existing;
    return this.createMealPlan({ householdId, weekStartDate: weekStart, createdBy });
  }

  async getMealPlanEntries(mealPlanId: string): Promise<MealPlanEntry[]> {
    return db.select().from(mealPlanEntries).where(eq(mealPlanEntries.mealPlanId, mealPlanId));
  }

  async createMealPlanEntry(entry: InsertMealPlanEntry): Promise<MealPlanEntry> {
    const [created] = await db.insert(mealPlanEntries).values(entry).returning();
    return created;
  }

  async updateMealPlanEntry(id: number, data: Partial<InsertMealPlanEntry>): Promise<MealPlanEntry> {
    const [updated] = await db.update(mealPlanEntries).set(data).where(eq(mealPlanEntries.id, id)).returning();
    return updated;
  }

  async deleteMealPlanEntry(id: number): Promise<void> {
    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id));
  }

  async deleteMealPlanEntriesBySlot(mealPlanId: string, date: string, slot: string): Promise<void> {
    await db.delete(mealPlanEntries).where(
      and(
        eq(mealPlanEntries.mealPlanId, mealPlanId),
        eq(mealPlanEntries.date, date),
        sql`${mealPlanEntries.mealSlot} = ${slot}`
      )
    );
  }

  async getGroceryList(id: string): Promise<GroceryList | undefined> {
    const [list] = await db.select().from(groceryLists).where(eq(groceryLists.id, id));
    return list;
  }

  async getGroceryListsByHousehold(householdId: string): Promise<GroceryList[]> {
    return db.select().from(groceryLists).where(eq(groceryLists.householdId, householdId));
  }

  async getGroceryListByMealPlan(mealPlanId: string): Promise<GroceryList | undefined> {
    const [list] = await db.select().from(groceryLists).where(eq(groceryLists.mealPlanId, mealPlanId));
    return list;
  }

  async createGroceryList(list: InsertGroceryList): Promise<GroceryList> {
    const [created] = await db.insert(groceryLists).values(list).returning();
    return created;
  }

  async updateGroceryList(id: string, data: Partial<InsertGroceryList>): Promise<GroceryList> {
    const [updated] = await db.update(groceryLists).set(data).where(eq(groceryLists.id, id)).returning();
    return updated;
  }

  async deleteGroceryList(id: string): Promise<void> {
    await db.delete(groceryLists).where(eq(groceryLists.id, id));
  }

  async getGroceryListItems(groceryListId: string): Promise<GroceryListItem[]> {
    return db.select().from(groceryListItems).where(eq(groceryListItems.groceryListId, groceryListId));
  }

  async createGroceryListItem(item: InsertGroceryListItem): Promise<GroceryListItem> {
    const [created] = await db.insert(groceryListItems).values(item).returning();
    return created;
  }

  async updateGroceryListItem(id: number, data: Partial<InsertGroceryListItem>): Promise<GroceryListItem> {
    const [updated] = await db.update(groceryListItems).set(data).where(eq(groceryListItems.id, id)).returning();
    return updated;
  }

  async deleteGroceryListItem(id: number): Promise<void> {
    await db.delete(groceryListItems).where(eq(groceryListItems.id, id));
  }

  async deleteGroceryListItems(groceryListId: string): Promise<void> {
    await db.delete(groceryListItems).where(eq(groceryListItems.groceryListId, groceryListId));
  }

  async bulkCreateGroceryListItems(items: InsertGroceryListItem[]): Promise<GroceryListItem[]> {
    if (items.length === 0) return [];
    return db.insert(groceryListItems).values(items).returning();
  }
}

export const storage = new DatabaseStorage();
