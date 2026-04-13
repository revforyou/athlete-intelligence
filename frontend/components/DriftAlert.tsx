"use client";

interface Props {
  psiScore: number;
  featureName?: string;
}

export default function DriftAlert({ psiScore, featureName }: Props) {
  if (psiScore <= 0.2) return null;

  return (
    <div
      className="w-full rounded-xl px-5 py-4 flex items-start gap-3"
      style={{ backgroundColor: "#FEF3C7", border: "0.5px solid #F59E0B" }}
    >
      <span className="text-xl">⚠️</span>
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Training Pattern Drift Detected
        </p>
        <p className="text-xs text-amber-800 mt-0.5">
          Your {featureName ?? "training load"} distribution has shifted
          significantly from your baseline (PSI {psiScore.toFixed(2)}). Consider
          reviewing your recent training block.
        </p>
      </div>
    </div>
  );
}
