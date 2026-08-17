export type MatchupSummaryV2FailureCategory =
  | 'network'
  | 'timeout'
  | 'http408'
  | 'http429'
  | 'http5xx'
  | 'httpOther'
  | 'invalidJson'
  | 'proxyTransient'
  | 'proxySourceFailure'
  | 'unsupported'
  | 'contractReleaseMismatch'
  | 'schemaMismatch'
  | 'gameIdMismatch'
  | 'pairIdentityMismatch'
  | 'structuralValidation';

export interface MatchupSummaryV2ErrorMetadata {
  category: MatchupSummaryV2FailureCategory;
  retryable: boolean;
  httpStatus?: number;
  retryAfterMs?: number;
  sourceStatus?: string | null;
  errorCategory?: string | null;
  contractRelease?: string | null;
  schemaVersion?: string | null;
  validationPath?: string;
  validationReason?: string;
}

/** A classified SummaryV2 failure safe for retry and renderer decisions. */
export class MatchupSummaryV2Error extends Error {
  readonly category: MatchupSummaryV2FailureCategory;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly retryAfterMs?: number;
  readonly sourceStatus?: string | null;
  readonly errorCategory?: string | null;
  readonly contractRelease?: string | null;
  readonly schemaVersion?: string | null;
  readonly validationPath?: string;
  readonly validationReason?: string;

  constructor(message: string, metadata: MatchupSummaryV2ErrorMetadata) {
    super(message);
    this.name = 'MatchupSummaryV2Error';
    this.category = metadata.category;
    this.retryable = metadata.retryable;
    this.httpStatus = metadata.httpStatus;
    this.retryAfterMs = metadata.retryAfterMs;
    this.sourceStatus = metadata.sourceStatus;
    this.errorCategory = metadata.errorCategory;
    this.contractRelease = metadata.contractRelease;
    this.schemaVersion = metadata.schemaVersion;
    this.validationPath = metadata.validationPath;
    this.validationReason = metadata.validationReason;
  }
}

/** Returns true only for failures that can reasonably recover without a contract change. */
export function isRetryableMatchupSummaryV2Error(error: unknown): error is MatchupSummaryV2Error {
  return error instanceof MatchupSummaryV2Error && error.retryable;
}
