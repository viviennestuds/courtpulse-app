import { Platform } from 'react-native';

const NBA_CDN_BASE = 'https://cdn.nba.com/static/json/liveData';
const NBA_CDN_STATIC_BASE = 'https://cdn.nba.com/static/json/staticData';
const NBA_STATS_BASE = 'https://stats.nba.com/stats';

const CORS_PROXIES = [
  { name: 'corsproxy.io', build: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'allorigins', build: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'corsanywhere', build: (url: string) => `https://cors-anywhere.herokuapp.com/${url}` },
];

const STATS_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
};

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parsePTClock(ptClock: string | null | undefined): string {
  if (!ptClock) return '';
  const match = ptClock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return ptClock.replace('PT', '').replace('M', ':').replace('S', '');
  const minutes = parseInt(match[1], 10);
  const seconds = Math.floor(parseFloat(match[2]));
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function parsePTToSeconds(ptClock: string | null | undefined): number {
  if (!ptClock) return 0;
  const match = ptClock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseFloat(match[2]);
}

export function parsePTMinutes(ptMinutes: string | null | undefined): string {
  if (!ptMinutes) return '0:00';
  const match = ptMinutes.match(/PT(\d+)M([\d.]*)?S?/);
  if (!match) return ptMinutes;
  const mins = parseInt(match[1], 10);
  const secs = match[2] ? Math.floor(parseFloat(match[2])) : 0;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatGameDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatGameDate(new Date());
}

export interface FetchDiagnostics {
  url: string;
  proxyUsed: string;
  httpStatus: number;
  responseSnippet: string;
  schemaValid: boolean;
  errorDetail: string;
}

let lastDiagnostics: FetchDiagnostics | null = null;

export function getLastFetchDiagnostics(): FetchDiagnostics | null {
  return lastDiagnostics;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries: number = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[NBA API] Fetching: ${url.substring(0, 120)}... (attempt ${attempt + 1})`);
      const response = await fetchWithTimeout(url, options);

      if (response.ok) {
        console.log(`[NBA API] Success: HTTP ${response.status}`);
        return response;
      }

      if (response.status === 429) {
        console.warn(`[NBA API] Rate limited, waiting before retry...`);
        await sleep(RETRY_DELAY_MS * (attempt + 2));
        continue;
      }

      if (response.status >= 500 && attempt < retries) {
        console.warn(`[NBA API] Server error ${response.status}, retrying...`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      if (err.name === 'AbortError') {
        console.warn(`[NBA API] Timeout on attempt ${attempt + 1}`);
      }

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error('Failed to fetch NBA data');
}

function validateJsonResponse(data: unknown, label: string): { valid: boolean; errorDetail: string } {
  if (data === null || data === undefined) {
    return { valid: false, errorDetail: `${label}: response is null/undefined` };
  }
  if (typeof data !== 'object') {
    return { valid: false, errorDetail: `${label}: response is not an object (got ${typeof data})` };
  }
  const obj = data as Record<string, unknown>;
  if (obj.error) {
    return { valid: false, errorDetail: `${label}: proxy error - ${String(obj.error).substring(0, 200)}` };
  }
  if (obj.message && typeof obj.message === 'string' && !obj.scoreboard && !obj.game && !obj.resultSets) {
    return { valid: false, errorDetail: `${label}: error message - ${obj.message.substring(0, 200)}` };
  }
  return { valid: true, errorDetail: '' };
}

async function fetchViaProxy(rawUrl: string, options: RequestInit = {}): Promise<{ data: unknown; proxyName: string; responseText: string }> {
  const errors: string[] = [];

  for (const proxy of CORS_PROXIES) {
    const proxyUrl = proxy.build(rawUrl);
    try {
      console.log(`[NBA API] Trying proxy "${proxy.name}" for: ${rawUrl.substring(0, 80)}...`);
      const response = await fetchWithTimeout(proxyUrl, options, DEFAULT_TIMEOUT);
      const responseText = await response.text();

      console.log(`[NBA API] Proxy "${proxy.name}" HTTP ${response.status}, body length: ${responseText.length}`);
      console.log(`[NBA API] Response snippet: ${responseText.substring(0, 200)}`);

      if (!response.ok) {
        errors.push(`${proxy.name}: HTTP ${response.status} - ${responseText.substring(0, 100)}`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        errors.push(`${proxy.name}: Not valid JSON - ${responseText.substring(0, 100)}`);
        continue;
      }

      const validation = validateJsonResponse(parsed, proxy.name);
      if (!validation.valid) {
        errors.push(validation.errorDetail);
        console.warn(`[NBA API] Proxy "${proxy.name}" returned invalid payload: ${validation.errorDetail}`);
        continue;
      }

      console.log(`[NBA API] Proxy "${proxy.name}" returned valid JSON`);
      return { data: parsed, proxyName: proxy.name, responseText };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${proxy.name}: ${msg}`);
      console.warn(`[NBA API] Proxy "${proxy.name}" failed: ${msg}`);
    }
  }

  throw new Error(`All CORS proxies failed for ${rawUrl}:\n${errors.join('\n')}`);
}

