"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useSessionStore } from "@/lib/store/session";
import { exportUserData } from "@/lib/exportData";

export default function DataExportPage() {
  const router = useRouter();
  const dek = useSessionStore((s) => s.dek);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!dek) return;
    setExporting(true);
    setError(null);
    try {
      await exportUserData(dek);
    } catch {
      setError("Couldn't export your data. Try again.");
    } finally {
      setExporting(false);
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

      <main className="flex-1 w-full max-w-2xl mx-auto px-container-padding py-stack-gap flex flex-col gap-stack-gap pb-24">
        <section className="text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2 shadow-sm">
            <MaterialIcon name="ios_share" size={28} />
          </div>
          <h2 className="font-editorial-display text-headline-md text-on-surface">Export Your Journal</h2>
          <p className="text-body-md text-on-surface-variant max-w-md">
            Download a complete copy of your reflections. Your data remains yours.
          </p>
        </section>

        <section className="flex flex-col gap-inline-gap mt-4">
          <h3 className="text-label-sm text-on-surface-variant uppercase tracking-wider">Format</h3>
          <div className="relative flex rounded-xl border border-primary bg-surface-container-lowest p-5">
            <div className="flex items-start gap-4">
              <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-on-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-editorial-display text-headline-md text-on-surface mb-1 flex items-center gap-2">
                  <MaterialIcon name="data_object" className="text-primary" size={20} />
                  JSON
                </span>
                <span className="text-body-md text-on-surface-variant">
                  Structured data, ideal for backups or importing into other tools.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 bg-surface-container-low rounded-xl p-5 border border-surface-dim/30 flex items-start gap-4">
          <MaterialIcon name="enhanced_encryption" className="text-primary mt-1" />
          <div className="flex flex-col gap-2">
            <h3 className="text-label-sm text-on-surface">Local Decryption Process</h3>
            <p className="text-body-md text-on-surface-variant">
              Your journal entries are stored end-to-end encrypted. Before generating the export
              file, everything is decrypted locally on this device. Plaintext is never sent to our
              servers.
            </p>
          </div>
        </section>

        {error && <p className="text-sm text-error text-center">{error}</p>}

        <section className="mt-8 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !dek}
            className="w-full bg-primary text-on-primary rounded-full py-4 px-6 text-label-sm hover:bg-on-primary-fixed-variant transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(74,101,78,0.15)] disabled:opacity-50"
          >
            <span>{exporting ? "Decrypting…" : "Prepare Export"}</span>
            <MaterialIcon name="download" size={18} />
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full bg-transparent text-primary border border-primary rounded-full py-4 px-6 text-label-sm hover:bg-surface-container-low transition-all"
          >
            Cancel
          </button>
        </section>

        <div className="flex justify-center items-center gap-2 mt-4 text-outline">
          <MaterialIcon name="lock" filled size={16} />
          <span className="text-label-sm uppercase tracking-widest">End-to-End Encrypted</span>
        </div>
      </main>
    </div>
  );
}
