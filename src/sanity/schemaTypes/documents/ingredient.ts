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
        ],
      },
    }),
  ],
  preview: { select: { title: "name", subtitle: "category" } },
});
