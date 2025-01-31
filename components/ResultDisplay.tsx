"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { supabase } from "@/hooks/supabase"

let supabase = null


export default function ResultDisplay({ result }) {
  const [similarCars, setSimilarCars] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSimilarCars = async () => {
      try {
        const { data, error } = await supabase.rpc("similar_cars", {
          car_id: result.id,
          match_count: 3,
        })

        if (error) throw error
        if (data) setSimilarCars(data)
      } catch (error) {
        console.error("Error fetching similar cars:", error)
        setError("Failed to fetch similar cars")
      }
    }

    fetchSimilarCars()
  }, [result.id])

  return (
    <div className="space-y-8">
      <Card className="bg-black/50 border-[#00ff9d]/20">
        <CardHeader>
          <CardTitle className="text-[#00ff9d] font-mono text-2xl">
            ТВОЙ_КИБЕР-СУПЕРКАР: {result.car.toUpperCase()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Image
            src={result.image_url || "/placeholder.svg"}
            alt={result.car}
            width={400}
            height={200}
            className="rounded-lg mb-4"
          />
          <p className="text-[#00ffff] font-mono">{result.description}</p>
        </CardContent>
      </Card>

      <div className="similar-cars">
        <h3 className="text-[#ff00ff] font-mono text-xl mb-4">ПОХОЖИЕ_КИБЕР-ТАЧКИ_ДЛЯ_АРЕНДЫ:</h3>
        {error ? (
          <p className="text-[#ff0000] font-mono">{error}</p>
        ) : similarCars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {similarCars.map((car) => (
              <Card key={car.id} className="bg-black/50 border-[#00ff9d]/20 hover:border-[#00ff9d] transition-colors">
                <CardContent className="p-4">
                  <Image
                    src={car.image_url || "/placeholder.svg"}
                    alt={car.model}
                    width={200}
                    height={100}
                    className="rounded-lg mb-2"
                  />
                  <h4 className="text-[#00ff9d] font-mono">
                    {car.make.toUpperCase()} {car.model.toUpperCase()}
                  </h4>
                  <p className="text-[#00ffff] font-mono">{car.daily_price}¥/ДЕНЬ</p>
                  <Button className="w-full mt-2 bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono">
                    <a href={car.rent_link}>АРЕНДОВАТЬ_СЕЙЧАС//</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-[#00ff9d] font-mono">ПОХОЖИЕ_МАШИНЫ_НЕ_НАЙДЕНЫ//</p>
        )}
      </div>
    </div>
  )
}

