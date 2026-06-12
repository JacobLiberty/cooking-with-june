import { redirect } from "next/navigation";

// The manual create form is retired — all recipes come through the import pipeline.
export default function NewRecipePage() {
  redirect("/submit");
}
