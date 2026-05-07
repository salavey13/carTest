/**
 * Represents a single toast message recorded in the history.
 */
export interface ToastRecord {
    id: number | string; // Unique identifier (e.g., timestamp + random) for React keys
    message: string; // The content of the toast message
    type: string; // Type of toast (e.g., 'success', 'error', 'info', 'warning', 'loading', 'default')
    timestamp: number; // Unix timestamp (ms) when the toast was added
}

// You can add other shared toast-related types here if needed.