"use client";

import React from 'react';
import { useErrorOverlay, type ErrorInfo } from '@/contexts/ErrorOverlayContext'; // Import hook and type

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryForOverlayInternal extends React.Component<ErrorBoundaryProps & ReturnType<typeof useErrorOverlay>, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps & ReturnType<typeof useErrorOverlay>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI (or nothing).
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Only trigger the overlay if it's enabled
    if (this.props.showOverlay) {
        console.error("Error caught by ErrorBoundaryForOverlay:", error, errorInfo);

        // Use the context function to set the error details for the overlay
        this.props.setErrorInfo({
            message: error.message,
            error: error, // Pass the full error object
            type: 'react', // Indicate it's a React error
            // Optionally try to add component stack info if needed, though often less useful when minified
            // source: errorInfo.componentStack?.split('\n')[1]?.trim() || 'React Component',
        });
    } else {
         // If overlay is disabled, just log the error normally
         console.error("React Error (Overlay Disabled):", error, errorInfo);
    }
  }

  render(): React.ReactNode {
    // If an error occurred AND the overlay is meant to be shown,
    // render nothing here and let the overlay handle it.
    // If the overlay is disabled, allow default browser/Next.js handling or render children if possible.
    if (this.state.hasError && this.props.showOverlay) {
      return null; // Render nothing, overlay will appear via context state change
    }

    // Otherwise, render children normally
    return this.props.children;
  }
}

// Functional component wrapper to use the hook inside the class component logic
const ErrorBoundaryForOverlay: React.FC<ErrorBoundaryProps> = ({ children }) => {
    const errorOverlayContext = useErrorOverlay();
    return (
        <ErrorBoundaryForOverlayInternal {...errorOverlayContext}>
            {children}
        </ErrorBoundaryForOverlayInternal>
    );
};


export default ErrorBoundaryForOverlay;