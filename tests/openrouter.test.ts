import assert from "node:assert/strict";
import test from "node:test";
import { getOpenRouterCredits } from "../lib/openrouter";

test("credit audit retries a transient timeout and then succeeds", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    if (urls.length === 1) throw new DOMException("Timed out", "TimeoutError");
    return new Response(JSON.stringify({ data: { total_credits: 10, total_usage: 2.5 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const credits = await getOpenRouterCredits("test-key", { attempts: 3, retryDelayMs: 0 });
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.endsWith("/credits")));
    assert.equal(credits.remainingCredits, 7.5);
    assert.equal(credits.label, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("credit audit falls back to current key metadata after every credits request times out", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/credits")) throw new DOMException("Timed out", "TimeoutError");
    return new Response(JSON.stringify({ data: { usage: 3, limit: 12, limit_remaining: 8.5, label: "fallback-key" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const credits = await getOpenRouterCredits("test-key", { attempts: 3, retryDelayMs: 0 });
    assert.equal(urls.filter(url => url.endsWith("/credits")).length, 3);
    assert.equal(urls.filter(url => url.endsWith("/key")).length, 1);
    assert.equal(credits.remainingCredits, 8.5);
    assert.equal(credits.label, "fallback-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
