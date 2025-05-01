"use client";

import React from 'react';
import { useErrorOverlay, type ErrorInfo } from '@/contexts/ErrorOverlayContext'; // Import hook and type
import { debugLogger as logger } from '@/lib/debugLogger'; // Import logger

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null; // Store the actual error
}

class ErrorBoundaryForOverlayInternal extends React.Component<ErrorBoundaryProps & ReturnType<typeof useErrorOverlay>, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps & ReturnType<typeof useErrorOverlay>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI (or nothing).
    // Store the error object itself.
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error regardless of whether the overlay is shown
    logger.error("React Error caught by ErrorBoundaryForOverlay:", {
        error: error,
        componentStack: errorInfo.componentStack
    });

    // Only trigger the overlay if it's enabled AND we haven't already set an error from getDerivedStateFromError
    // (This check might be slightly redundant due to getDerivedStateFromError but adds safety)
    if (this.props.showOverlay && this.state.hasError && this.state.error === error) {
        // Use the context function to set the error details for the overlay
        this.props.setErrorInfo({
            message: error.message,
            error: error, // Pass the full error object
            type: 'react', // Indicate it's a React error
            // Attempt to extract a meaningful source from component stack if possible
            source: errorInfo.componentStack?.split('\n')[1]?.trim() || 'React Component',
        });
    } else if (!this.props.showOverlay) {
         logger.warn("React Error occurred but Dev Overlay is disabled.");
         // In a production scenario without the overlay, you might want to:
         // 1. Log to a remote error tracking service (Sentry, LogRocket, etc.)
         // 2. Potentially show a very minimal, user-friendly error message component
         //    instead of just returning null.
    }
    // If showOverlay is true but state hasn't updated yet, it will be handled on the next render cycle triggered by getDerivedStateFromError
  }

  render(): React.ReactNode {
    // If an error occurred AND the overlay is meant to be shown,
    // render nothing here and let the overlay handle it. The state change
    // from getDerivedStateFromError ensures this render path is taken.
    if (this.state.hasError && this.props.showOverlay) {
      // Render nothing. The ErrorOverlayContext state change in componentDidCatch
      // (or triggered by the state update from gDSFE indirectly) will cause
      // the DevErrorOverlay component (outside this boundary) to render.
      return null;
    }

    // If an error occurred but the overlay is DISABLED, you might want to render
    // a generic fallback UI instead of potentially broken children or nothing.
    // Example:
    // if (this.state.hasError && !this.props.showOverlay) {
    //   return <MinimalErrorFallback message={this.state.error?.message} />;
    // }

    // Otherwise (no error, or overlay disabled and no specific fallback), render children normally
    return this.props.children;
  }
}

// Functional component wrapper to use the hook inside the class component logic
const ErrorBoundaryForOverlay: React.FC<ErrorBoundaryProps> = ({ children }) => {
    const errorOverlayContext = useErrorOverlay();
    // Wrap the internal class component, passing context values as props
    return (
        <ErrorBoundaryForOverlayInternal {...errorOverlayContext}>
            {children}
        </ErrorBoundaryForOverlayInternal>
    );
};

export default ErrorBoundaryForOverlay;