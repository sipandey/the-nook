import { SignIn } from "@clerk/nextjs";

/**
 * Clerk's prebuilt component for now, not the fully custom-styled
 * AccountAuth.dc.html mockup — that's a follow-up (Clerk's `appearance`
 * prop can theme this to match the sage tokens once the rest of the app
 * is further along).
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <SignIn />
    </div>
  );
}
