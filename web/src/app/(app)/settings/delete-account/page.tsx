"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { MaterialIcon } from "@/components/MaterialIcon";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === "DELETE";

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      await signOut({ redirectUrl: "/" });
    } catch {
      setError("Couldn't delete your account. Try again, or contact support.");
      setDeleting(false);
    }
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
      <header className="w-full top-0 sticky bg-background flex justify-between items-center px-container-padding h-16 z-40">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-primary hover:opacity-80 transition-opacity p-2 -ml-2"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <h1 className="font-editorial-display text-headline-md text-primary">The Nook</h1>
        <span className="w-10" />
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-container-padding py-stack-gap max-w-2xl mx-auto w-full">
        <div className="text-center mb-stack-gap w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mb-inline-gap">
            <MaterialIcon name="warning" filled className="text-error" size={32} />
          </div>
          <h2 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-on-background mb-2">
            Delete Account
          </h2>
          <p className="text-body-lg text-on-surface-variant max-w-md mx-auto">
            This action is permanent and cannot be undone.
          </p>
        </div>

        <div className="bg-error-container/40 border border-error/20 rounded-xl p-container-padding w-full mb-stack-gap text-left shadow-sm">
          <h3 className="text-label-sm uppercase text-error mb-2">Critical Warning</h3>
          <p className="text-body-md text-on-error-container mb-3">
            Deleting your account will permanently erase:
          </p>
          <ul className="list-disc list-inside text-body-md text-on-error-container space-y-2 ml-2">
            <li>All journal entries and reflections.</li>
            <li>Saved manifestations and their signals.</li>
            <li>Your encryption keys and recovery phrase.</li>
          </ul>
        </div>

        <div className="w-full mb-stack-gap">
          <label htmlFor="confirm-delete" className="block text-label-sm text-on-surface-variant mb-2 uppercase">
            Type &lsquo;DELETE&rsquo; to confirm
          </label>
          <input
            id="confirm-delete"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full bg-surface-container-low border-0 border-b border-outline-variant focus:border-error focus:ring-0 px-4 py-3 text-body-lg text-on-background transition-colors rounded-t-lg placeholder:text-outline"
          />
        </div>

        {error && <p className="text-sm text-error mb-4">{error}</p>}

        <div className="w-full flex flex-col gap-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className={`w-full py-4 rounded-full text-label-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              canDelete
                ? "bg-error text-on-error hover:opacity-90 shadow-sm"
                : "bg-surface-dim text-outline cursor-not-allowed"
            }`}
          >
            <MaterialIcon name="delete_forever" size={18} />
            {deleting ? "Deleting…" : "Delete Permanently"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full border border-primary text-primary py-4 rounded-full text-label-sm uppercase tracking-wider hover:bg-primary-container hover:text-on-primary-container transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-stack-gap flex items-center justify-center text-on-surface-variant opacity-70">
          <MaterialIcon name="lock" size={16} className="mr-1" />
          <span className="text-label-sm">There is no recovery for this — it cannot be undone</span>
        </div>
      </main>
    </div>
  );
}
