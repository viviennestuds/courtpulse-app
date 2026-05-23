"""HTTP client for NBA CDN and stats.nba.com endpoints with retry logic."""
import logging
import httpx

logger = logging.getLogger(__name__)

NBA_CDN_BASE = "https://cdn.nba.com/static/json/liveData"
NBA_STATS_BASE = "https://stats.nba.com/stats"

STATS_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

MAX_RETRIES = 2
TIMEOUT = 15.0


async def fetch_cdn_json(path: str) -> dict:
    url = f"{NBA_CDN_BASE}/{path}"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(MAX_RETRIES + 1):
            try:
                logger.info(f"[NBA CDN] Fetching {url} (attempt {attempt + 1})")
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                raise
    raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES + 1} attempts")


async def fetch_stats_endpoint(endpoint: str, params: dict) -> dict:
    url = f"{NBA_STATS_BASE}/{endpoint}"
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=STATS_HEADERS) as client:
        for attempt in range(MAX_RETRIES + 1):
            try:
                logger.info(f"[NBA Stats] Fetching {url} (attempt {attempt + 1})")
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                raise
    raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES + 1} attempts")
