import { defineType, defineField, defineArrayMember } from "sanity";
import { DocumentTextIcon } from "@sanity/icons";

export const recipe = defineType({
  name: "recipe",
  title: "Recipe",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Short blurb shown on cards and the top of the recipe",
    }),
    defineField({
      name: "story",
      title: "Story",
      type: "text",
      rows: 4,
      description: 'Optional "from our kitchen" story',
    }),
    defineField({
      name: "images",
      title: "Photos",
      type: "array",
      of: [defineArrayMember({ type: "image", options: { hotspot: true } })],
      validation: (rule) => rule.required().min(1).error("Add at least one photo"),
    }),
    defineField({
      name: "ingredients",
      title: "Ingredients",
      type: "array",
      of: [defineArrayMember({ type: "ingredientLine" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      of: [defineArrayMember({ type: "text", rows: 2 })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "prepTime",
      title: "Prep time (minutes)",
      type: "number",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "cookTime",
      title: "Cook time (minutes)",
      type: "number",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "servings",
      title: "Servings",
      type: "number",
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "tag" }] })],
    }),
    defineField({
      name: "macros",
      title: "Nutrition (per serving)",
      type: "object",
      description:
        "Auto-estimated from USDA data. base = required ingredients only; full = including optional ones.",
      fields: [
        defineField({
          name: "base",
          title: "Per serving — required only",
          type: "macroSet",
        }),
        defineField({
          name: "full",
          title: "Per serving — including optional",
          type: "macroSet",
        }),
        defineField({
          name: "estimated",
          title: "Estimated",
          type: "boolean",
          description: "Approximate values computed from USDA data.",
        }),
        defineField({ name: "computedAt", title: "Computed at", type: "datetime" }),
        defineField({
          name: "unparsedLines",
          title: "Skipped ingredients",
          type: "array",
          of: [defineArrayMember({ type: "string" })],
          description: "Lines we couldn't convert to grams or match in USDA.",
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", media: "images.0" },
  },
});
