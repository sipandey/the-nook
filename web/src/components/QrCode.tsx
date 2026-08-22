"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#33362f", light: "#f6f4ee" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-lg bg-border"
        aria-label="Generating code…"
      />
    );
  }

  // A data: URL, not a remote image — next/image adds no value here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="Scan with an already-unlocked device to sync" width={size} height={size} className="rounded-lg" />;
}
