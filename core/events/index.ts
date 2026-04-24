export type CoreEvent =
  | { type: "plant_dry"; chatId: string | number; plantName?: string; severity?: "low" | "medium" | "high" }
  | { type: "plant_watered"; chatId: string | number; plantName?: string }
  | { type: "simulation_tick"; at: string; payload?: Record<string, unknown> };

type Handler<T extends CoreEvent["type"]> = (event: Extract<CoreEvent, { type: T }>) => Promise<void> | void;

const subscriptions = new Map<CoreEvent["type"], Set<Handler<any>>>();

export function emit(event: CoreEvent) {
  const handlers = subscriptions.get(event.type);
  if (!handlers?.size) return;

  for (const handler of handlers) {
    void Promise.resolve(handler(event as any));
  }
}

export function subscribe<T extends CoreEvent["type"]>(type: T, handler: Handler<T>) {
  if (!subscriptions.has(type)) {
    subscriptions.set(type, new Set());
  }

  const handlers = subscriptions.get(type)!;
  handlers.add(handler as Handler<any>);

  return () => {
    handlers.delete(handler as Handler<any>);
    if (!handlers.size) {
      subscriptions.delete(type);
    }
  };
}
