# Extract Rental Info from Private Tables

This skill extracts rental information from the `private.user_rental_secrets` table, which contains sensitive rental data extracted from documents.

## Usage

### Via Server Action

The skill uses the server action `getRentalDocumentDetails` which extracts rental info from private tables.

```typescript
import { getRentalDocumentDetails } from "@/app/franchize/server-actions/rentals-dashboard";

const result = await getRentalDocumentDetails({
  actorUserId: "user_telegram_id",
  rentalId: "uuid-of-rental",
});

if (result.success && result.data?.secret) {
  console.log("Renter Name:", result.data.secret.renter_full_name);
  console.log("Passport:", result.data.secret.renter_passport);
  console.log("Driver License:", result.data.secret.renter_driver_license);
  // ... more fields
}
```

### Available Fields

The `secret` object contains:

- `renter_full_name` - Full name from documents
- `renter_passport` - Passport series and number
- `renter_passport_issue_date` - Passport issue date
- `renter_registration` - Registration address (propiska)
- `renter_driver_license` - Driver license with categories
- `renter_birth_date` - Birth date
- `renter_phone` - Phone number
- `renter_email` - Email address
- `renter_address` - Residential address
- `verification_status` - "verified" | "pending" | "revoked"
- `doc_sha256` - Document hash for verification
- `source_rental_id` - Associated rental ID
- `created_at` - When the record was created

### Access Control

- Only crew owners and admins can access rental secrets
- The server action verifies user permissions before returning data
- Data lives in the `private` schema, protected at database level

## Implementation

The server action is located at:
`app/franchize/server-actions/rentals-dashboard.ts`

Key function: `getRentalDocumentDetails()`

This action is used by the Rentals Analytics dashboard to show detailed rental information in modals.

## Related Files

- `app/lib/user-rental-secrets.ts` - Core rental secrets access module
- `supabase/migrations/20260601000000_user_rental_secrets.sql` - Table schema
- `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx` - UI implementation
