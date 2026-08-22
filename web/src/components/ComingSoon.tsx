import { BottomTabBar } from "@/components/BottomTabBar";

/** Placeholder for screens not built yet — keeps nav functional end-to-end
 *  instead of 404ing while the rest of the design canvas gets implemented. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-xs text-sm text-muted">
          Not built yet — see docs/ARCHITECTURE.md §9 for the full screen
          inventory and design/mobile-flow/ for the mockup.
        </p>
      </main>
      <BottomTabBar />
    </div>
  );
}
