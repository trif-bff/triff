"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { togglePlanItem } from "@/app/(app)/actions";
import { cn } from "@/components/ui";

export function PlanCheck({ id, done }: { id: string; done: boolean }) {
  const [optimistic, set] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      role="checkbox"
      aria-checked={optimistic}
      aria-label={optimistic ? "Marcar como pendiente" : "Marcar como hecha"}
      onClick={() => start(async () => { set(!optimistic); await togglePlanItem(id, !optimistic); })}
      className={cn(
        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
        optimistic ? "border-success bg-success text-white" : "border-border hover:border-primary",
      )}
    >
      {optimistic && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}
