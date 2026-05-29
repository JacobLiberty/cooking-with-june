import { defineType, defineField } from "sanity";
import { UserIcon } from "@sanity/icons";

export const editor = defineType({
  name: "editor",
  title: "Editor",
  type: "document",
  icon: UserIcon,
  description:
    "A person allowed to edit recipes and leave ratings. Email must match their Google sign-in.",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      description: "Google account email used to sign in",
      validation: (rule) => rule.required().email(),
    }),
  ],
  preview: { select: { title: "name", subtitle: "email" } },
});
