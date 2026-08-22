"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ManifestationForm } from "@/components/manifestation/ManifestationForm";
import { useManifestations, useDecryptedManifestations } from "@/lib/hooks/useManifestations";
import { useSessionStore } from "@/lib/store/session";

export default function EditManifestationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: manifestations, isLoading } = useManifestations();
  const dek = useSessionStore((s) => s.dek);

  const manifestation = useMemo(
    () => manifestations?.find((m) => m.id === id),
    [manifestations, id],
  );
  const decrypted = useDecryptedManifestations(
    useMemo(() => (manifestation ? [manifestation] : undefined), [manifestation]),
    dek,
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!manifestation) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-sm text-muted">Couldn&rsquo;t find that manifestation.</p>
        <Link href="/manifestations" className="text-sm font-semibold text-accent">
          Back to manifestations
        </Link>
      </div>
    );
  }

  const text = decrypted[manifestation.id];
  if (text === undefined) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background">
        <p className="text-sm text-muted">Decrypting…</p>
      </div>
    );
  }

  return (
    <ManifestationForm
      manifestationId={manifestation.id}
      initialText={text}
      initialCategory={manifestation.category}
      initialCadence={manifestation.cadence}
      initialAutoDetect={manifestation.auto_detect}
    />
  );
}
