import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Required by signUp.authenticateWithRedirect()/signIn.authenticateWithRedirect()
 * (used by the custom Google/Apple buttons on the editorial signup screen)
 * — Clerk's OAuth redirect flow completes here before handing back to the
 * app. Public route (see src/proxy.ts) since the user isn't signed in yet
 * when this loads.
 */
export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
