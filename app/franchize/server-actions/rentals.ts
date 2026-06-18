"use server";

import {
  checkFranchizeCarsAvailability as checkFranchizeCarsAvailabilityRuntime,
  getFranchizeRentalCard as getFranchizeRentalCardRuntime,
  getFranchizeSuccessfulRentals as getFranchizeSuccessfulRentalsRuntime,
  reconcileRentalContractVerifierAttachment as reconcileRentalContractVerifierAttachmentRuntime,
} from "@/app/franchize/actions-runtime";

// Contract generation actions
export { submitContractDraft } from './submit-contract-draft';
export { approveContract } from './approve-contract';
export { declineContract } from './decline-contract';

// Export types from rental-contract-types
export type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
} from '../lib/rental-contract-types';

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
