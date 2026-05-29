import { defineType, defineField } from "sanity";
import { TagIcon } from "@sanity/icons";

export const ingredient = defineType({
  name: "ingredient",
  title: "Ingredient",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: 'Canonical ingredient name, e.g. "ground beef"',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Produce", value: "produce" },
          { title: "Protein", value: "protein" },
          { title: "Dairy", value: "dairy" },
          { title: "Pantry", value: "pantry" },
          { title: "Spice", value: "spice" },
          { title: "Other", value: "other" },
        ],
      },
    }),
  ],
  preview: { select: { title: "name", subtitle: "category" } },
});
