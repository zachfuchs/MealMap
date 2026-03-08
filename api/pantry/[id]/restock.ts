import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth";
import { storage } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = authenticate(req, res);
  if (!auth) return;
  const id = parseInt(req.query.id as string);
  try {
    const item = await storage.getPantryItem(id);
    if (!item || item.householdId !== auth.householdId) return res.status(404).json({ error: "Not found" });

    const updatedItem = await storage.updatePantryItem(item.id, { quantityNote: "running low" });

    const lists = await storage.getGroceryListsByHousehold(auth.householdId);
    let list = lists.length > 0 ? lists[lists.length - 1] : null;
    if (!list) {
      list = await storage.createGroceryList({
        householdId: auth.householdId,
        mealPlanId: null,
        name: "Shopping list",
        weekStart: null,
      });
    }

    const existingItems = await storage.getGroceryListItems(list.id);
    const alreadyPresent = existingItems.some(
      i => i.ingredientName.toLowerCase() === item.name.toLowerCase()
    );

    if (!alreadyPresent) {
      await storage.createGroceryListItem({
        groceryListId: list.id,
        ingredientName: item.name,
        totalQuantity: null,
        unit: null,
        category: item.category,
        sourceRecipes: [],
        isChecked: false,
        isPantryCovered: false,
        manuallyAdded: true,
        notes: "Marked as running low in pantry",
      });
    }

    res.json({ pantryItem: updatedItem, listId: list.id, listName: list.name, alreadyPresent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to restock" });
  }
}
