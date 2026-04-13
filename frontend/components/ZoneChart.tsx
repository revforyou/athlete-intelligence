"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ZoneWeek } from "@/lib/api";

interface Props {
  data: ZoneWeek[];
}

const ZONE_COLORS = {
  z1_mins: "#93C5FD",
  z2_mins: "#6EE7B7",
  z3_mins: "#FDE68A",
  z4_mins: "#FCA5A5",
  z5_mins: "#E8593C",
};

function formatWeek(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Reference line: total mins * 0.20 threshold for hard training
// We draw it as a percent annotation on polarization
export default function ZoneChart({ data }: Props) {
  const chartData = data.map((w) => {
    const total = w.z1_mins + w.z2_mins + w.z3_mins + w.z4_mins + w.z5_mins;
    return {
      week: formatWeek(w.week_start),
      Z1: Math.round(w.z1_mins),
      Z2: Math.round(w.z2_mins),
      Z3: Math.round(w.z3_mins),
      Z4: Math.round(w.z4_mins),
      Z5: Math.round(w.z5_mins),
      total: Math.round(total),
      polarization: Math.round(w.polarization_score),
    };
  });

  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);
  const threshold20pct = maxTotal * 0.2;

  return (
    <div className="bg-white rounded-2xl p-6"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Weekly Zone Distribution
        </h2>
        <span className="text-xs text-gray-400">minutes</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(val, name) => [`${val} min`, name as string]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={threshold20pct}
            stroke="#E8593C"
            strokeDasharray="4 2"
            label={{ value: "20% hard", position: "right", fontSize: 10, fill: "#E8593C" }}
          />
          {(["Z1", "Z2", "Z3", "Z4", "Z5"] as const).map((z, i) => (
            <Bar
              key={z}
              dataKey={z}
              stackId="zones"
              fill={Object.values(ZONE_COLORS)[i]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
