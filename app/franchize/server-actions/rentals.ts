"use server";

import {
  checkFranchizeCarsAvailability as checkFranchizeCarsAvailabilityRuntime,
  getFranchizeRentalCard as getFranchizeRentalCardRuntime,
  getFranchizeSuccessfulRentals as getFranchizeSuccessfulRentalsRuntime,
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

export async function getFranchizeSuccessfulRentals(input: unknown) {
  return getFranchizeSuccessfulRentalsRuntime(input);
}
