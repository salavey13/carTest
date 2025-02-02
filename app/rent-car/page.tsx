"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/hooks/supabase";  // Ensure you import supabase for fetching data
import SemanticSearch from "@/components/SemanticSearch";  // Assuming the search component is available

export default function RentCar() {
  const [selectedCar, setSelectedCar] = useState(null);
  const [rentDays, setRentDays] = useState(1);
  const [cars, setCars] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");  // New search query state

  // Fetch cars from Supabase
  useEffect(() => {
    const fetchCars = async () => {
      const { data, error } = await supabase.from("cars").select("*");
      if (error) {
        console.error("Error fetching cars:", error);
      } else {
        setCars(data || []);
      }
    };
    fetchCars();
  }, []);

  const handleRent = () => {
    if (selectedCar) {
      alert(`Вы арендовали ${selectedCar.name} на ${rentDays} дней за ${selectedCar.price * rentDays}¥`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff9d] pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-mono">АРЕНДА_КИБЕР-МАШИНЫ//</h1>

        {/* Integrate SemanticSearch Component */}
        <div className="mb-8">
          <SemanticSearch />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-black/50 border-[#00ff9d]/20">
            <CardHeader>
              <CardTitle className="text-[#00ff9d] font-mono">ВЫБЕРИТЕ_МАШИНУ//</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                onValueChange={(value) => setSelectedCar(cars.find((car) => car.id === value))}
                className="bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono"
              >
                <SelectTrigger>
                  <SelectValue placeholder="ВЫБЕРИТЕ_МОДЕЛЬ//" />
                </SelectTrigger>
                <SelectContent className="bg-black border-[#00ff9d]/20">
                  {cars.map((car) => (
                    <SelectItem key={car.id} value={car.id} className="text-[#00ff9d] font-mono">
                      {car.make} {car.model} - {car.daily_price}¥/день
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4">
                <label className="text-sm font-mono">КОЛИЧЕСТВО_ДНЕЙ//</label>
                <Input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Number.parseInt(e.target.value))}
                  className="bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono mt-1"
                />
              </div>
              <Button
                onClick={handleRent}
                disabled={!selectedCar}
                className="w-full mt-4 bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono"
              >
                АРЕНДОВАТЬ//
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-black/50 border-[#00ff9d]/20">
            <CardHeader>
              <CardTitle className="text-[#00ff9d] font-mono">ИНФО_О_МАШИНЕ//</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCar ? (
                <>
                  <Image
                    src={selectedCar.image_url || "/placeholder.svg"}
                    alt={selectedCar.make}
                    width={200}
                    height={200}
                    className="mx-auto mb-4"
                  />
                  <p className="text-cyan-400  font-mono">{selectedCar.make} {selectedCar.model}</p>
                  <p className="text-cyan-400  font-mono">{selectedCar.daily_price}¥/день</p>
                  <p className="text-cyan-400  font-mono mt-4">ИТОГО: {selectedCar.daily_price * rentDays}¥</p>
                </>
              ) : (
                <p className="text-center font-mono">ВЫБЕРИТЕ_МАШИНУ_ДЛЯ_ПРОСМОТРА_ИНФО//</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

