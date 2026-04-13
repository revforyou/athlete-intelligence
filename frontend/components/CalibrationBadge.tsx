"use client";

interface Props {
  nObservations: number;
  message: string;
  confidence: "low" | "medium" | "high";
}

const COLOR_MAP = {
  low: { bg: "#F3F4F6", text: "#6B7280" },
  medium: { bg: "#DBEAFE", text: "#1D4ED8" },
  high: { bg: "#CCFBF1", text: "#0F766E" },
};

export default function CalibrationBadge({ nObservations, message, confidence }: Props) {
  const { bg, text } = COLOR_MAP[confidence];
  const progress = Math.min(nObservations / 8, 1);

  return (
    <div
      className="inline-flex flex-col gap-1 px-3 py-2 rounded-full text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      <span>{message}</span>
      {nObservations < 8 && (
        <div className="w-full bg-white/50 rounded-full h-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress * 100}%`, backgroundColor: text }}
          />
        </div>
      )}
    </div>
  );
}
