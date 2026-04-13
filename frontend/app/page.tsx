"use client";

import { api } from "@/lib/api";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F5F4F1] px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-2">
          <h1
            className="text-4xl font-bold tracking-tight text-[#1a1a1a]"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Athlete Intelligence
          </h1>
          <p className="text-lg text-gray-600">
            Train smarter. Know your load. Stay injury-free.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 text-left">
          {[
            {
              icon: "⚡",
              title: "Daily Risk Score",
              desc: "AI-computed injury risk based on your training history.",
            },
            {
              icon: "🎯",
              title: "Zone Balance",
              desc: "Track Z1–Z5 distribution and polarization each week.",
            },
            {
              icon: "🧠",
              title: "Personalized Coaching",
              desc: "Plain-English recommendations from a sports-science model.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 bg-white rounded-xl p-4"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
            >
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => api.stravaAuthorize()}
          className="w-full py-4 px-6 rounded-xl font-semibold text-white text-base transition-opacity hover:opacity-90 active:scale-95 cursor-pointer"
          style={{ backgroundColor: "#FC4C02" }}
        >
          Connect with Strava
        </button>

        <p className="text-xs text-gray-400">
          We only read your activity data. We never post on your behalf.
        </p>
      </div>
    </main>
  );
}
