/** Email addresses come only from env so personal addresses never live in this public repo. */
export function getEmailAddresses(): { recipient?: string; sender?: string } {
  return {
    recipient: process.env.RECIPIENT_EMAIL?.trim() || undefined,
    sender: process.env.SENDER_EMAIL?.trim() || undefined,
  };
}

export const RECIPIENT_NOT_CONFIGURED = "RECIPIENT_EMAIL not set";

/** Recipient for status records; a readable placeholder when env is missing. */
export function recipientLabel(): string {
  return getEmailAddresses().recipient || RECIPIENT_NOT_CONFIGURED;
}
