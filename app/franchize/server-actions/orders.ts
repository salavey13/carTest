"use server";

import {
  createFranchizeOrderCheckout as createFranchizeOrderCheckoutRuntime,
  createFranchizeOrderInvoice as createFranchizeOrderInvoiceRuntime,
  recordFranchizeCheckoutRecoverySnapshot as recordFranchizeCheckoutRecoverySnapshotRuntime,
  getFranchizeOrderNotificationFailures as getFranchizeOrderNotificationFailuresRuntime,
  retryFranchizeOrderNotification as retryFranchizeOrderNotificationRuntime,
  submitFranchizeOrderNotification as submitFranchizeOrderNotificationRuntime,
} from "@/app/franchize/actions-runtime";

export async function submitFranchizeOrderNotification(input: unknown) {
  return submitFranchizeOrderNotificationRuntime(input);
}

export async function retryFranchizeOrderNotification(input: unknown) {
  return retryFranchizeOrderNotificationRuntime(input);
}

export async function getFranchizeOrderNotificationFailures(input: unknown) {
  return getFranchizeOrderNotificationFailuresRuntime(input);
}

export async function createFranchizeOrderInvoice(input: unknown) {
  return createFranchizeOrderInvoiceRuntime(input);
}

export async function createFranchizeOrderCheckout(input: unknown) {
  return createFranchizeOrderCheckoutRuntime(input);
}

export async function recordFranchizeCheckoutRecoverySnapshot(input: unknown) {
  return recordFranchizeCheckoutRecoverySnapshotRuntime(input);
}
