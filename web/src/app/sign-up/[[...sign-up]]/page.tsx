import { SignUp } from "@clerk/nextjs";

/** See the note in ../sign-in/[[...sign-in]]/page.tsx — same deal. */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <SignUp />
    </div>
  );
}
