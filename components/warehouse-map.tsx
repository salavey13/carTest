"use client"

import { useEffect, useRef } from "react"
import type { Map, Marker } from "mapbox-gl"

interface Warehouse {
  id: string
  name: string
  coordinates: [number, number]
  address: string
}

interface WarehouseMapProps {
  warehouses: Warehouse[]
  onWarehouseSelect?: (warehouse: Warehouse) => void
}

export default function WarehouseMap({ warehouses, onWarehouseSelect }: WarehouseMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<Map | null>(null)
  const markers = useRef<Marker[]>([])

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainer.current) return

    const initializeMap = async () => {
      const mapboxgl = await import("mapbox-gl")
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

      if (!map.current) {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v10",
          center: [37.6173, 55.7558], // Координаты Москвы
          zoom: 9,
        })

        map.current.on("load", () => {
          if (map.current) {
            map.current.resize()
          }
        })
      }

      // Удаляем существующие маркеры
      markers.current.forEach((marker) => marker.remove())
      markers.current = []

      // Добавляем маркеры для каждого склада
      warehouses.forEach((warehouse) => {
        const marker = new mapboxgl.Marker({
          color: "#00ff9d",
        })
          .setLngLat(warehouse.coordinates)
          .addTo(map.current!)

        if (onWarehouseSelect) {
          marker.getElement().addEventListener("click", () => {
            onWarehouseSelect(warehouse)
          })
        }

        markers.current.push(marker)
      })
    }

    initializeMap()

    return () => {
      markers.current.forEach((marker) => marker.remove())
      if (map.current) {
        map.current.remove()
      }
    }
  }, [warehouses, onWarehouseSelect])

  return <div ref={mapContainer} className="h-[400px] rounded-lg" />
}

