import { defineType, defineField } from "sanity";

export const rating = defineType({
  name: "rating",
  title: "Rating",
  type: "object",
  fields: [
    defineField({
      name: "editor",
      title: "Editor",
      type: "reference",
      to: [{ type: "editor" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "value",
      title: "Stars",
      type: "number",
      description: "0 to 5, in half-star steps",
      validation: (rule) =>
        rule
          .required()
          .min(0)
          .max(5)
          .precision(1)
          .custom((v) =>
            v === undefined || (v * 2) % 1 === 0
              ? true
              : "Use half-star steps (e.g. 3.5)",
          ),
    }),
  ],
  preview: {
    select: { value: "value" },
    prepare({ value }) {
      return { title: `${value ?? "?"} ★` };
    },
  },
});
