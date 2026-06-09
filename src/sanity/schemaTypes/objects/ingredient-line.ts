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
    defineField({
      name: "optional",
      title: "Optional",
      type: "boolean",
      description:
        "Nice-to-have, not required. Optional ingredients don't count toward the pantry “most/all” match.",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      quantity: "quantity",
      unit: "unit",
      note: "note",
      optional: "optional",
    },
    prepare({ quantity, unit, note, optional }) {
      const left = [quantity, unit].filter(Boolean).join(" ");
      const subtitle = [note, optional ? "optional" : null]
        .filter(Boolean)
        .join(" · ");
      return { title: left || "Ingredient", subtitle: subtitle || undefined };
    },
  },
});
