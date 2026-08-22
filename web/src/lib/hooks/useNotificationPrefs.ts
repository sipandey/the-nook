"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface NotificationPrefs {
  daily_prompt_enabled: boolean;
  daily_prompt_time: string;
  playback_ready_enabled: boolean;
  manifestation_enabled: boolean;
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["notificationPrefs"],
    queryFn: async (): Promise<NotificationPrefs> => {
      const res = await fetch("/api/notification-prefs");
      if (!res.ok) throw new Error("Failed to load notification preferences");
      return res.json();
    },
  });
}

export function useSaveNotificationPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      const res = await fetch("/api/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save notification preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPrefs"] });
    },
  });
}
