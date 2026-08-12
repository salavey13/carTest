"use client";

import React, { type ErrorInfo, type ReactNode } from "react";
import { Bug } from "lucide-react";

interface LeadsErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
}

interface LeadsErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for LeadsClient and related components.
 * Provides context-aware error messages and recovery options.
 */
export class LeadsErrorBoundary extends React.Component<
  LeadsErrorBoundaryProps,
  LeadsErrorBoundaryState
> {
  constructor(props: LeadsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LeadsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[LeadsErrorBoundary] Error in ${this.props.componentName || "unknown"}:`, error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const { componentName } = this.props;
      const { error } = this.state;

      return (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border p-8">
          <div className="max-w-md text-center">
            <Bug className="mx-auto h-12 w-12 text-red-500" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold">
              {componentName ? `Ошибка в ${componentName}` : "Что-то пошло не так"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Компонент не смог отобразиться. Попробуйте обновить страницу.
            </p>
            {error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs font-mono text-muted-foreground">
                  Детали ошибки
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {error.message}
                </pre>
              </details>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
              >
                Обновить страницу
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}