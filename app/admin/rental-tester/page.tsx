"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAppContext } from "@/contexts/AppContext";
import { Loading } from '@/components/Loading';
import {
  setupTestScenario,
  cleanupTestData,
  getTestRentalState,
  triggerTestAction
} from './actions';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';

// Predefined User IDs (replace with actual IDs from your demo setup)
export const DEMO_OWNER_ID_CREW = "413553377"; // Owner of the crew and 1 bike
export const DEMO_OWNER_ID_OTHER = "341729406"; // Owner of other 4 bikes (no crew)

type TestUser = { id: string; username: string };
type TestRental = any;
type TestEvent = any;

const SCENARIOS = [
  {
    id: "happy_path",
    label: "Стандартный Сценарий",
    description: "Симулирует успешную аренду от начала до конца (загрузка фото, подтверждения и т.д.).",
  },
  {
    id: "sos_fuel_hustle",
    label: "SOS: Топливо + Перехват",
    description: "Тестирует сценарий, когда арендатор запрашивает топливо и инициируется перехват.",
  },
  {
    id: "drop_anywhere_hustle",
    label: "Бросить Где Угодно + Перехват",
    description: "Симулирует ситуацию, когда арендатор оставляет транспорт в случайном месте, требуя перехвата.",
  },
  {
    id: "telegram_only_flow",
    label: "Только Telegram",
    description: "Тестирует аренду, полностью управляемую через Telegram (загрузка фото, подтверждения и т.д.).",
  },
];

const ALL_TEST_ACTIONS = [
  { name: 'simulatePaymentSuccess', label: "Симулировать Оплату", description: "Имитирует успешную оплату для старта аренды.", roles: ['renter', 'owner'], statuses: ['pending_confirmation'], category: 'payment' },
  { name: 'addRentalPhoto', label: "Загрузить Фото", description: "Загрузка фото ДО (в начале) или ПОСЛЕ (в конце).", roles: ['renter'], statuses: ['pending_confirmation', 'active'], category: 'data' },
  { name: 'confirmVehiclePickup', label: "Подтвердить Получение", description: "Владелец подтверждает, что арендатор забрал транспорт.", roles: ['owner'], statuses: ['pending_confirmation'], category: 'approval' },
  { name: 'confirmVehicleReturn', label: "Подтвердить Возврат", description: "Владелец подтверждает, что арендатор вернул транспорт.", roles: ['owner'], statuses: ['active'], category: 'approval' },
  { name: 'triggerSosFuel', label: "SOS: Топливо", description: "Запрос на доставку топлива (требует оплаты).", roles: ['renter'], statuses: ['active'], category: 'hustle' },
  { name: 'triggerSosEvac', label: "SOS: Эвакуация", description: "Запрос на эвакуацию (требует оплаты).", roles: ['renter'], statuses: ['active'], category: 'hustle' },
  { name: 'sendGeotag', label: "Отправить Геотег", description: "Отправка координат после оплаты 'Бросить где угодно'.", roles: ['renter'], statuses: ['active'], category: 'data' },
];

const categoryStyles: Record<string, string> = {
    payment: 'bg-brand-green/80 hover:bg-brand-green text-black',
    approval: 'bg-brand-blue/80 hover:bg-brand-blue text-white',
    data: 'bg-brand-purple/80 hover:bg-brand-purple text-white',
    hustle: 'bg-brand-orange/80 hover:bg-brand-orange text-black',
};

