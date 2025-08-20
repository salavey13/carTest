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
  const { dbUser, isAdmin, isLoading: appContextLoading } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');

  const [isTrulyAdmin, setIsTrulyAdmin] = useState<boolean>(false);
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isFetchingVehicles, setIsFetchingVehicles] = useState(false);

  const fetchUserVehicles = useCallback(async (userId: string) => {
    setIsFetchingVehicles(true);
    try {
      const { data, error, success } = await getEditableVehiclesForUser(userId);
      
      if (!success || error) {
        throw new Error(error || "Не удалось получить список техники.");
      }
      
      setUserVehicles(data?.filter(v => v.type === 'bike') || []);
      
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

      <main className="container mx-auto pt-10 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-6 md:p-8 bg-dark-card/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-brand-purple/20 border border-brand-purple/50"
        >
          <h2
            className="text-3xl md:text-4xl font-semibold text-brand-purple mb-4 cyber-text glitch flex items-center justify-center gap-3"
            data-text="VIBE CONTROL CENTER"
          >
            <VibeContentRenderer content="::FaSatelliteDish::" className="h-8 w-8 animate-pulse text-shadow-cyber" /> VIBE CONTROL CENTER
          </h2>
          <p className="text-brand-orange mb-8 text-base font-mono text-center">
            {selectedVehicle ? `Редактирование: ${selectedVehicle.make} ${selectedVehicle.model}` : 'Добавь свой байк в систему и стань частью флота.'}
          </p>

          <div className="mb-6 space-y-2">
            <label className="text-sm font-mono text-foreground">УПРАВЛЕНИЕ ГАРАЖОМ</label> {/* Fixed contrast */}
            <div className="flex gap-2">
                <Select onValueChange={handleVehicleSelect} value={selectedVehicle?.id || ""} disabled={isFetchingVehicles || !!editId}>
                    <SelectTrigger className="input-cyber flex-1">
                        <SelectValue placeholder="Выберите байк для редактирования..." />
                    </SelectTrigger>
                    <SelectContent>
                        {userVehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.make} {v.model}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { router.push('/admin'); setSelectedVehicle(null); }}>
                    <VibeContentRenderer content="::FaPlus:: Создать новый"/>
                </Button>
            </div>
          </div>
          
          <CarSubmissionForm ownerId={dbUser?.user_id} vehicleToEdit={selectedVehicle} onSuccess={handleFormSuccess} />

          <div className="mt-10 pt-8 border-t-2 border-dashed border-brand-purple/20 space-y-4 md:space-y-0 md:flex md:justify-center md:items-center md:gap-6">
            <Link
              href="/rent-bike"
              className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-brand-pink bg-brand-pink/10 text-brand-pink rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-pink hover:text-black hover:shadow-pink-glow"
            >
              <VibeContentRenderer content="::FaMotorcycle::" className="mr-3 transition-transform group-hover:rotate-[-5deg]" />
              В МОТО-ГАРАЖ
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