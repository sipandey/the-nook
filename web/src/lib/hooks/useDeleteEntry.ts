"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
