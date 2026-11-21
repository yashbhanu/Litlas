import { expect } from "@playwright/test";

/** Local Supabase captures auth emails in Mailpit instead of sending them. */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSearch {
  messages: { ID: string }[];
}

interface MailpitMessage {
  Text: string;
  HTML: string;
}

/** Wait for the latest auth email to `email` and return the sign-in link in it. */
export async function getMagicLink(email: string): Promise<string> {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        const body = (await res.json()) as MailpitSearch;
        messageId = body.messages[0]?.ID;
        return messageId;
      },
      { message: `waiting for an email to ${email}`, timeout: 15_000 },
    )
    .toBeTruthy();

  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const message = (await res.json()) as MailpitMessage;
  const link = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(
    message.Text || message.HTML,
  )?.[0];
  if (!link) throw new Error("No sign-in link found in email");
  return link.replace(/&amp;/g, "&");
}
