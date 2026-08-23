export type ObservabilityEnvironment = 'development' | 'preview' | 'production';

export type LogicalScreen =
  | 'games'
  | 'players'
  | 'teams'
  | 'playoffs'
  | 'game'
  | 'game_player'
  | 'player'
  | 'team'
  | 'analytics_lab'
  | 'other';

export interface RouteObservabilityContext {
  pathname: string;
  routePattern: string;
  screen: LogicalScreen;
  gameId?: string;
  playerId?: string;
  teamId?: string;
}

const FILTERED_VALUE = '[Filtered]';
const SENSITIVE_KEY_PATTERN = /^(?:actualbehavior|authorization|authtoken|body|contact|cookie|description|dsn|email|expectedbehavior|feedbackdescription|feedbacktext|filtertext|name|nbapayload|password|payload|query|querystring|rawactions|rawpayload|rawresponse|reportercontact|reporteremail|reportername|requestbody|responsebody|reproduction|reprosteps|search|searchinput|searchquery|secret|setcookie|testercontact|testername|title|token)$/i;
const URL_KEY_PATTERN = /^(?:url|uri|href)$/i;

function cleanPathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/$/, '') : '/';
}

function safeId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

/** Returns true when a non-empty runtime Sentry DSN is available. */
export function isObservabilityConfigured(dsn: string | undefined): boolean {
  return (dsn?.trim().length ?? 0) > 0;
}

/** Resolves the small environment vocabulary used by CourtPulse observability. */
export function resolveObservabilityEnvironment(
  isDevelopment: boolean,
  requestedEnvironment?: string,
): ObservabilityEnvironment {
  if (isDevelopment) return 'development';
  if (requestedEnvironment === 'preview') return 'preview';
  return 'production';
}

/** Removes query strings and fragments from URLs before they enter diagnostics. */
export function sanitizeObservabilityUrl(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

/** Builds a low-cardinality screen name plus privacy-safe dynamic route context. */
export function buildRouteObservabilityContext(pathname: string): RouteObservabilityContext {
  const cleanPath = cleanPathname(pathname);
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === '(tabs)')) {
    return { pathname: '/', routePattern: '/', screen: 'games' };
  }

  if (segments[0] === 'game' && segments.length >= 2) {
    const gameId = safeId(segments[1]);
    if (segments[2] === 'player' && segments.length >= 4) {
      return {
        pathname: cleanPath,
        routePattern: '/game/[id]/player/[playerId]',
        screen: 'game_player',
        gameId,
        playerId: safeId(segments[3]),
      };
    }
    return {
      pathname: cleanPath,
      routePattern: '/game/[id]',
      screen: 'game',
      gameId,
    };
  }

  if (segments[0] === 'player' && segments.length >= 2) {
    return {
      pathname: cleanPath,
      routePattern: '/player/[id]',
      screen: 'player',
      playerId: safeId(segments[1]),
    };
  }

  if (segments[0] === 'team' && segments.length >= 2) {
    return {
      pathname: cleanPath,
      routePattern: '/team/[id]',
      screen: 'team',
      teamId: safeId(segments[1]),
    };
  }

  const staticScreens: Record<string, LogicalScreen> = {
    players: 'players',
    teams: 'teams',
    playoffs: 'playoffs',
    lab: 'analytics_lab',
  };
  const screen = staticScreens[segments[segments.length - 1] ?? ''];
  if (screen) {
    return { pathname: cleanPath, routePattern: `/${segments[segments.length - 1]}`, screen };
  }

  return { pathname: cleanPath, routePattern: '/other', screen: 'other' };
}

/** Recursively removes known user-entered fields, credentials, payloads, and URL queries. */
export function scrubObservabilityValue(value: unknown, key?: string, depth = 0): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key.replace(/[_-]/g, ''))) return FILTERED_VALUE;
  if (depth > 8) return '[Truncated]';
  if (typeof value === 'string' && key && URL_KEY_PATTERN.test(key)) {
    return sanitizeObservabilityUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => scrubObservabilityValue(item, undefined, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      scrubbed[childKey] = scrubObservabilityValue(childValue, childKey, depth + 1);
    }
    return scrubbed;
  }
  return value;
}
