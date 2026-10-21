import assert from "node:assert/strict";
import test from "node:test";
import { sendWorkflowFailureAlert } from "../lib/smtp2go";

test("workflow failure alert explains that generation never started", async () => {
  const originalFetch = globalThis.fetch;
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: { succeeded: 1 } }), { status: 200 });
  };

  try {
    const sent = await sendWorkflowFailureAlert({
      stage: "OpenRouter credit audit",
      reason: "Credit API unavailable <temporarily>",
      recipientEmail: "owner@example.com",
      senderEmail: "system@example.com",
      apiKey: "test-smtp-key",
    });
    assert.equal(sent, true);
    assert.match(String(payload?.subject), /stopped before generation/);
    assert.match(String(payload?.text_body), /No image-generation credit was used/);
    assert.match(String(payload?.html_body), /&lt;temporarily&gt;/);
    assert.doesNotMatch(String(payload?.html_body), /<temporarily>/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
