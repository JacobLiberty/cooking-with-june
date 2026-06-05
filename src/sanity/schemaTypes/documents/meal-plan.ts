import { defineType, defineField, defineArrayMember } from "sanity";
import { CalendarIcon } from "@sanity/icons";

export const mealPlan = defineType({
  name: "mealPlan",
  title: "Meal plan",
  type: "document",
  icon: CalendarIcon,
  description:
    "The shared household plan + grocery list. There is a single document with id 'mealPlan'.",
  fields: [
    defineField({
      name: "recipes",
      title: "Planned recipes",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "recipe" }] })],
    }),
    defineField({
      name: "manualItems",
      title: "Manual grocery items",
      type: "array",
      of: [defineArrayMember({ type: "manualGroceryItem" })],
    }),
    defineField({
      name: "groceryIngredients",
      title: "Grocery-list ingredient ids",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
    defineField({
      name: "pantryIngredients",
      title: "Pantry ingredient ids (things we have)",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
  ],
  preview: { prepare: () => ({ title: "Meal plan" }) },
});
