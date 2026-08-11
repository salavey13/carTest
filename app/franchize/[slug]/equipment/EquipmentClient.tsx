// app/franchize/[slug]/equipment/EquipmentClient.tsx
//
// I5 — Equipment rentals client component
"use client";

import { useState, useEffect } from "react";
import { Calendar, DollarSign, Package, CheckCircle, AlertTriangle } from "lucide-react";

interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  type: string;
}

interface EquipmentRental {
  id: string;
  equipmentId: string;
  equipmentLabel: string;
  status: string;
  dailyPrice: number;
  totalCost: number;
  startDate: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  renterUserId: string | null;
}

interface EquipmentClientProps {
  slug: string;
}

export function EquipmentClient({ slug }: EquipmentClientProps) {
  const [catalog, setCatalog] = useState<EquipmentItem[]>([]);
  const [rentals, setRentals] = useState<EquipmentRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [rentalForm, setRentalForm] = useState({
    renterUserId: "",
    expectedReturnDate: "",
    dailyPrice: 0,
  });

  useEffect(() => {
    loadCatalog();
    loadRentals();
  }, [slug]);

  const loadCatalog = async () => {
    try {
      // Mock: In real implementation, call server action to get equipment catalog
      // const result = await getEquipmentCatalog({ slug });
      setCatalog([
        { id: "equip-helmet-l", make: "MT", model: "Helmet L", daily_price: 200, type: "equipment" },
        { id: "equip-jacket-m", make: "MT", model: "Jacket M", daily_price: 300, type: "equipment" },
        { id: "equip-gloves-m", make: "MT", model: "Gloves M", daily_price: 100, type: "equipment" },
      ]);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  const loadRentals = async () => {
    try {
      // Mock: In real implementation, call listEquipmentRentals
      setLoading(false);
    } catch (err) {
      console.error("Failed to load rentals:", err);
      setLoading(false);
    }
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;

    try {
      // Mock: await createEquipmentRental({ slug, equipmentId, ... })
      alert(`Создана аренда: ${selectedEquipment.make} ${selectedEquipment.model}`);
      setShowRentalForm(false);
      setSelectedEquipment(null);
      loadRentals();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleReturn = async (id: string, condition: "returned" | "damaged" | "lost") => {
    try {
      // Mock: await returnEquipmentRental({ slug, id, condition })
      alert(`Экипировка возвращена: ${condition}`);
      loadRentals();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const activeRentals = rentals.filter((r) => r.status === "active");

  return (
    <div className="space-y-8">
      {/* Catalog Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Каталог экипировки
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-semibold text-lg">{item.make} {item.model}</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {item.daily_price} ₽/день
              </p>
              <button
                onClick={() => {
                  setSelectedEquipment(item);
                  setRentalForm({ ...rentalForm, dailyPrice: item.daily_price });
                  setShowRentalForm(true);
                }}
                className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Сдать в аренду
              </button>
            </div>
          ))}
        </div>

        {catalog.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Нет экипировки в каталоге
          </div>
        )}
      </section>

      {/* Active Rentals Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Активные аренды
          {activeRentals.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({activeRentals.length})
            </span>
          )}
        </h2>

        {loading ? (
          <div className="text-center py-4">Загрузка...</div>
        ) : activeRentals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
            Нет активных аренд экипировки
          </div>
        ) : (
          <div className="space-y-3">
            {activeRentals.map((rental) => (
              <div
                key={rental.id}
                className="border rounded-lg p-4 bg-card flex items-center justify-between"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{rental.equipmentLabel}</h4>
                  <div className="text-sm text-muted-foreground mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3" />
                      {rental.dailyPrice} ₽/день (всего: {rental.totalCost} ₽)
                    </div>
                    {rental.expectedReturnDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        До: {new Date(rental.expectedReturnDate).toLocaleDateString("ru-RU")}
                      </div>
                    )}
                    {rental.renterUserId && (
                      <div>Арендатор: {rental.renterUserId}</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReturn(rental.id, "returned")}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Возвращён
                  </button>
                  <button
                    onClick={() => handleReturn(rental.id, "damaged")}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  >
                    Повреждён
                  </button>
                  <button
                    onClick={() => handleReturn(rental.id, "lost")}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Утерян
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rental Form Modal */}
      {showRentalForm && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">Сдача в аренду</h3>
            <p className="text-sm text-muted-foreground">
              {selectedEquipment.make} {selectedEquipment.model}
            </p>

            <form onSubmit={handleCreateRental} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ID арендатора (опционально)</label>
                <input
                  type="text"
                  value={rentalForm.renterUserId}
                  onChange={(e) => setRentalForm({ ...rentalForm, renterUserId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="user-123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Дата возврата (опционально)</label>
                <input
                  type="date"
                  value={rentalForm.expectedReturnDate}
                  onChange={(e) => setRentalForm({ ...rentalForm, expectedReturnDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Цена за день (₽)</label>
                <input
                  type="number"
                  value={rentalForm.dailyPrice}
                  onChange={(e) => setRentalForm({ ...rentalForm, dailyPrice: Number(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Создать аренду
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRentalForm(false);
                    setSelectedEquipment(null);
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-accent"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
