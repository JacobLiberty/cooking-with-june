import { defineType, defineField } from "sanity";
import { PackageIcon } from "@sanity/icons";

export const ingredient = defineType({
  name: "ingredient",
  title: "Ingredient",
  type: "document",
  icon: PackageIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: 'Canonical ingredient name, e.g. "ground beef"',
      // Required + case-insensitive uniqueness — duplicate ingredients would
      // fracture the pantry filter (Phase 4), so guard them at authoring time.
      validation: (rule) =>
        rule.required().custom(async (name, context) => {
          if (!name) return true;
          const client = context.getClient({ apiVersion: "2026-02-01" });
          const id = context.document?._id?.replace(/^drafts\./, "") ?? "";
          const duplicates = await client.fetch<number>(
            `count(*[_type == "ingredient" && lower(name) == lower($name) && !(_id in [$id, "drafts." + $id])])`,
            { name, id },
          );
          return duplicates === 0 || "An ingredient with this name already exists";
        }),
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
          { title: "Non-food", value: "nonfood" },
        ],
      },
    }),
    defineField({
      name: "canonicalUnitKind",
      title: "Canonical unit kind",
      type: "string",
      description: "How this ingredient is fundamentally measured.",
      options: {
        list: [
          { title: "Mass", value: "mass" },
          { title: "Volume", value: "volume" },
          { title: "Count", value: "count" },
        ],
      },
    }),
    defineField({
      name: "density",
      title: "Density (g/ml)",
      type: "number",
      description: "Only meaningful for volume-kind ingredients (e.g. flour 0.53).",
    }),
    defineField({
      name: "avgUnitGrams",
      title: "Average grams per item",
      type: "number",
      description: "Only meaningful for count-kind ingredients (e.g. egg 50).",
    }),
    defineField({
      name: "restockQuantity",
      title: "Default restock quantity",
      type: "object",
      description: 'A typical purchase, e.g. 1 "dozen" or 5 "lb".',
      fields: [
        defineField({ name: "quantity", title: "Quantity", type: "number" }),
        defineField({ name: "unit", title: "Unit", type: "string" }),
      ],
    }),
  ],
  preview: { select: { title: "name", subtitle: "category" } },
});
