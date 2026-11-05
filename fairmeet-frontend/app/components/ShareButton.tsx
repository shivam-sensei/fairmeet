"use client";

interface ShareButtonProps {
  text: string;
  fairPoint: { lat: number; lng: number } | null;
  venueName?: string;
}

export function shareToWhatsApp(
  text: string,
  fairPoint: { lat: number; lng: number } | null,
  venueName?: string,
) {
  const destination = fairPoint
    ? `\nDirections: https://www.google.com/maps/dir/?api=1&destination=${fairPoint.lat},${fairPoint.lng}`
    : "";
  const venue = venueName ? `\nLet's meet at: ${venueName}` : "";
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}${venue}${destination}`)}`,
    "_blank",
  );
}

export default function ShareButton({ text, fairPoint, venueName }: ShareButtonProps) {
  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => shareToWhatsApp(text, fairPoint, venueName)} className="flex-1 rounded-lg bg-emerald-600 px-2 py-2 text-center text-xs font-bold text-white hover:bg-emerald-700">Share to WhatsApp</button>
      <button type="button" onClick={() => void copyLink()} className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 hover:border-blue-500">Copy Link</button>
    </div>
  );
}
