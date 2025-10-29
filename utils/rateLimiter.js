// Simple rate limiter to avoid hitting VoyageAI rate limits during development
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 20000; // 20 seconds between requests for free tier (3 RPM = 1 request per 20s)

/**
 * Add a small delay between API requests to avoid rate limiting
 * @param {number} minInterval - Minimum milliseconds between requests (default: 20000ms for free tier)
 */
export async function rateLimitDelay(minInterval = MIN_REQUEST_INTERVAL) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < minInterval) {
    const delay = minInterval - timeSinceLastRequest;
    console.log(`⏱️ Rate limiting: waiting ${delay}ms (free tier: 3 RPM)...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
}
