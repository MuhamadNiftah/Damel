"use client";

import type { CustomerQuality } from "@/lib/types";
import { ProgressBar } from "@/components/ui";
import { clsx } from "@/lib/ui";

export function QualityBadge({
  quality,
  showScore = true,
}: {
  quality: CustomerQuality;
  showScore?: boolean;
}) {
  return (
    <span
      className="badge border"
      style={{
        color: quality.color,
        borderColor: `${quality.color}33`,
        background: `${quality.color}12`,
      }}
      title={`${quality.label} (${quality.grade})`}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[0.55rem] font-extrabold text-white"
        style={{ background: quality.color }}
      >
        {quality.grade}
      </span>
      {showScore ? `${quality.score}` : quality.label}
    </span>
  );
}

export function QualityRing({
  quality,
  size = 104,
}: {
  quality: CustomerQuality;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (quality.score / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={quality.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.7rem] font-extrabold leading-none text-ink-900">
          {quality.score}
        </span>
        <span className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-400">
          Grade {quality.grade}
        </span>
      </div>
    </div>
  );
}

export function QualityPanel({
  quality,
  compact = false,
}: {
  quality: CustomerQuality;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <QualityRing quality={quality} size={compact ? 88 : 104} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-slate-400">
            Penilaian kualitas nasabah
          </p>
          <p className="mt-1 text-[1rem] font-extrabold text-ink-900">
            {quality.label}
            <span
              className="ml-2 rounded-md px-1.5 py-0.5 text-[0.62rem] font-extrabold text-white"
              style={{ background: quality.color }}
            >
              {quality.grade}
            </span>
          </p>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">
            Skor {quality.score}/100 dari kelengkapan identitas, profil, keuangan,
            aktivitas transaksi, dan kepatuhan.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {quality.components.map((component) => (
          <div key={component.key}>
            <div className="flex items-center justify-between gap-3 text-[0.7rem]">
              <span className="font-semibold text-ink-800">{component.label}</span>
              <span className="mono text-slate-500">
                {component.score}/{component.max}
              </span>
            </div>
            <div className="mt-1">
              <ProgressBar
                value={(component.score / component.max) * 100}
                color={quality.color}
              />
            </div>
            {!compact ? (
              <p className="mt-1 text-[0.64rem] leading-relaxed text-slate-400">
                {component.detail}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-emerald-700">
              Kekuatan data
            </p>
            <ul className="mt-1.5 space-y-1">
              {quality.strengths.map((item) => (
                <li key={item} className="text-[0.69rem] leading-relaxed text-emerald-900">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-amber-700">
              Gap / tindak lanjut
            </p>
            <ul className="mt-1.5 space-y-1">
              {quality.gaps.map((item) => (
                <li key={item} className="text-[0.69rem] leading-relaxed text-amber-900">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GradePill({
  grade,
  active,
  onClick,
}: {
  grade: CustomerQuality["grade"];
  active: boolean;
  onClick: () => void;
}) {
  const colors: Record<CustomerQuality["grade"], string> = {
    A: "#0f9f6e",
    B: "#1d5f9f",
    C: "#d69e0f",
    D: "#d92d20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.68rem] font-bold transition",
        active
          ? "border-ink-900 bg-ink-900 text-white"
          : "border-line bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-extrabold text-white"
        style={{ background: colors[grade] }}
      >
        {grade}
      </span>
      Grade {grade}
    </button>
  );
}
