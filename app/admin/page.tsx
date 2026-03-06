// /app/admin/page.tsx
"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from "@/contexts/AppContext";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import Link from "next/link";
import { motion } from "framer-motion";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import type { Database } from "@/types/database.types";

type Vehicle = Database['public']['Tables']['cars']['Row'];

function AdminPageContent() {
  const { dbUser, userCrewInfo, isAdmin, isLoading: appContextLoading } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');

  const [isTrulyAdmin, setIsTrulyAdmin] = useState<boolean>(false);
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isFetchingVehicles, setIsFetchingVehicles] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "bike" | "car">("all");

  const fetchUserVehicles = useCallback(async (userId: string) => {
    setIsFetchingVehicles(true);
    try {
      const { data, error, success } = await getEditableVehiclesForUser(userId);
      
      if (!success || error) {
        throw new Error(error || "Не удалось получить список техники.");
      }
      
      setUserVehicles((data || []).filter(v => v.type === 'bike' || v.type === 'car'));
      
      if(editId) {
        const vehicleToEdit = data?.find(v => v.id === editId);
        if (vehicleToEdit) {
            setSelectedVehicle(vehicleToEdit);
            toast.info(`Загружен для редактирования: ${vehicleToEdit.make} ${vehicleToEdit.model}`);
        } else {
            toast.error(`Транспорт с ID ${editId} не найден в вашем гараже или команде.`);
        }
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить вашу технику.");
    } finally {
      setIsFetchingVehicles(false);
    }
  }, [editId]);

  useEffect(() => {
    if (!appContextLoading && dbUser?.user_id) {
      if (typeof isAdmin === 'function') {
        setIsTrulyAdmin(isAdmin());
      }
      fetchUserVehicles(dbUser.user_id);
    }
  }, [appContextLoading, dbUser, isAdmin, fetchUserVehicles]);

  const visibleVehicles = userVehicles.filter((vehicle) => typeFilter === "all" ? true : vehicle.type === typeFilter);

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = userVehicles.find(v => v.id === vehicleId);
    setSelectedVehicle(vehicle || null);
  };
  
  const handleFormSuccess = () => {
      if (dbUser?.user_id) {
        fetchUserVehicles(dbUser.user_id);
      }
      if (!editId) {
          setSelectedVehicle(null);
      }
  };

  if (appContextLoading) { 
    return <Loading text="ПРОВЕРКА ДОСТУПА..." />;
  }
  
  return (
    <div className="min-h-screen pt-24 bg-black relative overflow-hidden">
        <div className="fixed inset-0 z-[-1] opacity-20">
            <Image
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
            alt="Admin Background"
            fill
            className="object-cover animate-pan-zoom"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
        </div>

      <main className="container mx-auto pt-6 px-3 sm:px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 bg-dark-card/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-brand-purple/20 border border-brand-purple/50"
        >
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-brand-purple mb-4 cyber-text glitch flex items-center justify-center gap-3"
            data-text="VIBE CONTROL CENTER"
          >
            <VibeContentRenderer content="::FaSatelliteDish::" className="h-8 w-8 animate-pulse text-shadow-cyber" /> VIBE CONTROL CENTER
          </h2>
          <p className="text-brand-orange mb-6 text-sm sm:text-base font-mono text-center">
            {selectedVehicle ? `Редактирование: ${selectedVehicle.make} ${selectedVehicle.model}` : 'Добавь свой байк в систему и стань частью флота.'}
          </p>

          <div className="mb-6 space-y-3">
            <label className="text-sm font-mono text-foreground">УПРАВЛЕНИЕ ГАРАЖОМ</label> {/* Fixed contrast */}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Select onValueChange={handleVehicleSelect} value={selectedVehicle?.id || ""} disabled={isFetchingVehicles || !!editId}>
                    <SelectTrigger className="input-cyber flex-1">
                        <SelectValue placeholder="Выберите байк для редактирования..." />
                    </SelectTrigger>
                    <SelectContent>
                        {visibleVehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.type === "car" ? "🚗" : "🏍️"} {v.make} {v.model}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => { router.push('/admin'); setSelectedVehicle(null); }}>
                    <VibeContentRenderer content="::FaPlus:: Создать новый"/>
                </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" variant={typeFilter === "all" ? "default" : "outline"} onClick={() => setTypeFilter("all")}>Все ({userVehicles.length})</Button>
              <Button type="button" variant={typeFilter === "bike" ? "default" : "outline"} onClick={() => setTypeFilter("bike")}>Байки ({userVehicles.filter((v) => v.type === "bike").length})</Button>
              <Button type="button" variant={typeFilter === "car" ? "default" : "outline"} onClick={() => setTypeFilter("car")}>Авто ({userVehicles.filter((v) => v.type === "car").length})</Button>
            </div>
            <p className="text-xs text-brand-orange/90">Для генерации договоров добавляй VIN в specs (ключ: <code>vin</code>) у bike/car карточек.</p>
          </div>
          
          <CarSubmissionForm ownerId={dbUser?.user_id} vehicleToEdit={selectedVehicle} onSuccess={handleFormSuccess} />

          <div className="mt-10 pt-8 border-t-2 border-dashed border-brand-purple/20 space-y-4 md:space-y-0 md:flex md:justify-center md:items-center md:gap-6">
            <Link
              href="/franchize/vip-bike"
              className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-brand-pink bg-brand-pink/10 text-brand-pink rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-pink hover:text-black hover:shadow-pink-glow"
            >
              <VibeContentRenderer content="::FaMotorcycle::" className="mr-3 transition-transform group-hover:rotate-[-5deg]" />
              В МОТО-ГАРАЖ
            </Link>

            <Link
              href={`/franchize/${userCrewInfo?.slug || "vip-bike"}/admin`}
              className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-yellow-400 bg-yellow-400/10 text-yellow-300 rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-yellow-400 hover:text-black"
            >
              <VibeContentRenderer content="::FaFileContract::" className="mr-3" />
              FRANCHIZE DOC HUB
            </Link>

            {isTrulyAdmin && (
                 <Link
                    href="/paddock"
                    className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-brand-cyan bg-brand-cyan/10 text-brand-cyan rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-cyan hover:text-black hover:shadow-cyan-glow"
                >
                    <VibeContentRenderer content="::FaWarehouse::" className="mr-3 transition-transform group-hover:-translate-x-1" />
                    МОЙ ПАДДОК
                 </Link>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<Loading text="Загрузка параметров..." />}>
            <AdminPageContent />
        </Suspense>
    );
}