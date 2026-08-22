"use client";

import { useRouter } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";

/** Clerk's prebuilt account management UI, same "not yet restyled" note
 *  as the sign-in/sign-up pages. */
export default function AccountSettingsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <div className="flex flex-shrink-0 items-center gap-3 px-3.5 pt-3.5 pb-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-7 w-7 items-center justify-center"
        >
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12.5 4.5L6.5 10l6 5.5" />
          </svg>
        </button>
        <span className="text-[13px] font-bold">Account &amp; sign-in</span>
      </div>
      <div className="flex flex-1 justify-center overflow-x-auto px-2 pb-4">
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
