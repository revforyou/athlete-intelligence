"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  Activity,
  Zap,
  Flag,
  Heart,
  MessageCircle,
  LogOut,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const NAV = [
  { label: "Overview",   href: "/dashboard",         icon: LayoutDashboard },
  { label: "Load",       href: "/dashboard/load",    icon: BarChart2 },
  { label: "Running",    href: "/dashboard/running", icon: Activity },
  { label: "VO2max",     href: "/dashboard/vo2max",  icon: Zap },
  { label: "Races",      href: "/dashboard/race",    icon: Flag },
  { label: "Heart Rate", href: "/dashboard/hr",      icon: Heart },
  { label: "Coach",      href: "/dashboard/coach",   icon: MessageCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F5F4F1] flex">
      {/* Sidebar */}
      <aside
        className="w-52 shrink-0 bg-white flex flex-col sticky top-0 h-screen"
        style={{ borderRight: "0.5px solid rgba(0,0,0,0.08)" }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Athlete<span className="text-[#378ADD]">IQ</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#F0F6FF] text-[#378ADD]"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <button
            onClick={() => { window.location.href = `${API_BASE}/auth/strava/logout`; }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors w-full cursor-pointer"
          >
            <LogOut size={13} />
            Sign out
          </button>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Powered by Strava + Groq
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
