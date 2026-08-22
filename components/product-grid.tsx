// /components/product-grid.tsx
import ProductCard from "./product-card"

const MOCK_PRODUCTS = [
  {
    id: "1",
    name: "Quantum Processor",
    price: 999.99,
    image: "/placeholder.svg",
  },
  {
    id: "2",
    name: "Neural Interface",
    price: 599.99,
    image: "/placeholder.svg",
  },
  // Add more products as needed
]

export default function ProductGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {MOCK_PRODUCTS.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  )
}

