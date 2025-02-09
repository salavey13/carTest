import type React from "react"
import Image from "next/image"
import Link from "next/link"

interface CarResult {
  id: string
  make: string
  model: string
  description?: string
  image_url?: string
  rent_link?: string
  similarity?: number
  specs?: any
}

interface ResultDisplayProps {
  result: CarResult
  similarCars: CarResult[]
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, similarCars }) => {
  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-4">
          Your Perfect Match: {result.make} {result.model}
        </h2>
        <div className="relative h-64 w-full mb-4">
          <Image
            src={result.image_url || "/placeholder.svg"}
            alt={`${result.make} ${result.model}`}
            layout="fill"
            objectFit="cover"
            className="rounded-lg"
          />
        </div>
        <p className="text-lg mb-4">{result.description}</p>
        {result.rent_link && (
          <Link
            href={result.rent_link}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Rent Now
          </Link>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold mb-4">Similar Cars</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {similarCars.map((car) => (
            <div key={car.id} className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="relative h-40 w-full mb-2">
                <Image
                  src={car.image_url || "/placeholder.svg"}
                  alt={`${car.make} ${car.model}`}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-lg"
                />
              </div>
              <h4 className="text-xl font-semibold">
                {car.make} {car.model}
              </h4>
              <p className="text-sm text-gray-400 mb-2">Similarity: {(car.similarity! * 100).toFixed(2)}%</p>
              {car.rent_link && (
                <Link href={car.rent_link} className="text-blue-400 hover:text-blue-300">
                  View Details
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ResultDisplay

