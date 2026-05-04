"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { debugLogger } from "@/lib/debugLogger";

interface FranchizeErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  resetKey?: string | number;
  fallbackHref?: string;
  fallbackLinkLabel?: string;
}

interface FranchizeErrorBoundaryState {
  hasError: boolean;
}

export class FranchizeErrorBoundary extends Component<FranchizeErrorBoundaryProps, FranchizeErrorBoundaryState> {
  state: FranchizeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FranchizeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    debugLogger.error("[FranchizeErrorBoundary]", error, errorInfo);
  }

  componentDidUpdate(prevProps: FranchizeErrorBoundaryProps): void {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="mx-auto mt-4 w-full rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-red-50">
        <p className="text-xs uppercase tracking-[0.2em] text-red-300">franchize error boundary</p>
        <h2 className="mt-2 text-lg font-semibold">{this.props.fallbackTitle ?? "Что-то пошло не так"}</h2>
        <p className="mt-2 text-sm text-red-100/90">
          {this.props.fallbackMessage ??
            "Похоже, виджет временно недоступен. Попробуйте повторить действие или вернуться в каталог."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-xl border border-red-300/60 px-3 py-1.5 transition hover:bg-red-500/20"
          >
            Повторить
          </button>
          <Link
            href={this.props.fallbackHref ?? "/franchize"}
            className="rounded-xl border border-red-300/60 px-3 py-1.5 transition hover:bg-red-500/20"
          >
            {this.props.fallbackLinkLabel ?? "К списку франшиз"}
          </Link>
        </div>
      </section>
    );
  }
}
