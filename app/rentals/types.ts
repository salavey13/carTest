/** Basic shape of data required to create a booking */
export interface BookingInput {
  // Customer-related fields
  customerId: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string

  // Financials
  amount: number; // in smallest currency unit (e.g. cents)
  currency: string;

  // Optional metadata for webhook logic, categorization, etc.
  metadata?: Record<string, unknown>;
}

/** Shape of result returned after creating a booking */
export interface BookingResult {
  id: string;         // booking ID in your system
  invoiceId?: string; // linked invoice, if applicable
  status: 'pending' | 'confirmed' | 'cancelled';
  metadata?: Record<string, unknown>;
  createdAt: string;  // ISO timestamp
}