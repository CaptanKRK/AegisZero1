/*
 * checkEmailBreaches(email)
 * - Reads stored HIBP API key from chrome.storage.local ('hibpApiKey').
 * - If key present: calls HaveIBeenPwned v3 'breachedaccount' endpoint
 *   and returns structured result: { status: 'ok', result: { breachCount, breaches } }
 * - If no key present: returns { status: 'manual', message: 'No HIBP API key configured.' }
 * - Handles 404 (no breaches) as 0 breaches, 429 as rate-limited, and other errors.
 * - Attaches the function to window.checkEmailBreaches for consumers.
 */

async function checkEmailBreaches(email) {
  if (!email || typeof email !== 'string') {
    return { status: 'error', error: 'invalid_email', message: 'Email must be a non-empty string' };
  }

  // basic normalization
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return { status: 'error', error: 'invalid_email_format', message: 'Email format is invalid' };
  }

  // Read HIBP API key from chrome.storage.local
  const getKey = () => new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['hibpApiKey'], (items) => {
          resolve(items?.hibpApiKey || null);
        });
      } else {
        resolve(null);
      }
    } catch (err) {
      resolve(null);
    }
  });

  const apiKey = await getKey();
  if (!apiKey) {
    // No API key configured; instruct UI to use manual flow
    return {
      status: 'manual',
      message: 'No HIBP API key configured. Please add an API key in extension settings or visit https://haveibeenpwned.com to check the address manually.'
    };
  }

  const endpoint = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(normalized)}?truncateResponse=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'hibp-api-key': apiKey,
        'User-Agent': 'AEGIS-Extension/1.0 (contact@example.com)'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.status === 404) {
      // No breaches found for this account
      return { status: 'ok', result: { breachCount: 0, breaches: [] } };
    }

    if (resp.status === 429) {
      return { status: 'error', error: 'rate_limited', message: 'HaveIBeenPwned rate limit reached. Try again later.' };
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { status: 'error', error: 'http_error', statusCode: resp.status, message: text || resp.statusText };
    }

    const data = await resp.json();
    // data is an array of breach objects
    const breaches = Array.isArray(data) ? data : [];
    return {
      status: 'ok',
      result: {
        breachCount: breaches.length,
        breaches
      }
    };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { status: 'error', error: 'timeout', message: 'HIBP request timed out' };
    }
    return { status: 'error', error: 'fetch_error', message: err?.message || String(err) };
  }
}

// Expose for other scripts to call. Consumers can await window.checkEmailBreaches(email)
try {
  window.checkEmailBreaches = checkEmailBreaches;
} catch (e) {
  // In environments where window isn't available, ignore
}
