"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { activateRental, updateRentalStatus } from "@/app/franchize/server-actions/rentals-dashboard";

interface RentalActionState {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  odometerInput: string;
  setOdometerInput: (v: string) => void;
  activating: boolean;
  activationMsg: { ok: boolean; text: string } | null;
  lastOdometer: number | undefined;
}

export function useActivateRental(rental: { rentalId: string; bikeTitle?: string; startDate?: string; endDate?: string; totalCost?: number; metadata?: any }, slug: string, T: any) {
  const lastOdometer = rental.metadata?.last_known_odometer as number | undefined;
  
  const [showModal, setShowModal] = useState(false);
  const [odometerInput, setOdometerInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const router = useRouter();

  const handleActivate = useCallback(async () => {
    const odometer = parseInt(odometerInput, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setActivationMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setActivating(true);
    setActivationMsg(null);
    try {
      const result = await activateRental({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        odometerBefore: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setActivationMsg({ ok: true, text: result.message || "✅ Аренда активирована! Обновляю..." });
        router.refresh();
      } else {
        setActivationMsg({ ok: false, text: result.error || "Ошибка активации" });
      }
    } catch (err: any) {
      setActivationMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setActivating(false);
    }
  }, [odometerInput, slug, rental.rentalId]);

  return {
    showModal,
    setShowModal,
    odometerInput,
    setOdometerInput,
    activating,
    activationMsg,
    lastOdometer,
    handleActivate,
  };
}

interface DeclineRentalState {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  declineMessage: string;
  setDeclineMessage: (v: string) => void;
  declining: boolean;
  declineMsg: { ok: boolean; text: string } | null;
}

export function useDeclineRental(rental: { rentalId: string; bikeTitle?: string; startDate?: string; endDate?: string }, slug: string, T: any) {
  const [showModal, setShowModal] = useState(false);
  const [declineMessage, setDeclineMessage] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineMsg, setDeclineMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const router = useRouter();

  const handleDecline = useCallback(async () => {
    if (!declineMessage.trim()) {
      setDeclineMsg({ ok: false, text: "Укажите причину отклонения" });
      return;
    }
    setDeclining(true);
    setDeclineMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "cancelled",
        operatorMessage: declineMessage.trim(),
        isPasswordAuth: true,
      });
      if (result.success) {
        setDeclineMsg({ ok: true, text: result.message || "✅ Аренда отклонена. Обновляю..." });
        router.refresh();
      } else {
        setDeclineMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setDeclineMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setDeclining(false);
    }
  }, [declineMessage, slug, rental.rentalId]);

  return {
    showModal,
    setShowModal,
    declineMessage,
    setDeclineMessage,
    declining,
    declineMsg,
    handleDecline,
  };
}

interface CompleteRentalState {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  completeOdometer: string;
  setCompleteOdometer: (v: string) => void;
  completing: boolean;
  completeMsg: { ok: boolean; text: string } | null;
  lastOdometer: number | undefined;
}

export function useCompleteRental(rental: { rentalId: string; bikeTitle?: string; startDate?: string; endDate?: string; totalCost?: number; metadata?: any }, slug: string, T: any) {
  const lastOdometer = rental.metadata?.last_known_odometer as number | undefined;
  
  const [showModal, setShowModal] = useState(false);
  const [completeOdometer, setCompleteOdometer] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeMsg, setCompleteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const router = useRouter();

  const handleComplete = useCallback(async () => {
    const odometer = parseInt(completeOdometer, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setCompleteMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setCompleting(true);
    setCompleteMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "completed",
        odometerAfter: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setCompleteMsg({ ok: true, text: result.message || "✅ Аренда завершена. Обновляю..." });
        router.refresh();
      } else {
        setCompleteMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setCompleteMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setCompleting(false);
    }
  }, [completeOdometer, slug, rental.rentalId]);

  return {
    showModal,
    setShowModal,
    completeOdometer,
    setCompleteOdometer,
    completing,
    completeMsg,
    lastOdometer,
    handleComplete,
  };
}