export default function RentalTesterPage() {
  const { isAdmin, isLoading: isAppLoading } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>(SCENARIOS[0].id);

  // Test State
  const [renter, setRenter] = useState<TestUser | null>(null);
  const [owner, setOwner] = useState<TestUser | null>(null);
  const [rental, setRental] = useState<TestRental | null>(null);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [actingAs, setActingAs] = useState<'renter' | 'owner'>('renter');
  const [telegramLog, setTelegramLog] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSetup = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    const toastId = toast.loading(`Настройка сценария "${SCENARIOS.find(s => s.id === selectedScenario)?.label}"...`);

    if (rental) await cleanupTestData(rental.rental_id);

    const result = await setupTestScenario(selectedScenario);
    if (result.success) {
      setRenter({ id: result.data.renter.id, username: result.data.renter.username });
      setOwner({ id: result.data.owner.id, username: result.data.owner.username });
      
      const initialState = await getTestRentalState(result.data.rental.rental_id);
      if (initialState.success) {
        setRental(initialState.data.rental);
        setEvents(initialState.data.events);
      }
      
      setTelegramLog([`Сценарий успешно настроен. ID аренды: ${result.data.rental.rental_id}`]);
      toast.success("Сценарий успешно настроен!", { id: toastId });
    } else {
      setErrorMessage(result.error || "Не удалось настроить сценарий.");
      toast.error(result.error || "Не удалось настроить сценарий.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const handleCleanup = async () => {
    if (!rental) {
      toast.info("Нет активного сценария для очистки.");
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    const toastId = toast.loading("Очистка тестовых данных...");
    const result = await cleanupTestData(rental.rental_id);
    if (result.success) {
      setRenter(null);
      setOwner(null);
      setRental(null);
      setEvents([]);
      setTelegramLog([]);
      toast.success("Очистка завершена!", { id: toastId });
    } else {
      setErrorMessage(result.error || "Не удалось очистить данные.");
      toast.error(result.error || "Не удалось очистить данные.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const handleAction = async (actionName: string, payload: Record<string, any> = {}) => {
    if (!rental) return;
    setIsProcessing(true);
    setErrorMessage(null);
    const actorId = actingAs === 'renter' ? DEMO_OWNER_ID_OTHER : DEMO_OWNER_ID_CREW;
    const toastId = toast.loading(`Выполнение действия "${ALL_TEST_ACTIONS.find(a => a.name === actionName)?.label}" от имени ${actingAs}...`);

    const result = await triggerTestAction(rental.rental_id, actorId, actionName, payload);

    if (result.success) {
      const state = await getTestRentalState(rental.rental_id);
      if (state.success) {
        setRental(state.data.rental);
        setEvents(state.data.events);
      }
      setTelegramLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Имитация уведомления Telegram: ${result.mockNotification}`]);
      toast.success("Действие выполнено успешно!", { id: toastId });
    } else {
      setErrorMessage(result.error || "Не удалось выполнить действие.");
      toast.error(result.error || "Не удалось выполнить действие.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const availableActions = useMemo(() => {
    if (!rental || !rental.status) return [];
    return ALL_TEST_ACTIONS.filter(action => 
        action.roles.includes(actingAs) && action.statuses.includes(rental.status)
    );
  }, [rental, actingAs]);


  if (isAppLoading) return <Loading />;
  
  const isUserReallyAdmin = isAdmin();
  if (!isUserReallyAdmin) {
      return <div className="text-center p-8 text-destructive">ДОСТУП ЗАПРЕЩЕН</div>;
  }
  
  const paymentAction = availableActions.find(a => a.category === 'payment');
  const otherActions = availableActions.filter(a => a.category !== 'payment');

  return (
    <div className="container mx-auto p-4 pt-24 space-y-4">
      <h1 className="text-3xl font-bold">Vibe Simulator: Rental Flows</h1>
      <p className="text-sm text-muted-foreground">Этот инструмент позволяет симулировать различные сценарии аренды и запускать действия для тестирования системы.</p>

      <Card>
        <CardHeader><CardTitle>1. Управление Сценарием</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Выберите сценарий для настройки начального состояния аренды.</p>
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger className="w-full md:w-[250px]"><SelectValue placeholder="Выберите Сценарий" /></SelectTrigger>
            <SelectContent>
              {SCENARIOS.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} - <span className="italic text-muted-foreground">{s.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col md:flex-row items-center gap-2">
            <Button onClick={handleSetup} disabled={isProcessing} className="w-full md:w-auto">
              <VibeContentRenderer content="::FaPlay::" className="mr-2" /> Настроить Сценарий
            </Button>
            <Button onClick={handleCleanup} variant="destructive" disabled={isProcessing} className="w-full md:w-auto">
              <VibeContentRenderer content="::FaTrash::" className="mr-2" /> Очистить Данные
            </Button>
          </div>
        </CardContent>
      </Card>

      {rental && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action Panel */}
          <Card>
            <CardHeader><CardTitle>2. Управление Действиями</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">Выберите действующее лицо (арендатор или владелец) для выполнения действий.</p>
              <Select value={actingAs} onValueChange={(v) => setActingAs(v as any)}>
                <SelectTrigger><SelectValue placeholder="Действовать от имени..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="renter">Арендатор: @{DEMO_OWNER_ID_OTHER}</SelectItem>
                  <SelectItem value="owner">Владелец: @{DEMO_OWNER_ID_CREW}</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <h4 className="font-semibold">Доступные Действия:</h4>
                {paymentAction && (
                    <div key={paymentAction.name} className="space-y-1 border-b pb-3 mb-3 border-dashed border-border">
                        <Button onClick={() => handleAction(paymentAction.name)} className={cn("w-full", categoryStyles[paymentAction.category])} disabled={isProcessing}>
                            {paymentAction.label}
                        </Button>
                        <p className="text-xs text-muted-foreground">{paymentAction.description}</p>
                    </div>
                )}
                {otherActions.length > 0 ? otherActions.map(action => (
                  <div key={action.name} className="space-y-1">
                    <Button onClick={() => handleAction(action.name)} className={cn("w-full", categoryStyles[action.category])} disabled={isProcessing}>
                      {action.label}
                    </Button>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                )) : !paymentAction && (
                    <p className="text-xs text-muted-foreground font-mono p-2 bg-muted/50 rounded text-center">Нет доступных действий для роли "{actingAs}" в статусе "{rental.status}".</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Event Stream */}
          <Card>
            <CardHeader><CardTitle>3. Поток Событий</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">Отображает поток событий в реальном времени для текущей аренды.</p>
              <ScrollArea className="h-[300px] w-full p-2 border rounded">
                <pre className="text-xs">{JSON.stringify(events, null, 2)}</pre>
              </ScrollArea>
              <div className="mt-2 text-sm">Статус Аренды: <span className="font-bold">{rental.status}</span></div>
            </CardContent>
          </Card>

          {/* Mock Telegram */}
          <Card>
            <CardHeader><CardTitle>4. Журнал Telegram (Имитация)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">Имитирует уведомления Telegram, отправляемые во время процесса аренды.</p>
              <ScrollArea className="h-[300px] w-full p-2 border rounded font-mono text-xs">
                {telegramLog.map((log, i) => <div key={i} className="mb-2 border-b pb-1">{log}</div>)}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
      {errorMessage && (
        <div className="text-destructive text-sm">
          Ошибка: {errorMessage}
        </div>
      )}
    </div>
  );
}