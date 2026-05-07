"use server";

import { validateFranchizePromoCode as validateFranchizePromoCodeRuntime } from "@/app/franchize/actions-runtime";

export async function validateFranchizePromoCode(input: unknown) {
  return validateFranchizePromoCodeRuntime(input);
}
