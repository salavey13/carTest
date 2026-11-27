"use client";

/*
 * task221/222: страница супертеста — тонкая обёртка над SuperTestFlow.
 * Прямая ссылка из браузера = гость (диагностика локально, LS-порядок);
 * из TG WebApp — авторизованный юзер (порядок пишется в профиль).
 */

import { SuperTestFlow } from "@/components/vpr/SuperTestFlow";

export default function SuperTestPage() {
  return <SuperTestFlow defaultMode="standard" />;
}
