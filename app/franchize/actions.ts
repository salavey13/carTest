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
import { getCrewPaletteBySlug as getCrewPaletteBySlugAction } from "@/app/franchize/server-actions/palette";
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
  recordFranchizeCheckoutRecoverySnapshot as recordFranchizeCheckoutRecoverySnapshotAction,
  submitFranchizeOrderNotification as submitFranchizeOrderNotificationAction,
} from "@/app/franchize/server-actions/orders";
import { sendFranchizeBuyPrintPdf as sendFranchizeBuyPrintPdfAction } from "@/app/franchize/server-actions/buy-print";
import {
  getFranchizeCloserIntents as getFranchizeCloserIntentsAction,
  getFranchizeOperatorDashboardAccess as getFranchizeOperatorDashboardAccessAction,
  updateFranchizeCloserIntentStage as updateFranchizeCloserIntentStageAction,
  upsertFranchizeIntent as upsertFranchizeIntentAction,
} from "@/app/franchize/server-actions/intents";
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

export async function recordFranchizeCheckoutRecoverySnapshot(
  ...args: Parameters<typeof recordFranchizeCheckoutRecoverySnapshotAction>
) {
  return recordFranchizeCheckoutRecoverySnapshotAction(...args);
}

export async function sendFranchizeBuyPrintPdf(
  ...args: Parameters<typeof sendFranchizeBuyPrintPdfAction>
) {
  return sendFranchizeBuyPrintPdfAction(...args);
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

export async function getFranchizeOperatorDashboardAccess(
  ...args: Parameters<typeof getFranchizeOperatorDashboardAccessAction>
) {
  return getFranchizeOperatorDashboardAccessAction(...args);
}

export async function getFranchizeCloserIntents(
  ...args: Parameters<typeof getFranchizeCloserIntentsAction>
) {
  return getFranchizeCloserIntentsAction(...args);
}

export async function updateFranchizeCloserIntentStage(
  ...args: Parameters<typeof updateFranchizeCloserIntentStageAction>
) {
  return updateFranchizeCloserIntentStageAction(...args);
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


export async function getCrewPaletteBySlug(
  ...args: Parameters<typeof getCrewPaletteBySlugAction>
) {
  return getCrewPaletteBySlugAction(...args);
}
