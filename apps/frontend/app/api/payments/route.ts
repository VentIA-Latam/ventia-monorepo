import { NextResponse } from "next/server"
import { mockPayments } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockPayments)
}