export async function fetchNbaCdnStatic<T>(path: string): Promise<T> {
  const rawUrl = `${NBA_CDN_STATIC_BASE}/${path}`;
  return fetchNbaCdnUrl<T>(rawUrl);
}

export async function fetchNbaCdn<T>(path: string): Promise<T> {
  const rawUrl = `${NBA_CDN_BASE}/${path}`;
  return fetchNbaCdnUrl<T>(rawUrl);
}

async function fetchNbaCdnUrl<T>(rawUrl: string): Promise<T> {

  if (Platform.OS !== 'web') {
    console.log(`[NBA API] CDN direct fetch: ${rawUrl}`);
    const response = await fetchWithRetry(rawUrl);
    const text = await response.text();
    console.log(`[NBA API] CDN response length: ${text.length}, snippet: ${text.substring(0, 150)}`);

    const data = JSON.parse(text);
    const validation = validateJsonResponse(data, 'CDN');
    lastDiagnostics = {
      url: rawUrl,
      proxyUsed: 'none (native)',
      httpStatus: 200,
      responseSnippet: text.substring(0, 200),
      schemaValid: validation.valid,
      errorDetail: validation.errorDetail,
    };
    if (!validation.valid) {
      throw new Error(validation.errorDetail);
    }
    return data as T;
  }

  console.log(`[NBA API] CDN proxied fetch: ${rawUrl}`);
  const { data, proxyName, responseText } = await fetchViaProxy(rawUrl);

  lastDiagnostics = {
    url: rawUrl,
    proxyUsed: proxyName,
    httpStatus: 200,
    responseSnippet: responseText.substring(0, 200),
    schemaValid: true,
    errorDetail: '',
  };

  return data as T;
}

export async function fetchNbaStats<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const rawUrl = `${NBA_STATS_BASE}/${endpoint}?${queryString}`;

  const headers: Record<string, string> = { ...STATS_HEADERS };

  if (Platform.OS !== 'web') {
    headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    console.log(`[NBA API] Stats direct fetch: ${rawUrl.substring(0, 120)}...`);
    const response = await fetchWithRetry(rawUrl, { headers });
    const text = await response.text();
    console.log(`[NBA API] Stats response length: ${text.length}`);
    const data = JSON.parse(text);
    const validation = validateJsonResponse(data, 'Stats');
    if (!validation.valid) {
      throw new Error(validation.errorDetail);
    }
    return data as T;
  }

  console.log(`[NBA API] Stats proxied fetch: ${rawUrl.substring(0, 120)}...`);
  const { data } = await fetchViaProxy(rawUrl, { headers });
  return data as T;
}

export function getPeriodText(period: number, gameStatus: number): string {
  if (gameStatus === 1) return '';
  if (gameStatus === 3) {
    if (period <= 4) return 'Final';
    return `Final/OT${period > 5 ? period - 4 : ''}`;
  }
  if (period <= 4) return `Q${period}`;
  return `OT${period > 5 ? period - 4 : ''}`;
}

export function getStatusClockText(gameStatus: number, gameStatusText: string, gameClock: string | null): string {
  if (gameStatus === 1) {
    return gameStatusText?.trim() ?? 'TBD';
  }
  if (gameStatus === 3) return '';
  return parsePTClock(gameClock);
}

export function getGameStatus(gameStatus: number): 'live' | 'final' | 'scheduled' {
  if (gameStatus === 1) return 'scheduled';
  if (gameStatus === 2) return 'live';
  return 'final';
}

export const NBA_SEASON = '2024-25';
export const NBA_SEASON_TYPE = 'Regular+Season';
