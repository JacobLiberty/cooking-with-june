import { defineType, defineField } from "sanity";

export const macroSet = defineType({
  name: "macroSet",
  title: "Macros",
  type: "object",
  fields: [
    defineField({ name: "calories", title: "Calories (kcal)", type: "number" }),
    defineField({ name: "protein", title: "Protein (g)", type: "number" }),
    defineField({ name: "carbs", title: "Carbohydrate (g)", type: "number" }),
    defineField({ name: "fat", title: "Total fat (g)", type: "number" }),
  ],
});
