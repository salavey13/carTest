"use client";

type NavigationState = {
  stack: string[];
};

type Listener = (state: NavigationState) => void;

const state: NavigationState = {
  stack: [],
};

const listeners = new Set<Listener>();

function emit() {
  const snapshot = { ...state, stack: [...state.stack] };
  listeners.forEach((listener) => listener(snapshot));
}

function normalize(path: string) {
  return path || "/";
}

export const navigationStore = {
  getState(): NavigationState {
    return { ...state, stack: [...state.stack] };
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  push(path: string) {
    const normalizedPath = normalize(path);
    const latest = state.stack[state.stack.length - 1];
    if (latest === normalizedPath) return;
    state.stack.push(normalizedPath);
    emit();
  },
  pop() {
    if (state.stack.length <= 1) {
      return state.stack[state.stack.length - 1] || null;
    }

    state.stack.pop();
    const next = state.stack[state.stack.length - 1] || null;
    emit();
    return next;
  },
  backTarget(currentPath: string) {
    const normalizedCurrentPath = normalize(currentPath);
    let changed = false;

    while (state.stack.length > 0 && state.stack[state.stack.length - 1] === normalizedCurrentPath) {
      state.stack.pop();
      changed = true;
    }

    const next = state.stack[state.stack.length - 1] || null;
    if (changed) emit();
    return next;
  },
  canGoBack() {
    return state.stack.length > 1;
  },
};
