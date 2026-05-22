import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getAccessToken } from "@/lib/auth0"
import { getCurrentUser } from "@/lib/services/user-service"
import { TicketsClient } from "./tickets-client"

export const dynamic = "force-dynamic"

export default async function TicketsPage() {
  const token = await getAccessToken()
  if (!token) redirect("/auth/login")

  const user = await getCurrentUser(token)
  const role = user.role?.toUpperCase()

  if (role !== "ADMIN") {
    redirect("/dashboard/get-started")
  }

  return (
    <Suspense>
      <TicketsClient />
    </Suspense>
  )
}
