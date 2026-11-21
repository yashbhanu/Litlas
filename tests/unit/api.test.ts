import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiError, parseJsonBody } from "@/lib/api";

describe("apiError", () => {
  it("returns the typed error shape with a matching status", async () => {
    const response = apiError("not_found", "Nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Nope" } });
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ n: z.number() });
  const post = (body: string) => new Request("http://x.test", { method: "POST", body });

  it("returns parsed data", async () => {
    expect(await parseJsonBody(post('{"n":1}'), schema)).toEqual({ data: { n: 1 } });
  });

  it("400s on invalid JSON", async () => {
    const { response } = await parseJsonBody(post("{"), schema);
    expect(response?.status).toBe(400);
  });

  it("400s with the failing field on schema errors", async () => {
    const { response } = await parseJsonBody(post('{"n":"1"}'), schema);
    expect(response?.status).toBe(400);
    const body = (await response!.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toMatch(/^n: /);
  });
});
