import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/validation/auth";
import { bookSearchQuerySchema } from "@/lib/validation/books";
import { createProfileSchema, suggestUsername, usernameSchema } from "@/lib/validation/profile";
import { upsertShelfEntrySchema } from "@/lib/validation/shelf";

describe("usernameSchema", () => {
  it.each(["abc", "jane_doe", "reader_2026", "a".repeat(20)])("accepts %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it.each(["ab", "a".repeat(21), "jane-doe", "jane doe", "jané", "admin", "me"])(
    "rejects %s",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    },
  );

  it("lowercases and trims", () => {
    expect(usernameSchema.parse("  JaneDoe ")).toBe("janedoe");
  });
});

describe("createProfileSchema", () => {
  it("defaults to a public profile and nulls an empty display name", () => {
    expect(createProfileSchema.parse({ username: "jane", displayName: "  " })).toEqual({
      username: "jane",
      displayName: null,
      isPublic: true,
    });
  });

  it("rejects display names over 50 characters", () => {
    const result = createProfileSchema.safeParse({ username: "jane", displayName: "x".repeat(51) });
    expect(result.success).toBe(false);
  });
});

describe("suggestUsername", () => {
  it.each([
    ["jane.doe@example.com", "jane_doe"],
    ["J-Smith+books@x.io", "j_smith_books"],
    ["ab@x.io", ""],
    ["admin@x.io", ""],
    [null, ""],
  ])("%s → %s", (email, expected) => {
    expect(suggestUsername(email)).toBe(expected);
  });
});

describe("upsertShelfEntrySchema", () => {
  it("accepts a full read entry", () => {
    expect(
      upsertShelfEntrySchema.parse({
        olWorkId: "OL86318W",
        status: "read",
        rating: 5,
        finishedOn: "2026-06-16",
      }),
    ).toEqual({
      book: { kind: "openLibrary", olWorkId: "OL86318W" },
      status: "read",
      rating: 5,
      finishedOn: "2026-06-16",
    });
  });

  it("accepts our book id instead of an Open Library id", () => {
    const bookId = "2b1f7c9e-6a7d-4d3c-9f61-0c7a3c2e5b11";
    expect(upsertShelfEntrySchema.parse({ bookId, status: "want" })).toEqual({
      book: { kind: "id", bookId },
      status: "want",
      rating: null,
      finishedOn: null,
    });
  });

  it("drops rating and date for want-to-read, and date for reading", () => {
    expect(
      upsertShelfEntrySchema.parse({
        olWorkId: "OL1W",
        status: "want",
        rating: 3,
        finishedOn: "2026-01-01",
      }),
    ).toMatchObject({ rating: null, finishedOn: null });
    expect(
      upsertShelfEntrySchema.parse({
        olWorkId: "OL1W",
        status: "reading",
        rating: 3,
        finishedOn: "2026-01-01",
      }),
    ).toMatchObject({ rating: 3, finishedOn: null });
  });

  it.each([
    { olWorkId: "OL1M", status: "read" },
    { olWorkId: "OL1W", status: "finished" },
    { olWorkId: "OL1W", status: "read", rating: 6 },
    { olWorkId: "OL1W", status: "read", rating: 2.5 },
    { olWorkId: "OL1W", status: "read", finishedOn: "16/06/2026" },
    { status: "read" },
    { olWorkId: "OL1W", bookId: "2b1f7c9e-6a7d-4d3c-9f61-0c7a3c2e5b11", status: "read" },
    { bookId: "not-a-uuid", status: "read" },
  ])("rejects %o", (input) => {
    expect(upsertShelfEntrySchema.safeParse(input).success).toBe(false);
  });
});

describe("bookSearchQuerySchema", () => {
  it("requires 2–100 characters after trimming", () => {
    expect(bookSearchQuerySchema.safeParse({ q: " u " }).success).toBe(false);
    expect(bookSearchQuerySchema.safeParse({ q: "ul" }).success).toBe(true);
    expect(bookSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/me", "/me"],
    ["/add?x=1", "/add?x=1"],
    [null, "/me"],
    ["", "/me"],
    ["https://evil.example", "/me"],
    ["//evil.example", "/me"],
    ["/\\evil.example", "/me"],
    ["me", "/me"],
    ["/me\r\nSet-Cookie: x", "/me"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
