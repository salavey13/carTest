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

        // Render children directly if context is missing, log fatal error
        if (!context || typeof context.addErrorInfo !== 'function') {
             const msg = "[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext or addErrorInfo missing!";
             if (typeof logger !== 'undefined') logger.fatal(msg); else console.error(msg);
             // Render children to avoid breaking the entire tree if context fails
             return <>{(props as any).children}</>;
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
    if (typeof logger !== 'undefined') logger.log("[ErrorBoundaryForOverlay Internal] Constructor called."); else console.log("[ErrorBoundaryForOverlay Internal] Constructor called.");
  }

  static getDerivedStateFromError(error: Error): State {
    if (typeof logger !== 'undefined') logger.warn("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message); else console.warn("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message);
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const { context } = this.props; // Get context from props (injected by HOC)
    const logPrefix = "[ErrorBoundaryForOverlay Internal]";

    // --- 1. Log the error immediately and robustly ---
    const errorPayload = {
        errorMsg: error?.message,
        componentStackProvided: !!errorInfo?.componentStack,
        originalError: error, // Keep original error object
        reactErrorInfo: errorInfo // Keep react info
    };
    // Log using logger if available, otherwise fallback to console.error
    if (typeof logger !== 'undefined') {
        logger.fatal(`${logPrefix} componentDidCatch triggered. Preparing to report to context.`, errorPayload);
    } else {
        console.error(`${logPrefix} componentDidCatch triggered. Preparing to report to context.`, errorPayload);
    }
    // Always log raw error to console for maximum visibility during crashes
    console.error(`${logPrefix} CAUGHT ERROR DETAILS:`, error, errorInfo);


    // --- 2. Check if context is usable ---
    if (!context || typeof context.addErrorInfo !== 'function') {
        const fatalMsg = `${logPrefix} CRITICAL: Context or addErrorInfo missing in componentDidCatch! Cannot report error visually.`;
        if (typeof logger !== 'undefined') logger.fatal(fatalMsg); else console.error(fatalMsg);
        return; // Cannot proceed without context
    }

    // --- 3. LOOP PREVENTION ---
    // Check if the context *already* has an error being displayed.
    // This prevents infinite loops if reporting the error causes another error.
    if (context.errorInfo !== null && context.errorInfo.error === error) {
         const warnMsg = `${logPrefix} Suppressing addErrorInfo call: Same error is already being displayed in context.`;
         if (typeof logger !== 'undefined') logger.warn(warnMsg); else console.warn(warnMsg);
         return; // <<<--- IMPORTANT: Stop here to prevent the loop with the *same* error
    }
    // Secondary check: If there's *any* error info already, log a warning but proceed cautiously
    if (context.errorInfo !== null) {
        const warnMsg = `${logPrefix} Potential Loop Warning: Context already has an error, but reporting a *new* one.`;
        const warnPayload = {
             currentContextErrorMessage: context.errorInfo?.message.substring(0, 50) + "...",
             newErrorCaughtMessage: error?.message.substring(0, 50) + "...",
        };
        if (typeof logger !== 'undefined') logger.warn(warnMsg, warnPayload); else console.warn(warnMsg, warnPayload);
    }
    // --- END LOOP PREVENTION ---


    // --- 4. Prepare error details for the context ---
    const errorDetails: ErrorInfo = {
      message: error?.message || "React component render error",
      error: error, // Include the original error object
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree', // Attempt to get component source
      lineno: undefined,
      colno: undefined,
      type: 'react', // Indicate it was caught by React's error boundary mechanism
      timestamp: Date.now(), // Add timestamp when caught
      componentStack: errorInfo?.componentStack, // Include component stack if available
    };

    // --- 5. Attempt to report error to context (wrapped in try/catch) ---
    try {
       context.addErrorInfo(errorDetails);
       if (typeof logger !== 'undefined') logger.info(`${logPrefix} Error successfully reported to ErrorOverlayContext.`); else console.info(`${logPrefix} Error successfully reported to ErrorOverlayContext.`);
    } catch (contextError: any) {
       // This catches errors *during* the addErrorInfo call itself
       const fatalMsg = `${logPrefix} CRITICAL: Failed to report error to ErrorOverlayContext!`;
       if (typeof logger !== 'undefined') logger.fatal(fatalMsg, contextError); else console.error(fatalMsg, contextError);
       // Log original error again in case context reporting failed
       console.error(`${logPrefix} Original error that failed reporting:`, error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render null. The actual error UI is handled by DevErrorOverlay listening to the context.
      // Log the suppression using console to be safe during render phase errors
      console.warn("[ErrorBoundaryForOverlay Internal] Render suppressed due to local 'hasError' state. DevErrorOverlay should display the error from context.");
      return null;
    }

    // If no error in this boundary, render children normally.
    return this.props.children;
  }
}

// Export the component wrapped with the context HOC
const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;