import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/landing/hero";

describe("Landing hero", () => {
  it("renders the headline and a sign-up call to action", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1, name: "Read around the world." })).toBeDefined();
    expect(screen.getByRole("link", { name: /Start your map/ }).getAttribute("href")).toBe(
      "/login?next=/me",
    );
  });
});
