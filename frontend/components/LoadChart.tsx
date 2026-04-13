"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
  ResponsiveContainer,
} from "recharts";
import type { DailyFeature } from "@/lib/api";

interface Props {
  data: DailyFeature[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function LoadChart({ data }: Props) {
  // Show last 6 weeks (~42 days)
  const sliced = data.slice(-42);
  const chartData = sliced.map((f) => ({
    date: formatDate(f.date),
    ATL: Math.round(f.atl * 10) / 10,
    CTL: Math.round(f.ctl * 10) / 10,
    TSB: Math.round(f.tsb * 10) / 10,
  }));

  return (
    <div className="bg-white rounded-2xl p-6"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Training Load (6 weeks)
        </h2>
        <span className="text-xs text-gray-400">TSS units</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* TSB shaded area */}
          <Area
            type="monotone"
            dataKey="TSB"
            fill="#DBEAFE"
            stroke="none"
            fillOpacity={0.6}
          />
          <Line
            type="monotone"
            dataKey="ATL"
            stroke="#E8593C"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="CTL"
            stroke="#378ADD"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
