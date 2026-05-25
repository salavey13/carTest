'use client'

import { Component, type ReactNode } from 'react'

// ─────────────────────────────────────────────────────
// SvarProfi Error Boundary + Client Shell
// ─────────────────────────────────────────────────────
// The /svarprofi layout is a server component (has export
// const metadata), so it can't directly include an error
// boundary. This client component wraps children with:
//   1. An error boundary that catches runtime crashes
//      (Safari/WKWebView auth failures, TG SDK issues, etc.)
//   2. The dark background div that was in the layout
//
// Without this, any unhandled error in the svarprofi page
// crashes to a white screen — no recovery possible.
// ─────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class SvarProfiErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1A1D23] text-[#E8ECF1] flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C0392B]/20">
              <svg className="h-8 w-8 text-[#C0392B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-[#8A92A0] mb-1">
              Перзагрузите страницу или откройте через Telegram
            </p>
            {this.state.error && (
              <p className="text-xs text-[#8A92A0]/60 mt-2 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleRetry}
              className="mt-4 rounded-lg bg-[#2E7DBF] px-4 py-2 text-sm text-white hover:bg-[#2563A0] transition-colors"
            >
              Обновить
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function SvarProfiClientShell({ children }: { children: ReactNode }) {
  return (
    <SvarProfiErrorBoundary>
      <div className="min-h-screen bg-[#1A1D23] text-[#E8ECF1]">
        {children}
      </div>
    </SvarProfiErrorBoundary>
  )
}
