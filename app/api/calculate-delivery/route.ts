// /app/api/calculate-delivery/route.ts
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const data = await request.json()

  // Mock delivery calculation
  const deliveryOptions = [
    {
      id: "1",
      price: 500,
      estimatedDays: 1,
      warehouseId: data.warehouseId,
    },
    {
      id: "2",
      price: 300,
      estimatedDays: 2,
      warehouseId: data.warehouseId,
    },
    {
      id: "3",
      price: 200,
      estimatedDays: 3,
      warehouseId: data.warehouseId,
    },
  ]

  return NextResponse.json({ deliveryOptions })
}

