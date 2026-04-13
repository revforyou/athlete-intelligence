"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  consecutiveTrainingDays: number;
  riskScore?: number;
}

const RATINGS = [
  { key: "too_hard", label: "Too Hard", emoji: "😓" },
  { key: "about_right", label: "About Right", emoji: "👌" },
  { key: "easy", label: "Easy", emoji: "😊" },
] as const;

export default function FeedbackWidget({ consecutiveTrainingDays, riskScore }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  if (consecutiveTrainingDays < 7) return null;
  if (submitted) {
    return (
      <div
        className="bg-white rounded-2xl p-6 text-center"
        style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
      >
        <p className="text-sm text-gray-500">Thanks for the feedback!</p>
        <p className="text-xs text-gray-400 mt-1">
          Your model is being personalized.
        </p>
      </div>
    );
  }

  const handleRate = async (rating: string) => {
    setSelected(rating);
    try {
      await api.submitFeedback(rating, riskScore);
      setSubmitted(true);
    } catch {
      setSelected(null);
    }
  };

  return (
    <div
      className="bg-white rounded-2xl p-6"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
        How was your week?
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        {consecutiveTrainingDays} consecutive training days — help us calibrate
        your scores.
      </p>
      <div className="flex gap-3">
        {RATINGS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => handleRate(key)}
            disabled={selected !== null}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            style={{
              border: "0.5px solid rgba(0,0,0,0.12)",
              backgroundColor: selected === key ? "#F0FDF4" : "#FAFAFA",
            }}
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
