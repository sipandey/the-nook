export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
        The Nook
      </h1>
      <p className="max-w-xs text-sm" style={{ color: "var(--color-text-muted)" }}>
        Scaffold in progress. Screens are being built from the design canvas
        in <code>design/mobile-flow/</code> and the reference in{" "}
        <code>docs/ARCHITECTURE.md</code>.
      </p>
    </main>
  );
}
