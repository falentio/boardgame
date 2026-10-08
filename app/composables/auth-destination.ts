import type { RouteLocationRaw } from "vue-router";
import { sameOriginPath } from "./safe-redirect";

/** Query key that carries the post-auth destination across an auth redirect. */
export const REDIRECT_QUERY = "redirect" as const;

export type AuthPage = "/login" | "/signup";

export interface AuthDestination {
  /** Same-origin path to land on once the auth call succeeds. "/" when absent or unsafe. */
  readonly afterAuth: string;
  /** The sibling auth page, carrying afterAuth so a form switch keeps it. */
  readonly sibling: RouteLocationRaw;
}

/** Pure: parses the untrusted redirect query once. A missing, non-string, off-origin,
 *  protocol-relative, or backslash value collapses to "/". */
export function authDestination(
  redirect: unknown,
  origin: string,
  sibling: AuthPage,
): AuthDestination {
  const afterAuth = sameOriginPath(redirect, origin);
  return {
    afterAuth,
    sibling:
      afterAuth === "/"
        ? { path: sibling }
        : { path: sibling, query: { [REDIRECT_QUERY]: afterAuth } },
  };
}

export function useAuthDestination(sibling: AuthPage): AuthDestination {
  return authDestination(useRoute().query[REDIRECT_QUERY], useRequestURL().origin, sibling);
}
