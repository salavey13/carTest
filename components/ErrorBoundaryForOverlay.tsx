"use client";

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext';
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger

// Props for the ErrorBoundary
interface Props {
  children: ReactNode;
}

// State for the ErrorBoundary
interface State {
  hasError: boolean;
  error: Error | null;
}

// Higher-order component to inject context hook into class component
function withErrorOverlayContext<P extends object>(
    WrappedComponent: React.ComponentType<P & { context: ReturnType<typeof useErrorOverlay> }>
): React.FC<P> {
    const ComponentWithContext: React.FC<P> = (props) => {
        const context = useErrorOverlay();
        // Ensure context is available before rendering WrappedComponent
        if (!context) {
             // This should not happen if ErrorOverlayProvider wraps this, but good safety check
             console.error("CRITICAL: ErrorOverlayContext not found in withErrorOverlayContext!");
             // Render children directly or a minimal fallback, but avoid crashing
             return <>{props.children}</>;
        }
        return <WrappedComponent {...props} context={context} />;
    };
    ComponentWithContext.displayName = `WithErrorOverlayContext(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return ComponentWithContext;
}


// Define the Error Boundary Class Component
class ErrorBoundaryForOverlayInternal extends Component<Props & { context: ReturnType<typeof useErrorOverlay> }, State> {
  constructor(props: Props & { context: ReturnType<typeof useErrorOverlay> }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Update state so the next render will show the fallback UI (or nothing).
  static getDerivedStateFromError(error: Error): State {
    // Log the error immediately when it's caught
    logger.error("[ErrorBoundaryForOverlay] getDerivedStateFromError caught:", error);
    return { hasError: true, error: error };
  }

  // Catch errors in any components below and log them to the context
  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    // Context might not be available immediately if the error happens very early
    // or if the HOC somehow failed, so check defensively.
    const context = this.props.context;
    if (!context || !context.setErrorInfo) {
        logger.fatal("[ErrorBoundaryForOverlay] CRITICAL: Context or setErrorInfo missing in componentDidCatch!", { error, errorInfo });
        console.error("CRITICAL: ErrorBoundary context/setErrorInfo missing!", error, errorInfo);
        return; // Cannot report error to context
    }
    const { setErrorInfo } = context;

    // Log to our system AND the console
    logger.error("[ErrorBoundaryForOverlay] componentDidCatch reporting error:", error, errorInfo?.componentStack); // Use our logger
    console.error("ErrorBoundaryForOverlay caught an error:", error, errorInfo); // Keep console log too

    // Prepare data for the context
    const errorDetails: ErrorInfo = {
      message: error.message || "React component render error",
      error: error, // Pass the actual error object
      // Attempt to get source info from componentStack
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree',
      lineno: undefined, // Often not available directly here
      colno: undefined, // Often not available directly here
      type: 'react',
    };

    // Send the error details to the context
    try {
       setErrorInfo(errorDetails);
       logger.info("[ErrorBoundaryForOverlay] Error successfully reported to ErrorOverlayContext.");
    } catch (e) {
       logger.fatal("[ErrorBoundaryForOverlay] CRITICAL: Failed to report error to ErrorOverlayContext!", e);
       console.error("CRITICAL: Failed to report error to ErrorOverlayContext!", e);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // --- CHANGE HERE ---
      // When an error is caught, don't render the children.
      // The DevErrorOverlay (outside this boundary) will be displayed by the context update.
      logger.warn("[ErrorBoundaryForOverlay] Render suppressed due to error state.");
      return null; // Return null to let the external overlay handle it
      // --- END CHANGE ---
    }

    // Normally, render children
    return this.props.children;
  }
}

// Export the component wrapped with the HOC to provide context
const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;