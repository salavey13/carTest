"use client";
/**
 * Vibe Control Center — Admin Dashboard v2.1
 * 
 * 🎯 Fixed: Mobile overflow, removed footer, improved calibrator integration
 * 🛠️ Mobile-first responsive design with proper overflow handling
 */

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from "@/contexts/AppContext";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";

type Vehicle = Database['public']['Tables']['cars']['Row'];

// === QUICK STATS COMPONENT ===
function AdminQuickStats({ vehicles, isAdmin }: { vehicles: Vehicle[]; isAdmin: boolean }) {
  const stats = useMemo(() => {
    const bikes = vehicles.filter(v => v.type === 'bike').length;
    const cars = vehicles.filter(v => v.type === 'car').length;
    const withVin = vehicles.filter(v => v.specs?.vin).length;
    
    return [
      { label: "Байки", value: bikes, icon: "::FaMotorcycle::", color: "text-brand-pink", bg: "bg-brand-pink/10" },
      { label: "Авто", value: cars, icon: "::FaCar::", color: "text-brand-cyan", bg: "bg-brand-cyan/10" },
      { label: "С VIN", value: withVin, icon: "::FaFileSignature::", color: "text-brand-lime", bg: "bg-brand-lime/10" },
      { label: "Доступ", value: isAdmin ? "ADMIN" : "USER", icon: isAdmin ? "::FaShieldHalved::" : "::FaUser::", color: isAdmin ? "text-amber-400" : "text-zinc-400", bg: isAdmin ? "bg-amber-400/10" : "bg-zinc-400/10" },
    ];
  }, [vehicles, isAdmin]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn("rounded-xl border border-white/10 p-3 sm:p-4 backdrop-blur-sm", stat.bg)}
        >
          <div className={cn("mb-1 sm:mb-2", stat.color)}>
            <VibeContentRenderer content={stat.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="text-lg sm:text-2xl font-bold text-white font-orbitron">{stat.value}</div>
          <div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

// === VEHICLE CARD COMPONENT ===
function VehicleCard({ vehicle, onSelect, isSelected }: { vehicle: Vehicle; onSelect: (v: Vehicle) => void; isSelected: boolean }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(vehicle)}
      className={cn(
        "w-full text-left rounded-xl border p-3 sm:p-4 transition-all duration-200",
        "bg-dark-card/60 hover:bg-dark-card/80 backdrop-blur-sm",
        isSelected 
          ? "border-brand-lime/50 ring-2 ring-brand-lime/30 shadow-lg shadow-brand-lime/10" 
          : "border-white/10 hover:border-white/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg shrink-0">{vehicle.type === 'bike' ? '🏍️' : '🚗'}</span>
          <div className="min-w-0">
            <div className="font-medium text-white truncate">{vehicle.make} {vehicle.model}</div>
            <div className="text-xs text-zinc-400 truncate">{vehicle.year || '—'} • {vehicle.color || '—'}</div>
          </div>
        </div>
        {isSelected && (
          <Badge className="shrink-0 bg-brand-lime/20 text-brand-lime border-brand-lime/30 text-[10px]">
            Выбран
          </Badge>
        )}
      </div>
      {vehicle.specs?.vin && (
        <div className="mt-2 text-[10px] font-mono text-zinc-500 bg-black/30 px-2 py-1 rounded inline-block">
          VIN: {vehicle.specs.vin.slice(-6).toUpperCase()}
        </div>
      )}
    </motion.button>
  );
}

// === MAP TOOLS PANEL ===
function MapToolsPanel({ crewSlug }: { crewSlug: string }) {
  const tools = [
    {
      title: "Калибратор Карты",
      description: "Выровнять GPS bounds под изображение карты",
      href: "/admin/map-calibrator",
      icon: "::FaRulerCombined::",
      color: "from-brand-cyan to-brand-lime",
      badge: "NEW",
    },
    {
      title: "MapRiders",
      description: "Управление live-трекингом экипажа",
      href: `/franchize/${crewSlug}/map-riders`,
      icon: "::FaSatelliteDish::",
      color: "from-brand-purple to-brand-pink",
    },
    {
      title: "POI Editor",
      description: "Редактировать точки интереса на карте",
      href: `/franchize/${crewSlug}/map-riders`,
      icon: "::FaLocationDot::",
      color: "from-amber-400 to-orange-500",
    },
  ];

  return (
    <Card className="border-brand-purple/30 bg-slate-950/60 backdrop-blur-xl overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <VibeContentRenderer content="::FaMap::" className="text-brand-cyan" />
          Map Tools
        </CardTitle>
        <CardDescription className="text-zinc-400 text-sm">
          Инструменты для работы с картами экипажа
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tools.map((tool, i) => (
          <Link key={tool.href} href={tool.href}>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "group flex items-center justify-between p-3 rounded-lg border border-white/10",
                "bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn("p-2 rounded-lg bg-gradient-to-br shrink-0", tool.color)}>
                  <VibeContentRenderer content={tool.icon} className="h-4 w-4 text-black" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-white text-sm truncate">{tool.title}</div>
                  <div className="text-xs text-zinc-400 truncate">{tool.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tool.badge && (
                  <Badge className="bg-brand-lime/20 text-brand-lime border-brand-lime/30 text-[10px]">
                    {tool.badge}
                  </Badge>
                )}
                <VibeContentRenderer content="::FaArrowRight::" className="h-3 w-3 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
            </motion.div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// === KEYBOARD SHORTCUTS PANEL ===
function KeyboardShortcutsPanel() {
  const shortcuts = [
    { keys: ["N"], action: "Новый байк" },
    { keys: ["E"], action: "Редактировать" },
    { keys: ["F"], action: "Фильтр" },
    { keys: ["?", "Shift"], action: "Показать подсказки" },
  ];

  return (
    <Card className="border-white/10 bg-slate-950/40 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
          <VibeContentRenderer content="::FaKeyboard::" className="text-brand-cyan" />
          Горячие клавиши
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {shortcuts.map((s) => (
            <div key={s.action} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{s.action}</span>
              <div className="flex gap-0.5">
                {s.keys.map((k, i) => (
                  <kbd key={i} className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] font-mono text-zinc-300">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// === MAIN CONTENT ===
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setSelectedVehicle(null);
        router.push('/admin');
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder="Поиск в гараже..."]') as HTMLInputElement;
        input?.focus();
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  const visibleVehicles = useMemo(() => {
    return userVehicles
      .filter(v => typeFilter === "all" ? true : v.type === typeFilter)
      .filter(v => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          v.make?.toLowerCase().includes(q) ||
          v.model?.toLowerCase().includes(q) ||
          v.year?.toString().includes(q) ||
          v.specs?.vin?.toLowerCase().includes(q)
        );
      });
  }, [userVehicles, typeFilter, searchQuery]);

  const handleVehicleSelect = (vehicle: Vehicle | null) => {
    setSelectedVehicle(vehicle);
    if (vehicle) {
      router.push(`/admin?edit=${vehicle.id}`, { scroll: false });
      toast.success(`Редактирование: ${vehicle.make} ${vehicle.model}`);
    }
  };
  
  const handleFormSuccess = () => {
    if (dbUser?.user_id) {
      fetchUserVehicles(dbUser.user_id);
    }
    if (!editId) {
      setSelectedVehicle(null);
    }
    toast.success("Изменения сохранены");
  };

  if (appContextLoading) { 
    return <Loading text="ПРОВЕРКА ДОСТУПА..." />;
  }
  
  const crewSlug = userCrewInfo?.slug || "vip-bike";

  return (
    <div className="min-h-screen pt-20 sm:pt-24 bg-black relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-[-1] opacity-20">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Admin Background"
          fill
          className="object-cover animate-pan-zoom"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
        {/* Grid overlay for cyberpunk feel */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,244,120,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,244,120,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <main className="container mx-auto pt-4 sm:pt-6 px-3 sm:px-4 relative z-10 pb-16 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 sm:gap-3 text-xl sm:text-3xl font-bold text-white font-orbitron">
                <VibeContentRenderer content="::FaSatelliteDish::" className="h-6 w-6 sm:h-8 sm:w-8 text-brand-cyan animate-pulse shrink-0" />
                <span className="truncate">VIBE CONTROL CENTER</span>
              </h1>
              <p className="mt-1 text-xs sm:text-base text-zinc-400 font-mono truncate">
                {selectedVehicle 
                  ? `Редактирование: ${selectedVehicle.make} ${selectedVehicle.model}` 
                  : 'Управление флотом • Добавляй технику, настраивай карты, управляй экипажем'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="border-brand-lime/30 text-brand-lime text-[10px] sm:text-xs hidden sm:flex">
                <VibeContentRenderer content="::FaBolt::" className="mr-1" />
                {isTrulyAdmin ? "ADMIN MODE" : "USER MODE"}
              </Badge>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-zinc-400 hover:text-white shrink-0"
                onClick={() => setShowShortcuts(prev => !prev)}
                title="Показать горячие клавиши (?)"
              >
                <VibeContentRenderer content="::FaKeyboard::" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <AdminQuickStats vehicles={userVehicles} isAdmin={isTrulyAdmin} />

        {/* Main Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          {/* Left Column: Vehicle Management */}
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {/* Vehicle Selector Card */}
            <Card className="border-brand-purple/30 bg-slate-950/60 backdrop-blur-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg text-white">Гараж</CardTitle>
                  <Badge variant="outline" className="text-[10px] sm:text-xs border-white/20 text-zinc-400 shrink-0">
                    {visibleVehicles.length} из {userVehicles.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Search + Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <VibeContentRenderer content="::FaSearchengin::" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder="Поиск в гараже..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 input-cyber text-sm"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => { setSelectedVehicle(null); router.push('/admin'); }}
                    className="shrink-0 text-sm"
                  >
                    <VibeContentRenderer content="::FaPlus::" className="mr-1.5" />
                    Новый
                  </Button>
                </div>

                {/* Type Filters */}
                <div className="flex gap-1.5 p-1 rounded-lg bg-white/5">
                  {[
                    { key: "all", label: "Все", icon: "::FaLayerGroup::" },
                    { key: "bike", label: "Байки", icon: "::FaMotorcycle::" },
                    { key: "car", label: "Авто", icon: "::FaCar::" },
                  ].map((f) => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={typeFilter === f.key ? "default" : "ghost"}
                      onClick={() => setTypeFilter(f.key as any)}
                      className={cn(
                        "flex-1 text-xs font-medium",
                        typeFilter === f.key 
                          ? "bg-brand-purple/80 text-white" 
                          : "text-zinc-400 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <VibeContentRenderer content={f.icon} className="mr-1.5 h-3 w-3" />
                      <span className="hidden sm:inline">{f.label}</span>
                      <span className="sm:hidden">{f.label[0]}</span>
                    </Button>
                  ))}
                </div>

                {/* Vehicle Grid */}
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 simple-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {isFetchingVehicles ? (
                      <div className="py-8 text-center text-zinc-500">
                        <Loading text="Загрузка гаража..." className="inline" />
                      </div>
                    ) : visibleVehicles.length > 0 ? (
                      visibleVehicles.map((vehicle) => (
                        <VehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          onSelect={handleVehicleSelect}
                          isSelected={selectedVehicle?.id === vehicle.id}
                        />
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-8 text-center text-zinc-500 text-sm"
                      >
                        {searchQuery 
                          ? "Ничего не найдено по запросу" 
                          : typeFilter !== "all"
                            ? `Нет ${typeFilter === "bike" ? "байков" : "авто"} в гараже`
                            : "Гараж пуст — добавь первую технику!"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* VIN Hint */}
                <p className="text-[10px] sm:text-[11px] text-zinc-500 font-mono bg-black/30 px-3 py-2 rounded">
                  💡 Для генерации договоров добавляй <code className="text-brand-lime">vin</code> в specs карточки
                </p>
              </CardContent>
            </Card>

            {/* Car Submission Form */}
            <motion.div
              key={selectedVehicle?.id || "new"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <CarSubmissionForm 
                ownerId={dbUser?.user_id} 
                vehicleToEdit={selectedVehicle} 
                onSuccess={handleFormSuccess} 
              />
            </motion.div>
          </div>

          {/* Right Column: Tools & Quick Links */}
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {/* Map Tools */}
            <MapToolsPanel crewSlug={crewSlug} />

            {/* Keyboard Shortcuts */}
            <AnimatePresence>
              {showShortcuts && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <KeyboardShortcutsPanel />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Navigation */}
            <Card className="border-white/10 bg-slate-950/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-zinc-300">Быстрые переходы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Мото-гараж", href: "/franchize/vip-bike", icon: "::FaMotorcycle::", color: "text-brand-pink" },
                  { label: "Franchise Docs", href: `/franchize/${crewSlug}/admin`, icon: "::FaFileContract::", color: "text-amber-400" },
                  ...(isTrulyAdmin ? [{ label: "Мой Паддок", href: "/paddock", icon: "::FaWarehouse::", color: "text-brand-cyan" }] : []),
                ].map((link) => (
                  <Link key={link.href} href={link.href}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <VibeContentRenderer content={link.icon} className={cn("h-4 w-4 shrink-0", link.color)} />
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors truncate">{link.label}</span>
                      <VibeContentRenderer content="::FaArrowRight::" className="h-3 w-3 text-zinc-600 ml-auto shrink-0 group-hover:text-zinc-400 transition-colors" />
                    </motion.div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Help / Support */}
            <Card className="border-brand-cyan/20 bg-gradient-to-br from-brand-cyan/5 to-transparent overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <VibeContentRenderer content="::FaCircleQuestion::" className="h-5 w-5 text-brand-cyan mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Нужна помощь?</div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Напиши в <Link href="https://t.me/oneBikePlsBot" className="text-brand-cyan hover:underline">@oneBikePlsBot</Link> или открой <Link href="/docs/admin" className="text-brand-cyan hover:underline">документацию</Link>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Mobile FAB for new vehicle */}
      <div className="fixed bottom-4 right-4 z-50 sm:hidden">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full bg-brand-purple hover:bg-brand-purple/90 shadow-lg shadow-brand-purple/30"
          onClick={() => { setSelectedVehicle(null); router.push('/admin'); }}
        >
          <VibeContentRenderer content="::FaPlus::" className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

// === PAGE WRAPPER ===
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loading text="Загрузка панели управления..." />
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  );
}