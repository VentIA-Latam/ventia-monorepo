"use client"

import { useState } from "react"
import { PlanCards } from "@/components/dashboard/plan/plan-cards"
import { PlanCheckout } from "@/components/dashboard/plan/plan-checkout"

export function PlanClient() {
  const [view, setView] = useState<"plans" | "checkout">("plans")
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null)

  const handleChoose = (planId: string) => {
    setChosenPlanId(planId)
    setView("checkout")
  }

  const handleBack = () => {
    setView("plans")
    setChosenPlanId(null)
  }

  if (view === "checkout" && chosenPlanId) {
    return <PlanCheckout planId={chosenPlanId} onBack={handleBack} />
  }

  return <PlanCards onChoose={handleChoose} />
}
