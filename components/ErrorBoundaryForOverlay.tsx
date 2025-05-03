"use client";

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { debugLogger as logger } from '@/lib/debugLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null; // Store the first error
}

function withErrorOverlayContext<P extends object>(
    WrappedComponent: React.ComponentType<P & { context: ReturnType<typeof useErrorOverlay> }>
): React.FC<P> {
    const ComponentWithContext: React.FC<P> = (props) => {
        const context = useErrorOverlay();
        if (!context) {
             logger.fatal("[ErrorBoundaryForOverlay] CRITICAL: ErrorOverlayContext not found in HOC!");
             console.error("CRITICAL: ErrorOverlayContext not found in withErrorOverlayContext!");
             return <>{props.children}</>;
        }
        return <WrappedComponent {...props} context={context} />;
    };
    ComponentWithContext.displayName = `WithErrorOverlayContext(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return ComponentWithContext;
}


class ErrorBoundaryForOverlayInternal extends Component<Props & { context: ReturnType<typeof useErrorOverlay> }, State> {
  constructor(props: Props & { context: ReturnType<typeof useErrorOverlay> }) {
    super(props);
    this.state = { hasError: false, error: null };
     // Log constructor call
     logger.log("[ErrorBoundaryForOverlay Internal] Constructor called.");
  }

  static getDerivedStateFromError(error: Error): State {
    logger.error("[ErrorBoundaryForOverlay] getDerivedStateFromError caught:", error);
    // Update state to indicate an error has occurred and store the first error
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const context = this.props.context;

    // Log the catch attempt
    logger.error("[ErrorBoundaryForOverlay] componentDidCatch triggered:", error, errorInfo?.componentStack);

    if (!context || !context.setErrorInfo) {
        logger.fatal("[ErrorBoundaryForOverlay] CRITICAL: Context or setErrorInfo missing in componentDidCatch!", { error, errorInfo });
        console.error("CRITICAL: ErrorBoundary context/setErrorInfo missing!", error, errorInfo);
        return;
    }

    // --- BREAK LOOP: Check if an error is ALREADY set in context ---
    // We check context.errorInfo, NOT this.state.error, because the state might
    // update slightly before context, but the loop trigger is the context update.
    if (context.errorInfo !== null) {
        logger.warn("[ErrorBoundaryForOverlay] Suppressing setErrorInfo call: An error is already being displayed in context.", {
            currentContextError: context.errorInfo,
            newErrorCaught: error,
        });
        console.warn("ErrorBoundaryForOverlay: Suppressed repeated error report.");
        return; // <--- !! STOP HERE TO PREVENT LOOP !!
    }
    // ----------------------------------------------------------------

    const { setErrorInfo } = context;
    console.error("ErrorBoundaryForOverlay caught an error (logged also to console):", error, errorInfo);

    const errorDetails: ErrorInfo = {
      message: error.message || "React component render error",
      error: error,
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree',
      lineno: undefined,
      colno: undefined,
      type: 'react',
    };

    try {
       // Now it's safe to set the error for the first time
       setErrorInfo(errorDetails);
       logger.info("[ErrorBoundaryForOverlay] Initial error reported to ErrorOverlayContext.");
    } catch (e) {
       logger.fatal("[ErrorBoundaryForOverlay] CRITICAL: Failed to report error to ErrorOverlayContext!", e);
       console.error("CRITICAL: Failed to report error to ErrorOverlayContext!", e);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Log suppression based on *local* state
      logger.warn("[ErrorBoundaryForOverlay] Render suppressed due to local 'hasError' state.");
      return null; // Return null to let the external overlay handle it
    }

    // Normally, render children
    return this.props.children;
  }
}

const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;