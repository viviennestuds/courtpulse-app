export interface PersistedFeedbackRecord {
  id: string;
  notification_status: string;
  sentry_event_id: string | null;
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
 * Only a unique violation takes the replay path; other persistence failures remain failures.
 */
export async function persistFeedbackIdempotently<TRecord>(
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
  return { ok: true, record: existing.record, idempotentReplay: true };
}
