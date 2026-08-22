"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { encryptText } from "@/lib/crypto";
import { useDecryptedMap } from "@/lib/hooks/useDecryptedMap";
import { PREVIEW_MODE, getPreviewManifestations } from "@/lib/preview";

export type Cadence = "weekly" | "monthly" | "ai_decides";

export interface ManifestationRow {
  id: string;
  created_at: string;
  category: string | null;
  cadence: Cadence;
  auto_detect: boolean;
  status: "active" | "archived";
  encrypted_text: string;
  iv: string;
  manifestation_signals: { count: number }[];
}

export function useManifestations() {
  return useQuery({
    queryKey: ["manifestations"],
    queryFn: async (): Promise<ManifestationRow[]> => {
      if (PREVIEW_MODE) return getPreviewManifestations();
      const res = await fetch("/api/manifestations");
      if (!res.ok) throw new Error("Failed to load manifestations");
      return res.json();
    },
  });
}

export function useDecryptedManifestations(
  manifestations: ManifestationRow[] | undefined,
  dek: CryptoKey | null,
) {
  const items = useMemo(
    () => manifestations?.map((m) => ({ id: m.id, ciphertext: m.encrypted_text, iv: m.iv })),
    [manifestations],
  );
  return useDecryptedMap(items, dek);
}

export interface SaveManifestationInput {
  id?: string;
  plaintext: string;
  category: string | null;
  cadence: Cadence;
  autoDetect: boolean;
  dek: CryptoKey;
}

export function useSaveManifestation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, plaintext, category, cadence, autoDetect, dek }: SaveManifestationInput) => {
      const { ciphertext, iv } = await encryptText(plaintext, dek);
      const body = JSON.stringify({ encryptedText: ciphertext, iv, category, cadence, autoDetect });

      const res = await fetch(id ? `/api/manifestations/${id}` : "/api/manifestations", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error("Failed to save manifestation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manifestations"] });
    },
  });
}

export function useDeleteManifestation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/manifestations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete manifestation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manifestations"] });
    },
  });
}
