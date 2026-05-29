import { defineType, defineField } from "sanity";

export const ingredientLine = defineType({
  name: "ingredientLine",
  title: "Ingredient",
  type: "object",
  fields: [
    defineField({
      name: "ingredient",
      title: "Ingredient",
      type: "reference",
      to: [{ type: "ingredient" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "quantity",
      title: "Quantity",
      type: "string",
      description: 'e.g. "1", "1/2", "2-3"',
    }),
    defineField({
      name: "unit",
      title: "Unit",
      type: "string",
      description: 'e.g. "lb", "cup", "tbsp"',
    }),
    defineField({
      name: "note",
      title: "Note",
      type: "string",
      description: 'e.g. "finely chopped"',
    }),
  ],
  preview: {
    select: { quantity: "quantity", unit: "unit", note: "note" },
    prepare({ quantity, unit, note }) {
      const left = [quantity, unit].filter(Boolean).join(" ");
      return { title: left || "Ingredient", subtitle: note };
    },
  },
});
