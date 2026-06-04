import { defineType, defineField } from "sanity";

export const manualGroceryItem = defineType({
  name: "manualGroceryItem",
  title: "Manual grocery item",
  type: "object",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "gotIt", type: "boolean", initialValue: false }),
  ],
  preview: {
    select: { title: "name", got: "gotIt" },
    prepare({ title, got }) {
      return { title, subtitle: got ? "got it" : undefined };
    },
  },
});
