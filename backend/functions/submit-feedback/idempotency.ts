export const IDEMPOTENCY_PAYLOAD_MISMATCH = "idempotency_payload_mismatch";

export interface PersistedFeedbackRecord {
  id: string;
  notification_status: string;
  sentry_event_id: string | null;
  content_fingerprint: string;
}

export interface PersistenceAttempt<TRecord> {
  record: TRecord | null;
  errorCode?: string;
}

export type IdempotentPersistenceResult<TRecord> =
  | { ok: true; record: TRecord; idempotentReplay: boolean }
  | { ok: false; errorCode: string };

/**
 * Inserts before reading so PostgreSQL's unique submission_id constraint is the race-safe arbiter.
 * Only a unique violation takes the replay path; matching fingerprints prove an equivalent retry.
 * Other persistence failures and payload mismatches remain failures without mutating the first row.
 */
export async function persistFeedbackIdempotently<TRecord extends PersistedFeedbackRecord>(
  incomingContentFingerprint: string,
  insert: () => Promise<PersistenceAttempt<TRecord>>,
  loadExisting: () => Promise<PersistenceAttempt<TRecord>>,
): Promise<IdempotentPersistenceResult<TRecord>> {
  const inserted = await insert();
  if (inserted.record) {
    return { ok: true, record: inserted.record, idempotentReplay: false };
  }
  if (inserted.errorCode !== "23505") {
    return { ok: false, errorCode: inserted.errorCode ?? "missing_record" };
  }

  const existing = await loadExisting();
  if (!existing.record) {
    return { ok: false, errorCode: existing.errorCode ?? "replay_record_unavailable" };
  }
  if (existing.record.content_fingerprint !== incomingContentFingerprint) {
    return { ok: false, errorCode: IDEMPOTENCY_PAYLOAD_MISMATCH };
  }
  return { ok: true, record: existing.record, idempotentReplay: true };
}
