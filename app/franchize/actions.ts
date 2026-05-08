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

import {
  getFranchizeBySlug as getFranchizeBySlugAction,
  markCrewBikesAvailable as markCrewBikesAvailableAction,
} from "@/app/franchize/server-actions/catalog";
import {
  loadFranchizeConfigBySlug as loadFranchizeConfigBySlugAction,
  saveFranchizeConfig as saveFranchizeConfigAction,
} from "@/app/franchize/server-actions/config";
import { validateFranchizePromoCode as validateFranchizePromoCodeAction } from "@/app/franchize/server-actions/promotions";
import {
  createFranchizeOrderCheckout as createFranchizeOrderCheckoutAction,
  createFranchizeOrderInvoice as createFranchizeOrderInvoiceAction,
  getFranchizeOrderNotificationFailures as getFranchizeOrderNotificationFailuresAction,
  retryFranchizeOrderNotification as retryFranchizeOrderNotificationAction,
  submitFranchizeOrderNotification as submitFranchizeOrderNotificationAction,
} from "@/app/franchize/server-actions/orders";
import { upsertFranchizeIntent as upsertFranchizeIntentAction } from "@/app/franchize/server-actions/intents";
import {
  getFranchizeRentalReviewsForModeration as getFranchizeRentalReviewsForModerationAction,
  getRentalReviewContext as getRentalReviewContextAction,
  moderateRentalReview as moderateRentalReviewAction,
  submitRentalReview as submitRentalReviewAction,
} from "@/app/franchize/server-actions/reviews";
import {
  checkFranchizeCarsAvailability as checkFranchizeCarsAvailabilityAction,
  getFranchizeRentalCard as getFranchizeRentalCardAction,
  reconcileRentalContractVerifierAttachment as reconcileRentalContractVerifierAttachmentAction,
} from "@/app/franchize/server-actions/rentals";

export async function getFranchizeBySlug(
  ...args: Parameters<typeof getFranchizeBySlugAction>
) {
  return getFranchizeBySlugAction(...args);
}

export async function markCrewBikesAvailable(
  ...args: Parameters<typeof markCrewBikesAvailableAction>
) {
  return markCrewBikesAvailableAction(...args);
}

export async function loadFranchizeConfigBySlug(
  ...args: Parameters<typeof loadFranchizeConfigBySlugAction>
) {
  return loadFranchizeConfigBySlugAction(...args);
}

export async function saveFranchizeConfig(
  ...args: Parameters<typeof saveFranchizeConfigAction>
) {
  return saveFranchizeConfigAction(...args);
}

export async function validateFranchizePromoCode(
  ...args: Parameters<typeof validateFranchizePromoCodeAction>
) {
  return validateFranchizePromoCodeAction(...args);
}

export async function createFranchizeOrderCheckout(
  ...args: Parameters<typeof createFranchizeOrderCheckoutAction>
) {
  return createFranchizeOrderCheckoutAction(...args);
}

export async function createFranchizeOrderInvoice(
  ...args: Parameters<typeof createFranchizeOrderInvoiceAction>
) {
  return createFranchizeOrderInvoiceAction(...args);
}

export async function getFranchizeOrderNotificationFailures(
  ...args: Parameters<typeof getFranchizeOrderNotificationFailuresAction>
) {
  return getFranchizeOrderNotificationFailuresAction(...args);
}

export async function retryFranchizeOrderNotification(
  ...args: Parameters<typeof retryFranchizeOrderNotificationAction>
) {
  return retryFranchizeOrderNotificationAction(...args);
}

export async function submitFranchizeOrderNotification(
  ...args: Parameters<typeof submitFranchizeOrderNotificationAction>
) {
  return submitFranchizeOrderNotificationAction(...args);
}

export async function getFranchizeRentalReviewsForModeration(
  ...args: Parameters<typeof getFranchizeRentalReviewsForModerationAction>
) {
  return getFranchizeRentalReviewsForModerationAction(...args);
}

export async function getRentalReviewContext(
  ...args: Parameters<typeof getRentalReviewContextAction>
) {
  return getRentalReviewContextAction(...args);
}

export async function moderateRentalReview(
  ...args: Parameters<typeof moderateRentalReviewAction>
) {
  return moderateRentalReviewAction(...args);
}

export async function submitRentalReview(
  ...args: Parameters<typeof submitRentalReviewAction>
) {
  return submitRentalReviewAction(...args);
}

export async function checkFranchizeCarsAvailability(
  ...args: Parameters<typeof checkFranchizeCarsAvailabilityAction>
) {
  return checkFranchizeCarsAvailabilityAction(...args);
}

export async function upsertFranchizeIntent(
  ...args: Parameters<typeof upsertFranchizeIntentAction>
) {
  return upsertFranchizeIntentAction(...args);
}

export async function getFranchizeRentalCard(
  ...args: Parameters<typeof getFranchizeRentalCardAction>
) {
  return getFranchizeRentalCardAction(...args);
}

export async function reconcileRentalContractVerifierAttachment(
  ...args: Parameters<typeof reconcileRentalContractVerifierAttachmentAction>
) {
  return reconcileRentalContractVerifierAttachmentAction(...args);
}
