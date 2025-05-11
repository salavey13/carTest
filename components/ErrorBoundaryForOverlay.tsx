"use client";

import React, { Component, ErrorInfo as ReactErrorInfo, ReactNode } from 'react';
import { useErrorOverlay, ErrorInfo } from '@/contexts/ErrorOverlayContext'; 
import { debugLogger as logger } from '@/lib/debugLogger';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryInternalProps extends ErrorBoundaryProps {
  context: ReturnType<typeof useErrorOverlay>;
}

interface State {
  hasError: boolean;
  error: Error | null; 
  errorInfo?: ReactErrorInfo | null; // Store ReactErrorInfo too
}

function withErrorOverlayContext<P extends object>(
    WrappedComponent: React.ComponentType<P & { context: ReturnType<typeof useErrorOverlay> }>
): React.FC<P> {
    const ComponentWithContext: React.FC<P> = (props) => {
        const context = useErrorOverlay(); 

        if (!context || typeof context.addErrorInfo !== 'function') {
             const msg = "[ErrorBoundaryForOverlay HOC] CRITICAL: ErrorOverlayContext or addErrorInfo missing!";
             if (typeof logger !== 'undefined' && logger && typeof logger.fatal === 'function') { // Check if logger and fatal exist
                logger.fatal(msg);
             } else {
                console.error(msg);
             }
             return <>{(props as any).children}</>;
        }
        return <WrappedComponent {...props} context={context} />;
    };
    ComponentWithContext.displayName = `WithErrorOverlayContext(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return ComponentWithContext;
}

class ErrorBoundaryForOverlayInternal extends Component<ErrorBoundaryInternalProps, State> {
  constructor(props: ErrorBoundaryInternalProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    const log = (typeof logger !== 'undefined' && logger && typeof logger.log === 'function') ? logger.log : console.log;
    log("[ErrorBoundaryForOverlay Internal] Constructor called.");
  }

  static getDerivedStateFromError(error: Error): State {
    const log = (typeof logger !== 'undefined' && logger && typeof logger.warn === 'function') ? logger.warn : console.warn;
    log("[ErrorBoundaryForOverlay Internal] getDerivedStateFromError caught:", error.message);
    return { hasError: true, error: error }; // Keep errorInfo null here, cDC will populate it
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void {
    const { context } = this.props; 
    const logPrefix = "[ErrorBoundaryForOverlay Internal]";
    const currentLogger = (typeof logger !== 'undefined' && logger) ? logger : console;


    const errorPayload = {
        errorMsg: error?.message,
        componentStackProvided: !!errorInfo?.componentStack,
        originalError: error, 
        reactErrorInfo: errorInfo 
    };
    currentLogger.error(`${logPrefix} componentDidCatch triggered. Preparing to report to context.`, errorPayload);
    // Always log raw error to console for maximum visibility during crashes
    console.error(`${logPrefix} CAUGHT ERROR DETAILS:`, error, errorInfo);

    // Update local state with full errorInfo
    this.setState({ errorInfo: errorInfo });


    if (!context || typeof context.addErrorInfo !== 'function') {
        const fatalMsg = `${logPrefix} CRITICAL: Context or addErrorInfo missing in componentDidCatch! Cannot report error visually.`;
        currentLogger.error(fatalMsg); // Use error instead of fatal if fatal not available
        return; 
    }

    if (context.errorInfo !== null && context.errorInfo.error === error && context.errorInfo.componentStack === errorInfo.componentStack) {
         const warnMsg = `${logPrefix} Suppressing addErrorInfo call: Same error instance and component stack is already being displayed in context.`;
         currentLogger.warn(warnMsg);
         return; 
    }
    if (context.errorInfo !== null) {
        const warnMsg = `${logPrefix} Potential Loop Warning: Context already has an error, but reporting a *new* one.`;
        const warnPayload = {
             currentContextErrorMessage: context.errorInfo?.message.substring(0, 50) + "...",
             newErrorCaughtMessage: error?.message.substring(0, 50) + "...",
        };
        currentLogger.warn(warnMsg, warnPayload);
    }

    const errorDetails: ErrorInfo = {
      message: error?.message || "React component render error",
      error: error, 
      source: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'React Component Tree', 
      lineno: undefined,
      colno: undefined,
      type: 'react', 
      timestamp: Date.now(), 
      componentStack: errorInfo?.componentStack, 
    };

    try {
       context.addErrorInfo(errorDetails);
       currentLogger.info(`${logPrefix} Error successfully reported to ErrorOverlayContext.`);
    } catch (contextError: any) {
       const fatalMsg = `${logPrefix} CRITICAL: Failed to report error to ErrorOverlayContext!`;
       currentLogger.error(fatalMsg, contextError); // Use error instead of fatal
       console.error(`${logPrefix} Original error that failed reporting:`, error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // console.warn("[ErrorBoundaryForOverlay Internal] Render suppressed due to local 'hasError' state. DevErrorOverlay should display the error from context.");
      // We don't render a fallback here, as DevErrorOverlay will handle it based on context.
      // However, if children cause the error, we might need to return null or a minimal fallback
      // to prevent the erroring children from attempting to render again.
      return null; 
    }
    return this.props.children;
  }
}

const ErrorBoundaryForOverlay = withErrorOverlayContext(ErrorBoundaryForOverlayInternal);
export default ErrorBoundaryForOverlay;