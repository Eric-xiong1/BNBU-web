"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { createAndroidInviteQrPayload } from "./course-invite";

type InviteQrCodeProps = {
  code: string;
  alt: string;
  onReady?: (code: string, dataUrl: string) => void;
};

export function InviteQrCode({ code, alt, onReady }: InviteQrCodeProps) {
  const [generated, setGenerated] = useState<{ key: string; source: string } | null>(null);
  const key = code;
  const source = generated?.key === key ? generated.source : null;

  useEffect(() => {
    let cancelled = false;
    const payload = createAndroidInviteQrPayload(code);
    void QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      width: 840,
      margin: 3,
      color: { dark: "#172032", light: "#ffffff" },
    }).then((dataUrl) => {
      if (cancelled) return;
      setGenerated({ key, source: dataUrl });
      onReady?.(code, dataUrl);
    }).catch(() => {
      if (!cancelled) setGenerated(null);
    });
    return () => { cancelled = true; };
  }, [code, key, onReady]);

  return (
    <div className="invite-qr-image" aria-busy={!source}>
      {source
        // The image is a short-lived in-memory QR data URL, not an optimizable asset.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={source} alt={alt} />
        : <span>正在生成可扫码二维码…</span>}
    </div>
  );
}
