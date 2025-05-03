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

        // Render null or a minimal fallback if context is somehow missing (shouldn't happen if setup correctly)
        if (!context) {
             logger.fatal("[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext not found!");
             console.error("CRITICAL: ErrorOverlayContext not found in withErrorOverlayContext!");
             // Render children directly as a last resort, though the app might be broken
             // Or render a specific error message component
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
    logger.log("[ErrorBoundaryForOverlay Internal] Constructor called.");
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to trigger fallback UI on the next render
    logger.warn("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message);
    // Store the first error encountered
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const { context } = this.props; // Get context from props (injected by HOC)

    // Log the catch attempt
    logger.error("[ErrorBoundaryForOverlay Internal] componentDidCatch triggered.", {
        errorMsg: error?.message,
        // errorStack: error?.stack, // Optionally log stack, be mindful of size/privacy
        componentStackProvided: !!errorInfo?.componentStack
    });

    // Defensive check for context and setErrorInfo
    if (!context || typeof context.setErrorInfo !== 'function') {
        logger.fatal("[ErrorBoundaryForOverlay Internal] CRITICAL: Context or setErrorInfo missing in componentDidCatch!", { error: error.message });
        console.error("CRITICAL: ErrorBoundary context/setErrorInfo missing!", error, errorInfo);
        return; // Cannot proceed without context
    }

    // --- LOOP PREVENTION ---
    // Check if the overlay context *already* has an error set.
    // If it does, don't try to set it again from this boundary.
    // This prevents loops if multiple boundaries catch errors or if an error
    // happens during the context state update itself.
    if (context.errorInfo !== null) {
        logger.warn("[ErrorBoundaryForOverlay Internal] Suppressing setErrorInfo call: An error is already being displayed in context.", {
            currentContextErrorType: context.errorInfo?.type,
            currentContextErrorMessage: context.errorInfo?.message.substring(0, 50) + "...",
            newErrorCaughtMessage: error?.message.substring(0, 50) + "...",
        });
        console.warn("ErrorBoundaryForOverlay: Suppressed redundant error report to context.");
        return; // <<<--- IMPORTANT: Stop here to prevent the loop
    }
    // --- END LOOP PREVENTION ---


    // Log the error details using the logger before setting context
    console.error("ErrorBoundaryForOverlay caught an error (reporting to context):", error, errorInfo);

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
       logger.info("[ErrorBoundaryForOverlay Internal] Initial error successfully reported to ErrorOverlayContext.");
    } catch (e) {
       // This catch is for errors *during* the setErrorInfo call itself
       logger.fatal("[ErrorBoundaryForOverlay Internal] CRITICAL: Failed to report error to ErrorOverlayContext!", e);
       console.error("CRITICAL: Failed to report error to ErrorOverlayContext!", e);
       // If setting context fails, we might be in a deeper loop or React issue.
       // Further actions might be needed, like trying to force a reload.
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Log suppression based on *local* state (this is okay, doesn't cause loop)
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