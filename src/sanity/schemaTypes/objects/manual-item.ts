import { defineType, defineField } from "sanity";

export const manualGroceryItem = defineType({
  name: "manualGroceryItem",
  title: "Manual grocery item",
  type: "object",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "location",
      type: "string",
      title: "Where it lives",
      options: { list: ["grocery", "pantry"], layout: "radio" },
      initialValue: "grocery",
    }),
  ],
  preview: {
    select: { title: "name", location: "location" },
    prepare({ title, location }) {
      return { title, subtitle: location === "pantry" ? "pantry" : "grocery" };
    },
  },
});
