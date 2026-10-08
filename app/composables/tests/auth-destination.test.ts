import { expect, test } from "vitest";
import { authDestination, REDIRECT_QUERY } from "../auth-destination.ts";

const ORIGIN = "http://localhost";

const carriedRedirect = (sibling: unknown): unknown =>
  (sibling as { query: Record<string, unknown> }).query[REDIRECT_QUERY];

test("round-trips a join destination across the sibling switch", () => {
  const first = authDestination("/join/ABC", ORIGIN, "/signup");
  expect(first).toEqual({
    afterAuth: "/join/ABC",
    sibling: { path: "/signup", query: { redirect: "/join/ABC" } },
  });

  const second = authDestination(carriedRedirect(first.sibling), ORIGIN, "/login");
  expect(second).toEqual({
    afterAuth: "/join/ABC",
    sibling: { path: "/login", query: { redirect: "/join/ABC" } },
  });
});

test("omits the query for a missing or root destination", () => {
  expect(authDestination(undefined, ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
  expect(authDestination("/", ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
});

test("drops an off-origin destination before it reaches the link", () => {
  expect(authDestination("https://evil.example.com", ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
  expect(authDestination("//evil.example.com", ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
});

test("collapses a non-string or empty destination", () => {
  expect(authDestination("", ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
  expect(authDestination(42, ORIGIN, "/signup")).toEqual({
    afterAuth: "/",
    sibling: { path: "/signup" },
  });
});
