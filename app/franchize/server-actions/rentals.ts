"use server";

import {
  checkFranchizeCarsAvailability as checkFranchizeCarsAvailabilityRuntime,
  getFranchizeRentalCard as getFranchizeRentalCardRuntime,
  reconcileRentalContractVerifierAttachment as reconcileRentalContractVerifierAttachmentRuntime,
} from "@/app/franchize/actions-runtime";

export async function reconcileRentalContractVerifierAttachment(input: {
  rentalId: string;
  actorTelegramUserId?: string;
}) {
  return reconcileRentalContractVerifierAttachmentRuntime(input);
}

export async function checkFranchizeCarsAvailability(input: unknown) {
  return checkFranchizeCarsAvailabilityRuntime(input);
}

export async function getFranchizeRentalCard(slug: string, rentalId: string) {
  return getFranchizeRentalCardRuntime(slug, rentalId);
}
