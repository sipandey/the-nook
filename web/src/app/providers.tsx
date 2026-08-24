"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SerwistProvider } from "@serwist/turbopack/react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    // Registers site-wide, not just the authenticated (app) group — see
    // docs/ROADMAP.md NK-07 and src/proxy.ts's note on why /serwist and
    // /~offline have to stay public routes.
    <SerwistProvider swUrl="/serwist/sw.js">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SerwistProvider>
  );
}
