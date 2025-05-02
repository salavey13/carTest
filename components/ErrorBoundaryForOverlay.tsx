"use client";

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext'; // Import context hook and type

// Props for the ErrorBoundary
interface Props {
  children: ReactNode;
  // Fallback UI is handled by DevErrorOverlay, so no fallbackRender needed here
}

// State for the ErrorBoundary
interface State {
  hasError: boolean;
  error: Error | null; // Store the caught error
}

// Higher-order component to inject context hook into class component
function withErrorOverlayContext<P extends object>(
    WrappedComponent: React.ComponentType<P & { context: ReturnType<typeof useErrorOverlay> }>
): React.FC<P> {
    const ComponentWithContext: React.FC<P> = (props) => {
        const context = useErrorOverlay();
        // Render the wrapped component with the context passed as a prop
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

  // Update state so the next render will show the fallback UI (or nothing, in our case).
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error };
  }

  // Catch errors in any components below and log them to the context
  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const { setErrorInfo, logHistory, toastHistory } = this.props.context; // Access context via props

    console.error("ErrorBoundaryForOverlay caught an error:", error, errorInfo); // Log to console too

    // Prepare data for the context
    const errorDetails: ErrorInfo = {
      message: error.message || "React component error",
      error: error, // Pass the actual error object
      // Attempt to get source info from componentStack if possible (often limited)
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree',
      type: 'react',
    };

    // Send the error details to the context
    // This will trigger the DevErrorOverlay to display
    setErrorInfo(errorDetails);

    // Optional: Log additional info to our logger (which also goes to context history)
    // logger.error("[ErrorBoundaryForOverlay] Caught React Error", {
    //     error: error.toString(),
    //     componentStack: errorInfo?.componentStack
    // });
  }

  render(): ReactNode {
    // If an error occurred, React will automatically unmount the children.
    // We don't render a fallback UI here because DevErrorOverlay handles it.
    // We just render the children normally if there's no error.
    if (this.state.hasError) {
      // Optionally, render nothing or a minimal placeholder if children MUST be removed
       // return null;
       // OR render children anyway and let DevErrorOverlay appear on top
       return this.props.children;
    }

    return this.props.children;
  }
}

// Export the component wrapped with the HOC to provide context
const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;