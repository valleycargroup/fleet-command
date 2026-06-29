/**
 * Payment Batch — Phase 2
 *
 * Identifies vendors with approved-but-unpaid recon work and sends
 * digest emails according to each vendor's payment_terms schedule.
 *
 * Stubs are active until Phase 2 is implemented.
 */

export async function runVendorDigest(): Promise<void> {
  // Phase 2: query vehicles, group by vendor, send digest emails
  console.log('[paymentBatch] runVendorDigest — not yet implemented (Phase 2)');
}

export async function runRolloverCheck(): Promise<void> {
  // Phase 2: catch any weekend/holiday jobs that missed their send window
  console.log('[paymentBatch] runRolloverCheck — not yet implemented (Phase 2)');
}
