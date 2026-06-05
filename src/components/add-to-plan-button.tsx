"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToPlan, removeFromPlan } from "@/app/actions/plan-actions";

export function AddToPlanButton({
  recipeId,
  inPlan,
}: {
  recipeId: string;
  inPlan: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function go() {
    start(async () => {
      if (inPlan) await removeFromPlan(recipeId);
      else await addToPlan(recipeId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      aria-pressed={inPlan}
      className={`kicker border px-3 py-1 disabled:opacity-50 ${
        inPlan
          ? "border-terracotta bg-terracotta-wash text-terracotta"
          : "border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      }`}
    >
      {inPlan ? "In your plan" : "Add to plan"}
    </button>
  );
}
