export const IDEMPOTENCY_PAYLOAD_MISMATCH = "idempotency_payload_mismatch";

export interface ReplayComparableFeedbackSubmission {
  category: string;
  title: string;
  description: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  reproSteps?: string;
  reporterName?: string;
  reporterContact?: string;
}

export interface PersistedFeedbackRecord {
  id: string;
  notification_status: string;
  sentry_event_id: string | null;
  content_fingerprint: string;
}

export interface PersistedFeedbackReplayRecord extends PersistedFeedbackRecord {
  category: string;
  title: string;
  description: string;
  expected_behavior: string | null;
  actual_behavior: string | null;
  repro_steps: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
}

export interface PersistenceAttempt<TRecord> {
  record: TRecord | null;
  errorCode?: string;
}

export type IdempotentPersistenceResult<TRecord> =
  | { ok: true; record: TRecord; idempotentReplay: boolean }
  | { ok: false; errorCode: string };

function optionalValuesMatch(persisted: string | null, incoming: string | undefined): boolean {
  return persisted === (incoming ?? null);
}

/** Compares only server-validated user-authored fields that define one logical feedback submission. */
export function isEquivalentFeedbackReplay(
  persisted: PersistedFeedbackReplayRecord,
  incoming: ReplayComparableFeedbackSubmission,
): boolean {
  return persisted.category === incoming.category
    && persisted.title === incoming.title
    && persisted.description === incoming.description
    && optionalValuesMatch(persisted.expected_behavior, incoming.expectedBehavior)
    && optionalValuesMatch(persisted.actual_behavior, incoming.actualBehavior)
    && optionalValuesMatch(persisted.repro_steps, incoming.reproSteps)
    && optionalValuesMatch(persisted.reporter_name, incoming.reporterName)
    && optionalValuesMatch(persisted.reporter_contact, incoming.reporterContact);
}

/**
 * Inserts before reading so PostgreSQL's unique submission_id constraint is the race-safe arbiter.
 * Only a unique violation takes the replay path; complete validated user-authored equivalence proves a retry.
 * Other persistence failures and payload mismatches remain failures without mutating the first row.
 */
export async function persistFeedbackIdempotently<
  TInsertedRecord extends PersistedFeedbackRecord,
  TReplayRecord extends PersistedFeedbackReplayRecord,
>(
  incoming: ReplayComparableFeedbackSubmission,
  insert: () => Promise<PersistenceAttempt<TInsertedRecord>>,
  loadExisting: () => Promise<PersistenceAttempt<TReplayRecord>>,
): Promise<IdempotentPersistenceResult<TInsertedRecord | TReplayRecord>> {
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
  if (!isEquivalentFeedbackReplay(existing.record, incoming)) {
    return { ok: false, errorCode: IDEMPOTENCY_PAYLOAD_MISMATCH };
  }
  return { ok: true, record: existing.record, idempotentReplay: true };
}
