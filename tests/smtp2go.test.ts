import assert from "node:assert/strict";
import test from "node:test";
import { sendWorkflowFailureAlert } from "../lib/smtp2go";
import { getEmailAddresses, recipientLabel, RECIPIENT_NOT_CONFIGURED } from "../lib/email-config";

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

test("emails are not sent when recipient or sender env is missing", async () => {
  const originalFetch = globalThis.fetch;
  const saved = { recipient: process.env.RECIPIENT_EMAIL, sender: process.env.SENDER_EMAIL };
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  delete process.env.RECIPIENT_EMAIL;
  delete process.env.SENDER_EMAIL;

  try {
    const sent = await sendWorkflowFailureAlert({ stage: "test", reason: "test", apiKey: "test-smtp-key" });
    assert.equal(sent, false);
    assert.equal(called, false);
    assert.equal(recipientLabel(), RECIPIENT_NOT_CONFIGURED);
    process.env.RECIPIENT_EMAIL = " owner@example.com ";
    assert.deepEqual(getEmailAddresses(), { recipient: "owner@example.com", sender: undefined });
  } finally {
    globalThis.fetch = originalFetch;
    if (saved.recipient === undefined) delete process.env.RECIPIENT_EMAIL; else process.env.RECIPIENT_EMAIL = saved.recipient;
    if (saved.sender === undefined) delete process.env.SENDER_EMAIL; else process.env.SENDER_EMAIL = saved.sender;
  }
});
