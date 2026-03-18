"use client";

import { useFormState, useFormStatus } from "react-dom";

import { enqueueIrrigationCycle } from "./actions";

const initialState = {
  ok: false,
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-xl border border-emerald-300/70 bg-emerald-100 px-4 py-2 font-medium text-emerald-900 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400/35 dark:bg-emerald-500/25 dark:text-emerald-50 dark:hover:bg-emerald-500/35"
    >
      {pending ? "Ставим в очередь..." : "Запустить авто-полив"}
    </button>
  );
}

export function IrrigationQueueForm() {
  const [state, formAction] = useFormState(enqueueIrrigationCycle, initialState);

  return (
    <form action={formAction} className="rounded-2xl border border-emerald-300/55 bg-white/80 p-4 dark:border-emerald-400/25 dark:bg-emerald-950/30">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-emerald-900/85 dark:text-emerald-100/85">
          Зона полива
          <select
            name="zone"
            className="mt-1 w-full rounded-xl border border-emerald-300/70 bg-white px-3 py-2 text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-900/40 dark:text-emerald-50"
            defaultValue="tomato-main"
          >
            <option value="tomato-main">Томатный ряд</option>
            <option value="microgreens">Микрозелень</option>
            <option value="seedlings">Рассада</option>
          </select>
        </label>

        <label className="text-sm text-emerald-900/85 dark:text-emerald-100/85">
          Режим
          <select
            name="intensity"
            className="mt-1 w-full rounded-xl border border-emerald-300/70 bg-white px-3 py-2 text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-900/40 dark:text-emerald-50"
            defaultValue="gentle"
          >
            <option value="gentle">Мягкий</option>
            <option value="normal">Обычный</option>
            <option value="recovery">Восстановление</option>
          </select>
        </label>
      </div>

      <SubmitButton />

      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-900 dark:text-emerald-100" : "text-rose-700 dark:text-rose-200"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
