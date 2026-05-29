import { defineType, defineField } from "sanity";

export const recipeNote = defineType({
  name: "recipeNote",
  title: "Note",
  type: "object",
  fields: [
    defineField({
      name: "author",
      title: "Author",
      type: "string",
      description: 'e.g. "Lily"',
    }),
    defineField({
      name: "text",
      title: "Note",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { text: "text", author: "author" },
    prepare({ text, author }) {
      return { title: text, subtitle: author };
    },
  },
});
