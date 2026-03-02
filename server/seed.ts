import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { users, households, recipes, ingredients, recipeSteps, pantryItems } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  try {
    // Check if seed data already exists
    const existingHouseholds = await db.select().from(households).limit(1);
    if (existingHouseholds.length > 0) return;

    console.log("Seeding database with example data...");

    // Create demo household
    const household = await storage.createHousehold({ name: "The Demo Family" });

    // Create demo users
    const passwordHash = await bcrypt.hash("password123", 10);
    const user1 = await storage.createUser({
      email: "demo@mealmap.app",
      passwordHash,
      displayName: "Alex",
      householdId: household.id,
    });
    await storage.createUser({
      email: "partner@mealmap.app",
      passwordHash,
      displayName: "Jordan",
      householdId: household.id,
    });

    // Seed recipes
    const recipe1 = await storage.createRecipe({
      householdId: household.id,
      createdBy: user1.id,
      title: "Classic Chicken Stir Fry",
      sourceType: "manual",
      description: "A quick and healthy weeknight stir fry with tender chicken and crisp vegetables in a savory sauce.",
      servingsBase: 4,
      prepTimeEstimated: 15,
      cookTimeEstimated: 20,
      tags: ["quick", "weeknight", "high-protein"],
      notes: "Great for meal prep — doubles well and keeps in the fridge for 3 days.",
      cooked: true,
      cookedCount: 8,
      lastCookedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      rating: 5,
      kidFriendly: true,
      kidModificationNotes: "Serve over plain rice, go easy on the garlic.",
      isFavorite: true,
    });

    await storage.bulkCreateIngredients([
      { recipeId: recipe1.id, name: "chicken thighs", quantity: "1.5", unit: "lb", preparation: "cut into 1-inch pieces", category: "meat_seafood", isPantryStaple: false, sortOrder: 0 },
      { recipeId: recipe1.id, name: "broccoli", quantity: "2", unit: "cups", preparation: "cut into florets", category: "produce", isPantryStaple: false, sortOrder: 1 },
      { recipeId: recipe1.id, name: "bell pepper", quantity: "1", unit: "large", preparation: "sliced", category: "produce", isPantryStaple: false, sortOrder: 2 },
      { recipeId: recipe1.id, name: "snap peas", quantity: "1", unit: "cup", preparation: null, category: "produce", isPantryStaple: false, sortOrder: 3 },
      { recipeId: recipe1.id, name: "soy sauce", quantity: "3", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 4 },
      { recipeId: recipe1.id, name: "sesame oil", quantity: "1", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 5 },
      { recipeId: recipe1.id, name: "garlic", quantity: "3", unit: "cloves", preparation: "minced", category: "produce", isPantryStaple: true, sortOrder: 6 },
      { recipeId: recipe1.id, name: "fresh ginger", quantity: "1", unit: "tsp", preparation: "grated", category: "produce", isPantryStaple: false, sortOrder: 7 },
      { recipeId: recipe1.id, name: "cornstarch", quantity: "1", unit: "tbsp", preparation: null, category: "grains_pasta", isPantryStaple: true, sortOrder: 8 },
      { recipeId: recipe1.id, name: "vegetable oil", quantity: "2", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 9 },
    ]);

    await storage.bulkCreateSteps([
      { recipeId: recipe1.id, stepNumber: 1, instruction: "Toss chicken pieces with cornstarch, salt, and pepper. Let sit for 5 minutes.", durationMinutes: 5 },
      { recipeId: recipe1.id, stepNumber: 2, instruction: "Heat oil in a wok or large skillet over high heat. Add chicken and cook until golden, about 5-6 minutes. Remove and set aside.", durationMinutes: 6 },
      { recipeId: recipe1.id, stepNumber: 3, instruction: "Add garlic and ginger to the pan, stir-fry for 30 seconds until fragrant.", durationMinutes: 1 },
      { recipeId: recipe1.id, stepNumber: 4, instruction: "Add broccoli, bell pepper, and snap peas. Stir-fry for 3-4 minutes until tender-crisp.", durationMinutes: 4 },
      { recipeId: recipe1.id, stepNumber: 5, instruction: "Return chicken to the pan. Add soy sauce and sesame oil, toss to coat everything. Serve over rice.", durationMinutes: 2 },
    ]);

    const recipe2 = await storage.createRecipe({
      householdId: household.id,
      createdBy: user1.id,
      title: "Black Bean & Sweet Potato Tacos",
      sourceType: "generated",
      description: "Hearty vegetarian tacos with roasted sweet potato, seasoned black beans, and fresh toppings.",
      servingsBase: 4,
      prepTimeEstimated: 10,
      cookTimeEstimated: 25,
      tags: ["vegetarian", "kid-friendly", "weeknight"],
      notes: "Use corn tortillas for gluten-free. Kids love building their own!",
      cooked: true,
      cookedCount: 3,
      lastCookedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      rating: 4,
      kidFriendly: true,
      kidModificationNotes: "Serve ingredients separately so kids can build their own tacos. Skip jalapeños.",
      isFavorite: false,
    });

    await storage.bulkCreateIngredients([
      { recipeId: recipe2.id, name: "sweet potatoes", quantity: "2", unit: "medium", preparation: "diced into 1/2-inch cubes", category: "produce", isPantryStaple: false, sortOrder: 0 },
      { recipeId: recipe2.id, name: "black beans", quantity: "1", unit: "can", preparation: "drained and rinsed", category: "canned_jarred", isPantryStaple: true, sortOrder: 1 },
      { recipeId: recipe2.id, name: "corn tortillas", quantity: "8", unit: "small", preparation: null, category: "grains_pasta", isPantryStaple: false, sortOrder: 2 },
      { recipeId: recipe2.id, name: "avocado", quantity: "2", unit: "ripe", preparation: "sliced", category: "produce", isPantryStaple: false, sortOrder: 3 },
      { recipeId: recipe2.id, name: "lime", quantity: "1", unit: "large", preparation: "juiced", category: "produce", isPantryStaple: false, sortOrder: 4 },
      { recipeId: recipe2.id, name: "cumin", quantity: "1", unit: "tsp", preparation: null, category: "spices", isPantryStaple: true, sortOrder: 5 },
      { recipeId: recipe2.id, name: "smoked paprika", quantity: "1", unit: "tsp", preparation: null, category: "spices", isPantryStaple: true, sortOrder: 6 },
      { recipeId: recipe2.id, name: "olive oil", quantity: "2", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 7 },
      { recipeId: recipe2.id, name: "fresh cilantro", quantity: "1", unit: "bunch", preparation: "chopped", category: "produce", isPantryStaple: false, sortOrder: 8 },
    ]);

    await storage.bulkCreateSteps([
      { recipeId: recipe2.id, stepNumber: 1, instruction: "Preheat oven to 425°F. Toss sweet potato with olive oil, cumin, paprika, salt and pepper. Roast for 20-25 minutes until caramelized.", durationMinutes: 25 },
      { recipeId: recipe2.id, stepNumber: 2, instruction: "Warm black beans in a small saucepan with a pinch of cumin and salt. Mash slightly with a fork.", durationMinutes: 5 },
      { recipeId: recipe2.id, stepNumber: 3, instruction: "Warm tortillas in a dry skillet or directly over a gas flame until slightly charred.", durationMinutes: 2 },
      { recipeId: recipe2.id, stepNumber: 4, instruction: "Assemble tacos: spread beans, top with sweet potato, avocado, cilantro, and a squeeze of lime.", durationMinutes: 3 },
    ]);

    const recipe3 = await storage.createRecipe({
      householdId: household.id,
      createdBy: user1.id,
      title: "Creamy Tomato Pasta",
      sourceType: "manual",
      description: "A simple, comforting pasta with a rich tomato cream sauce — on the table in 30 minutes.",
      servingsBase: 4,
      prepTimeEstimated: 5,
      cookTimeEstimated: 25,
      tags: ["quick", "weeknight", "kid-friendly", "comfort-food"],
      notes: null,
      cooked: false,
      cookedCount: 0,
      rating: null,
      kidFriendly: true,
      kidModificationNotes: "Kids love this as-is. Add hidden spinach for extra nutrition.",
      isFavorite: false,
    });

    await storage.bulkCreateIngredients([
      { recipeId: recipe3.id, name: "penne pasta", quantity: "12", unit: "oz", preparation: null, category: "grains_pasta", isPantryStaple: true, sortOrder: 0 },
      { recipeId: recipe3.id, name: "crushed tomatoes", quantity: "1", unit: "can", preparation: null, category: "canned_jarred", isPantryStaple: true, sortOrder: 1 },
      { recipeId: recipe3.id, name: "heavy cream", quantity: "0.5", unit: "cup", preparation: null, category: "dairy", isPantryStaple: false, sortOrder: 2 },
      { recipeId: recipe3.id, name: "garlic", quantity: "4", unit: "cloves", preparation: "minced", category: "produce", isPantryStaple: true, sortOrder: 3 },
      { recipeId: recipe3.id, name: "olive oil", quantity: "2", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 4 },
      { recipeId: recipe3.id, name: "parmesan cheese", quantity: "0.5", unit: "cup", preparation: "grated", category: "dairy", isPantryStaple: false, sortOrder: 5 },
      { recipeId: recipe3.id, name: "fresh basil", quantity: "0.25", unit: "cup", preparation: "torn", category: "produce", isPantryStaple: false, sortOrder: 6 },
      { recipeId: recipe3.id, name: "red pepper flakes", quantity: "0.25", unit: "tsp", preparation: null, category: "spices", isPantryStaple: true, sortOrder: 7 },
    ]);

    await storage.bulkCreateSteps([
      { recipeId: recipe3.id, stepNumber: 1, instruction: "Cook pasta according to package directions. Reserve 1 cup pasta water before draining.", durationMinutes: 12 },
      { recipeId: recipe3.id, stepNumber: 2, instruction: "Heat olive oil over medium heat. Sauté garlic and red pepper flakes for 1 minute.", durationMinutes: 1 },
      { recipeId: recipe3.id, stepNumber: 3, instruction: "Add crushed tomatoes and simmer for 10 minutes, stirring occasionally.", durationMinutes: 10 },
      { recipeId: recipe3.id, stepNumber: 4, instruction: "Stir in heavy cream and cook 2 more minutes. Season with salt and pepper.", durationMinutes: 2 },
      { recipeId: recipe3.id, stepNumber: 5, instruction: "Toss pasta with sauce, adding pasta water as needed. Top with parmesan and basil.", durationMinutes: 2 },
    ]);

    const recipe4 = await storage.createRecipe({
      householdId: household.id,
      createdBy: user1.id,
      title: "Sheet Pan Salmon & Vegetables",
      sourceType: "manual",
      description: "An easy, hands-off dinner with flaky salmon and roasted vegetables, all on one pan.",
      servingsBase: 4,
      prepTimeEstimated: 10,
      cookTimeEstimated: 20,
      tags: ["quick", "high-protein", "date-night"],
      notes: "Add a squeeze of lemon just before serving for brightness.",
      cooked: true,
      cookedCount: 2,
      lastCookedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      rating: 4,
      kidFriendly: false,
      kidModificationNotes: null,
      isFavorite: false,
    });

    await storage.bulkCreateIngredients([
      { recipeId: recipe4.id, name: "salmon fillets", quantity: "4", unit: "pieces", preparation: null, category: "meat_seafood", isPantryStaple: false, sortOrder: 0 },
      { recipeId: recipe4.id, name: "asparagus", quantity: "1", unit: "bunch", preparation: "trimmed", category: "produce", isPantryStaple: false, sortOrder: 1 },
      { recipeId: recipe4.id, name: "cherry tomatoes", quantity: "1", unit: "pint", preparation: null, category: "produce", isPantryStaple: false, sortOrder: 2 },
      { recipeId: recipe4.id, name: "olive oil", quantity: "3", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 3 },
      { recipeId: recipe4.id, name: "garlic powder", quantity: "1", unit: "tsp", preparation: null, category: "spices", isPantryStaple: true, sortOrder: 4 },
      { recipeId: recipe4.id, name: "dijon mustard", quantity: "2", unit: "tbsp", preparation: null, category: "condiments_sauces", isPantryStaple: true, sortOrder: 5 },
      { recipeId: recipe4.id, name: "lemon", quantity: "1", unit: "large", preparation: "sliced", category: "produce", isPantryStaple: false, sortOrder: 6 },
    ]);

    await storage.bulkCreateSteps([
      { recipeId: recipe4.id, stepNumber: 1, instruction: "Preheat oven to 425°F. Line a baking sheet with parchment paper.", durationMinutes: 5 },
      { recipeId: recipe4.id, stepNumber: 2, instruction: "Toss asparagus and tomatoes with olive oil, garlic powder, salt, and pepper. Spread on baking sheet.", durationMinutes: 3 },
      { recipeId: recipe4.id, stepNumber: 3, instruction: "Nestle salmon fillets among vegetables. Brush each fillet with Dijon mustard. Season with salt and pepper.", durationMinutes: 3 },
      { recipeId: recipe4.id, stepNumber: 4, instruction: "Bake for 12-15 minutes until salmon is cooked through and flakes easily with a fork.", durationMinutes: 15 },
    ]);

    // Seed pantry items
    const pantryData = [
      { householdId: household.id, name: "olive oil", category: "condiments_sauces" as const, location: "pantry" as const, quantityNote: "full" },
      { householdId: household.id, name: "garlic", category: "produce" as const, location: "pantry" as const, quantityNote: null },
      { householdId: household.id, name: "black beans", category: "canned_jarred" as const, location: "pantry" as const, quantityNote: "2 cans" },
      { householdId: household.id, name: "crushed tomatoes", category: "canned_jarred" as const, location: "pantry" as const, quantityNote: "3 cans" },
      { householdId: household.id, name: "penne pasta", category: "grains_pasta" as const, location: "pantry" as const, quantityNote: "full bag" },
      { householdId: household.id, name: "cumin", category: "spices" as const, location: "pantry" as const, quantityNote: null },
      { householdId: household.id, name: "soy sauce", category: "condiments_sauces" as const, location: "pantry" as const, quantityNote: "almost out" },
      { householdId: household.id, name: "chicken thighs", category: "meat_seafood" as const, location: "fridge" as const, quantityNote: "2 lbs" },
      { householdId: household.id, name: "broccoli", category: "produce" as const, location: "fridge" as const, quantityNote: "1 head" },
      { householdId: household.id, name: "parmesan cheese", category: "dairy" as const, location: "fridge" as const, quantityNote: "half block" },
      { householdId: household.id, name: "heavy cream", category: "dairy" as const, location: "fridge" as const, quantityNote: "1 cup" },
      { householdId: household.id, name: "butter", category: "dairy" as const, location: "fridge" as const, quantityNote: "full" },
      { householdId: household.id, name: "frozen peas", category: "frozen" as const, location: "freezer" as const, quantityNote: null },
      { householdId: household.id, name: "frozen shrimp", category: "frozen" as const, location: "freezer" as const, quantityNote: "1 bag" },
    ];

    for (const item of pantryData) {
      await storage.createPantryItem({
        ...item,
        expiryDate: null,
        autoRestock: false,
      });
    }

    console.log(`Seed complete! Demo login: demo@mealmap.app / password123`);
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}
