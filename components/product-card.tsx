"use client"

import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ProductCardProps {
  id: string
  name: string
  price: number
  image: string
}

export default function ProductCard({ id, name, price, image }: ProductCardProps) {
  return (
    <Card className="bg-black/50 border-[#00ff9d]/20 hover:border-[#00ff9d] transition-colors">
      <CardContent className="p-4">
        <div className="aspect-square relative mb-3">
          <Image src={image || "/placeholder.svg"} alt={name} fill className="object-cover rounded-lg" />
        </div>
        <h3 className="font-mono text-[#00ff9d]">{name}</h3>
        <p className="text-lg font-bold font-mono text-[#00ffff] mt-2">¥ {price.toLocaleString()}</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full bg-[#00ff9d] text-black hover:bg-[#00ffff] font-mono">ДОБАВИТЬ_В_КОРЗИНУ//</Button>
      </CardFooter>
    </Card>
  )
}

