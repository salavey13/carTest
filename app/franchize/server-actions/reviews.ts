"use server";

import {
  getFranchizeRentalReviewsForModeration as getFranchizeRentalReviewsForModerationRuntime,
  getRentalReviewContext as getRentalReviewContextRuntime,
  moderateRentalReview as moderateRentalReviewRuntime,
  submitRentalReview as submitRentalReviewRuntime,
} from "@/app/franchize/actions-runtime";

export async function getRentalReviewContext(input: unknown) {
  return getRentalReviewContextRuntime(input);
}

export async function submitRentalReview(input: unknown) {
  return submitRentalReviewRuntime(input);
}

export async function getFranchizeRentalReviewsForModeration(input: unknown) {
  return getFranchizeRentalReviewsForModerationRuntime(input);
}

export async function moderateRentalReview(input: unknown) {
  return moderateRentalReviewRuntime(input);
}
