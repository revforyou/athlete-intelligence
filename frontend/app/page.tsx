"use client";

import { api } from "@/lib/api";

// Mock data for the preview
const MOCK_ACTIVITIES = [
  { type: "Run", distance: "16.0 km", duration: "1h 28m", hr: "172 bpm", tss: 133, color: "#EF9F27" },
  { type: "Weight Training", distance: "—", duration: "43m", hr: "101 bpm", tss: 43, color: "#378ADD" },
  { type: "Run", distance: "7.8 km", duration: "44m", hr: "177 bpm", tss: 69, color: "#1D9E75" },
];

const MOCK_METRICS = [
  { label: "ACWR", value: "0.85", status: "good", desc: "Acute:Chronic ratio — safe zone" },
  { label: "CTL", value: "42", status: "good", desc: "Fitness — 42-day training base" },
  { label: "TSB", value: "+8", status: "good", desc: "Form — well rested" },
];

function MockRiskDial() {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 140" className="w-40 h-28">
        <path d="M 30.0 121.2 A 70 70 0 1 1 170.0 121.2" fill="none" stroke="#E5E7EB" strokeWidth={14} strokeLinecap="round" />
        <path d="M 30.0 121.2 A 70 70 0 0 1 99.9 30.0" fill="none" stroke="#1D9E75" strokeWidth={14} strokeLinecap="round" />
        <text x="100" y="108" textAnchor="middle" fontSize={38} fontWeight="700" fill="#1D9E75" fontFamily="monospace">11</text>
        <text x="100" y="126" textAnchor="middle" fontSize={11} fill="#6B7280">Low Risk</text>
      </svg>
    </div>
  );
}

function MockMetricCard({ label, value, status, desc }: { label: string; value: string; status: string; desc: string }) {
  const color = status === "good" ? "#1D9E75" : status === "warn" ? "#EF9F27" : "#E8593C";
  return (
    <div className="bg-white/80 rounded-xl p-3 flex items-center gap-3" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: color }}>
        {label.slice(0, 3)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color, fontFamily: "monospace" }}>{value}</span>
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F5F4F1]">
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left — copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-xs font-medium text-gray-500"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Powered by your Strava data
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              Train smarter.<br />
              <span style={{ color: "#1D9E75" }}>Stay injury-free.</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed">
              Athlete Intelligence reads your Strava activities and gives you a daily injury risk score, training load breakdown, and a plain-English coaching recommendation — built on sports science.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => api.stravaAuthorize()}
                className="flex items-center justify-center gap-3 py-4 px-8 rounded-xl font-semibold text-white text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{ backgroundColor: "#FC4C02" }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connect with Strava
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Read-only access. We never post or modify your Strava data.
            </p>
          </div>

          {/* Right — mock dashboard preview */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              {/* Mock header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Athlete Intelligence</span>
                <div className="flex gap-2">
                  {["All", "Run", "Weight"].map(t => (
                    <span key={t} className={`text-xs px-2.5 py-1 rounded-full font-medium ${t === "All" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Recommendation */}
                <div className="bg-green-50 rounded-xl px-4 py-3 flex gap-3 items-start">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Today&apos;s Recommendation</p>
                    <p className="text-xs text-gray-700">Your training load is well balanced. Low risk today — go ahead and train at moderate intensity.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Risk dial */}
                  <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center"
                    style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Risk Score</p>
                    <MockRiskDial />
                  </div>

                  {/* Stats */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">This Week</p>
                    {[
                      { label: "Distance", value: "24.0 km", icon: "🏃" },
                      { label: "Sessions", value: "5", icon: "📅" },
                      { label: "Avg HR", value: "154 bpm", icon: "❤️" },
                      { label: "Total TSS", value: "312", icon: "⚡" },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5"
                        style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}>
                        <span className="text-xs text-gray-500">{s.icon} {s.label}</span>
                        <span className="text-xs font-bold text-gray-800" style={{ fontFamily: "monospace" }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metric cards */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Training Metrics</p>
                  {MOCK_METRICS.map(m => <MockMetricCard key={m.label} {...m} />)}
                </div>

                {/* Activity feed */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent Activities</p>
                  <div className="space-y-1.5">
                    {MOCK_ACTIVITIES.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-xs font-medium text-gray-800">{a.type}</span>
                          <span className="text-xs text-gray-400 ml-2">{a.distance} · {a.duration} · {a.hr}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: a.color, fontFamily: "monospace" }}>{a.tss} TSS</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-2 shadow-lg"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <p className="text-xs text-gray-400">Personalized after</p>
              <p className="text-sm font-bold text-gray-800">8 sessions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features row */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">What you get</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "⚡",
              title: "Daily Risk Score",
              desc: "Computed from your ACWR, monotony, strain, and zone balance. Updates every time you sync a new activity.",
            },
            {
              icon: "🎯",
              title: "Sport-by-Sport Breakdown",
              desc: "Separate stats for each sport you do — run distance, weight training volume, pace trends, HR zones.",
            },
            {
              icon: "🧠",
              title: "AI Coaching Recommendation",
              desc: "A 2-3 sentence plain-English recommendation each day: Train, Easy Day, or Rest — backed by your actual data.",
            },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 space-y-3"
              style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-lg mx-auto px-4 pb-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Ready to train smarter?</h2>
        <button
          onClick={() => api.stravaAuthorize()}
          className="w-full py-4 px-6 rounded-xl font-semibold text-white text-base transition-all hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: "#FC4C02" }}
        >
          Connect with Strava — it&apos;s free
        </button>
        <p className="text-xs text-gray-400">No account needed. Just your Strava.</p>
      </div>
    </main>
  );
}
