"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { Loading } from '@/components/Loading';
import {
  setupTestScenario,
  cleanupTestData,
  getTestRentalState,
  triggerTestAction
} from './actions';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

type TestUser = { id: string; username: string };
type TestRental = any; // Define more strictly if needed
type TestEvent = any;

const SCENARIOS = [
  "happy_path",
  "sos_fuel_hustle",
  "drop_anywhere_hustle",
  "telegram_only_flow"
];

export default function RentalTesterPage() {
  const { isAdmin, isLoading: isAppLoading } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>(SCENARIOS[0]);
  
  // Test State
  const [renter, setRenter] = useState<TestUser | null>(null);
  const [owner, setOwner] = useState<TestUser | null>(null);
  const [rental, setRental] = useState<TestRental | null>(null);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [actingAs, setActingAs] = useState<'renter' | 'owner'>('renter');
  const [telegramLog, setTelegramLog] = useState<string[]>([]);
  
  const handleSetup = async () => {
    setIsProcessing(true);
    const toastId = toast.loading(`Setting up "${selectedScenario}" scenario...`);
    
    // Cleanup any previous test first
    if (rental) await cleanupTestData(rental.rental_id);

    const result = await setupTestScenario(selectedScenario);
    if (result.success) {
      setRenter(result.data.renter);
      setOwner(result.data.owner);
      setRental(result.data.rental);
      setEvents(result.data.events);
      setTelegramLog([`Scenario setup complete for rental ID: ${result.data.rental.rental_id}`]);
      toast.success("Scenario setup successfully!", { id: toastId });
    } else {
      toast.error(result.error || "Failed to setup scenario.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const handleCleanup = async () => {
    if (!rental) {
      toast.info("No active test scenario to clean up.");
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Cleaning up test data...");
    const result = await cleanupTestData(rental.rental_id);
    if (result.success) {
      setRenter(null);
      setOwner(null);
      setRental(null);
      setEvents([]);
      setTelegramLog([]);
      toast.success("Cleanup complete!", { id: toastId });
    } else {
      toast.error(result.error || "Cleanup failed.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const handleAction = async (actionName: string, payload: Record<string, any> = {}) => {
    if (!rental) return;
    setIsProcessing(true);
    const actorId = actingAs === 'renter' ? renter!.id : owner!.id;
    const toastId = toast.loading(`Triggering action "${actionName}" as ${actingAs}...`);
    
    const result = await triggerTestAction(rental.rental_id, actorId, actionName, payload);
    
    if (result.success) {
      // Refresh state
      const state = await getTestRentalState(rental.rental_id);
      if (state.success) {
        setRental(state.data.rental);
        setEvents(state.data.events);
      }
      setTelegramLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Mock TG Notification: ${result.mockNotification}`]);
      toast.success("Action triggered successfully!", { id: toastId });
    } else {
      toast.error(result.error || "Action failed.", { id: toastId });
    }
    setIsProcessing(false);
  };

  if (isAppLoading) return <Loading />;
  if (!isAdmin) return <div className="text-center p-8 text-destructive">ACCESS DENIED</div>;

  // Simple logic to determine available actions
  const getAvailableActions = () => {
    if (!rental) return [];
    
    const actions: { name: string; label: string; actor: UserRole }[] = [];
    const hasEvent = (type: string) => events.some(e => e.type === type);

    if (actingAs === 'renter') {
      if (rental.status === 'pending_confirmation' && !hasEvent('photo_start')) actions.push({ name: 'addRentalPhoto', label: "Upload 'Start' Photo", actor: 'renter' });
      if (rental.status === 'active' && !hasEvent('photo_end')) actions.push({ name: 'addRentalPhoto', label: "Upload 'End' Photo", actor: 'renter' });
      if (rental.status === 'active') actions.push({ name: 'triggerSos', label: "Trigger SOS Fuel", actor: 'renter' });
    }
    
    if (actingAs === 'owner') {
      if (events.some(e => e.type === 'photo_start') && !events.some(e => e.type === 'pickup_confirmed')) {
        actions.push({ name: 'confirmVehiclePickup', label: "Confirm Pickup", actor: 'owner' });
      }
      if (events.some(e => e.type === 'photo_end') && !events.some(e => e.type === 'return_confirmed')) {
        actions.push({ name: 'confirmVehicleReturn', label: "Confirm Return", actor: 'owner' });
      }
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  
  return (
    <div className="container mx-auto p-4 pt-24 space-y-4">
      <h1 className="text-3xl font-bold">Vibe Simulator: Rental Flows</h1>
      
      <Card>
        <CardHeader><CardTitle>1. Scenario Control</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Scenario" /></SelectTrigger>
            <SelectContent>
              {SCENARIOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleSetup} disabled={isProcessing}>
             <VibeContentRenderer content="::FaPlay::" className="mr-2"/> Setup Scenario
          </Button>
          <Button onClick={handleCleanup} variant="destructive" disabled={isProcessing}>
             <VibeContentRenderer content="::FaTrash::" className="mr-2"/> Cleanup Test Data
          </Button>
        </CardContent>
      </Card>
      
      {rental && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action Panel */}
          <Card>
            <CardHeader><CardTitle>2. Actor Control</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={actingAs} onValueChange={(v) => setActingAs(v as any)}>
                <SelectTrigger><SelectValue placeholder="Act As..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="renter">Renter: @{renter?.username}</SelectItem>
                  <SelectItem value="owner">Owner: @{owner?.username}</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <h4 className="font-semibold">Available Actions:</h4>
                {availableActions.length > 0 ? availableActions.map(action => (
                  <Button key={action.name} onClick={() => handleAction(action.name)} className="w-full" disabled={isProcessing}>
                    {action.label}
                  </Button>
                )) : <p className="text-sm text-muted-foreground">No actions available for {actingAs}.</p>}
              </div>
            </CardContent>
          </Card>
          
          {/* Event Stream */}
          <Card>
            <CardHeader><CardTitle>3. Live Event Stream</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full p-2 border rounded">
                <pre className="text-xs">{JSON.stringify(events, null, 2)}</pre>
              </ScrollArea>
              <div className="mt-2 text-sm">Rental Status: <span className="font-bold">{rental.status}</span></div>
            </CardContent>
          </Card>

          {/* Mock Telegram */}
          <Card>
            <CardHeader><CardTitle>4. Mock Telegram Log</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full p-2 border rounded font-mono text-xs">
                {telegramLog.map((log, i) => <div key={i} className="mb-2 border-b pb-1">{log}</div>)}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}