"use client";

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext'; // Import hook for HOC
import { debugLogger as logger } from '@/lib/debugLogger';

// Props for the ErrorBoundary itself
interface ErrorBoundaryProps {
  children: ReactNode;
}

// Props including the injected context
interface ErrorBoundaryInternalProps extends ErrorBoundaryProps {
  context: ReturnType<typeof useErrorOverlay>;
}

// State for the ErrorBoundary
interface State {
  hasError: boolean;
  error: Error | null; // Store the first error encountered
}

// Higher-Order Component (HOC) to inject the context into the class component
function withErrorOverlayContext<P extends object>(
    WrappedComponent: React.ComponentType<P & { context: ReturnType<typeof useErrorOverlay> }>
): React.FC<P> {
    const ComponentWithContext: React.FC<P> = (props) => {
        const context = useErrorOverlay(); // Use the hook here

        // Render null or a minimal fallback if context is somehow missing
        if (!context) {
             // Use console.error as logger might not be defined yet
             console.error("[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext not found!");
             // if (typeof logger !== 'undefined') logger.fatal("[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext not found!"); else console.error("[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext not found!");
             return <>{(props as any).children}</>; // Assuming children prop exists
        }
        // Pass the context down to the wrapped class component
        return <WrappedComponent {...props} context={context} />;
    };
    // Set display name for better debugging
    ComponentWithContext.displayName = `WithErrorOverlayContext(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return ComponentWithContext;
}

// --- Internal Class Component (Receives context via props) ---
class ErrorBoundaryForOverlayInternal extends Component<ErrorBoundaryInternalProps, State> {
  constructor(props: ErrorBoundaryInternalProps) {
    super(props);
    this.state = { hasError: false, error: null };
    // Log safely
    if (typeof logger !== 'undefined') logger.log("[ErrorBoundaryForOverlay Internal] Constructor called."); else console.log("[ErrorBoundaryForOverlay Internal] Constructor called.");
  }

  static getDerivedStateFromError(error: Error): State {
    // Log safely
    if (typeof logger !== 'undefined') logger.warn("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message); else console.warn("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message);
    // Update state to trigger fallback UI on the next render
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const { context } = this.props; // Get context from props (injected by HOC)

    // Log the catch attempt safely
    const errorPayload = {
        errorMsg: error?.message,
        componentStackProvided: !!errorInfo?.componentStack
    };
    if (typeof logger !== 'undefined') {
        logger.error("[ErrorBoundaryForOverlay Internal] componentDidCatch triggered.", errorPayload);
    } else {
        console.error("[ErrorBoundaryForOverlay Internal] componentDidCatch triggered.", errorPayload);
    }


    // Defensive check for context and setErrorInfo
    if (!context || typeof context.setErrorInfo !== 'function') {
        const fatalMsg = "[ErrorBoundaryForOverlay Internal] CRITICAL: Context or setErrorInfo missing in componentDidCatch!";
        if (typeof logger !== 'undefined') {
            logger.fatal(fatalMsg, { error: error?.message });
        } else {
            console.error(fatalMsg, { error: error?.message });
        }
        console.error("Original Error:", error, errorInfo);
        return; // Cannot proceed without context
    }

    // --- LOOP PREVENTION ---
    if (context.errorInfo !== null) {
        const warnMsg = "[ErrorBoundaryForOverlay Internal] Suppressing setErrorInfo call: An error is already being displayed in context.";
        const warnPayload = {
             currentContextErrorType: context.errorInfo?.type,
             currentContextErrorMessage: context.errorInfo?.message.substring(0, 50) + "...",
             newErrorCaughtMessage: error?.message.substring(0, 50) + "...",
        };
        if (typeof logger !== 'undefined') {
            logger.warn(warnMsg, warnPayload);
        } else {
            console.warn(warnMsg, warnPayload);
        }
        console.warn("ErrorBoundaryForOverlay: Suppressed redundant error report to context.");
        return; // <<<--- IMPORTANT: Stop here to prevent the loop
    }
    // --- END LOOP PREVENTION ---


    // Log the error details using console first (safer)
    console.error("ErrorBoundaryForOverlay caught an error (reporting to context):", error, errorInfo);
    // Then try logger if available
    if (typeof logger !== 'undefined') {
       logger.error("ErrorBoundaryForOverlay caught an error (reporting details to context):", { error, errorInfo });
    }


    // Prepare the error details for the context
    const errorDetails: ErrorInfo = {
      message: error?.message || "React component render error",
      error: error, // Include the original error object
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree', // Attempt to get component source
      lineno: undefined, // Not typically available here
      colno: undefined, // Not typically available here
      type: 'react', // Indicate it was caught by React's error boundary mechanism
    };

    // Try setting the error context state
    try {
       // Now it's considered safe to set the error for the first time
       context.setErrorInfo(errorDetails);
       if (typeof logger !== 'undefined') logger.info("[ErrorBoundaryForOverlay Internal] Initial error successfully reported to ErrorOverlayContext."); else console.info("[ErrorBoundaryForOverlay Internal] Initial error successfully reported to ErrorOverlayContext.");
    } catch (e) {
       // This catch is for errors *during* the setErrorInfo call itself
       const fatalMsg = "[ErrorBoundaryForOverlay Internal] CRITICAL: Failed to report error to ErrorOverlayContext!";
       if (typeof logger !== 'undefined') {
           logger.fatal(fatalMsg, e);
       } else {
           console.error(fatalMsg, e);
       }
       console.error("CRITICAL: Failed to report error to ErrorOverlayContext!", e);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use console.warn directly here to avoid potential loops if logger itself causes issues initially
      console.warn("[ErrorBoundaryForOverlay Internal] Render suppressed due to local 'hasError' state.");
      // Render null. The actual error UI is handled by DevErrorOverlay via context.
      return null;
    }

    // If no error in this boundary, render children normally.
    return this.props.children;
  }
}

// Export the component wrapped with the context HOC
const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;