"use server";

// Compatibility surface for existing franchize routes/components.
// New code should import from the focused modules in `app/franchize/server-actions/*`.
export type {
  CatalogItemVM,
  FranchizeBySlugResult,
  FranchizeConfigInput,
  FranchizeConfigState,
  FranchizeCrewVM,
  FranchizeHeaderVM,
  FranchizeTheme,
  RentalReviewSummaryVM,
  RentalReviewVM,
} from "@/app/franchize/actions-runtime";

export { getFranchizeBySlug, markCrewBikesAvailable } from "@/app/franchize/server-actions/catalog";
export { loadFranchizeConfigBySlug, saveFranchizeConfig } from "@/app/franchize/server-actions/config";
export { validateFranchizePromoCode } from "@/app/franchize/server-actions/promotions";
export {
  createFranchizeOrderCheckout,
  createFranchizeOrderInvoice,
  getFranchizeOrderNotificationFailures,
  retryFranchizeOrderNotification,
  submitFranchizeOrderNotification,
} from "@/app/franchize/server-actions/orders";
export {
  getFranchizeRentalReviewsForModeration,
  getRentalReviewContext,
  moderateRentalReview,
  submitRentalReview,
} from "@/app/franchize/server-actions/reviews";
export {
  checkFranchizeCarsAvailability,
  getFranchizeRentalCard,
  reconcileRentalContractVerifierAttachment,
} from "@/app/franchize/server-actions/rentals";
