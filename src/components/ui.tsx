"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { clsx, SEVERITY_META, CASE_STATUS_META } from "@/lib/ui";

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  tone?: "default" | "dark";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const width = useMemo(
    () =>
      ({
        sm: "max-w-lg",
        md: "max-w-2xl",
        lg: "max-w-4xl",
        xl: "max-w-6xl",
        full: "max-w-[min(96vw,1500px)]",
      })[size],
    [size],
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div className="modal-backdrop overflow-y-auto p-3 sm:p-6" onClick={onClose}>
      <div
        className={clsx(
          "modal-panel mx-auto my-2 w-full overflow-hidden rounded-2xl border shadow-2xl sm:my-6",
          width,
          tone === "dark"
            ? "border-ink-700 bg-ink-900 text-white"
            : "border-line bg-white",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={clsx(
            "sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-4 py-3.5 sm:px-5",
            tone === "dark"
              ? "border-ink-700 bg-ink-900/95 backdrop-blur"
              : "border-line bg-white/95 backdrop-blur",
          )}
        >
          <div className="min-w-0">
            <h2
              className={clsx(
                "text-[0.98rem] font-bold",
                tone === "dark" ? "text-white" : "text-ink-900",
              )}
            >
              {title}
            </h2>
            {description ? (
              <p
                className={clsx(
                  "mt-0.5 text-[0.72rem] leading-relaxed",
                  tone === "dark" ? "text-slate-300" : "text-slate-500",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              "icon-btn shrink-0",
              tone === "dark" && "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
            aria-label="Tutup"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto scroll-area px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div
            className={clsx(
              "sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-5",
              tone === "dark"
                ? "border-ink-700 bg-ink-900/95 backdrop-blur"
                : "border-line bg-slate-50/90 backdrop-blur",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={clsx(
          "drawer-panel absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-white shadow-2xl",
          width,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[0.98rem] font-bold text-ink-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[0.72rem] text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Tutup">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-area px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Page header ------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 hidden h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 sm:flex">
            {icon}
          </span>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Metrics -------------------------------- */

export function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  delay,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: "brand" | "clean" | "medium" | "critical" | "ink" | "violet";
  delay?: string;
}) {
  const tones: Record<string, { color: string; bg: string }> = {
    brand: { color: "#137367", bg: "#eef9f6" },
    clean: { color: "#0f9f6e", bg: "#ecfdf5" },
    medium: { color: "#d69e0f", bg: "#fff9e6" },
    critical: { color: "#d92d20", bg: "#fff1f0" },
    ink: { color: "#0b263a", bg: "#f1f5f9" },
    violet: { color: "#6d3cb5", bg: "#f7f2ff" },
  };
  const selected = tones[tone];
  return (
    <div
      className={clsx("card card-hover kpi-card animate-fade-up p-4", delay)}
      style={{ color: selected.color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 text-[1.62rem] font-extrabold leading-none tracking-tight text-ink-900">
            {value}
          </p>
          {sub ? (
            <div className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
              {sub}
            </div>
          ) : null}
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: selected.bg, color: selected.color }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- Badges --------------------------------- */

export function RiskBadge({
  severity,
  whitelisted,
  exact,
}: {
  severity: string;
  whitelisted?: boolean;
  exact?: boolean;
}) {
  if (whitelisted) {
    return (
      <span className="badge badge-neutral">
        <span className="badge-dot" /> Whitelisted
      </span>
    );
  }
  const meta =
    SEVERITY_META[severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.LOW;
  return (
    <span className={clsx("badge", meta.className)}>
      <span className="badge-dot" />
      {exact ? "Critical" : meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta =
    CASE_STATUS_META[status as keyof typeof CASE_STATUS_META] ?? {
      label: "Belum Ditangani",
      className: "badge-neutral",
    };
  return <span className={clsx("badge", meta.className)}>{meta.label}</span>;
}

/* ------------------------------- Score ring ------------------------------- */

export function ScoreRing({
  value,
  size = 68,
  stroke = 7,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const color =
    value >= 95
      ? "#d92d20"
      : value >= 85
        ? "#e66716"
        : value >= 70
          ? "#d69e0f"
          : "#0f9f6e";
  return (
    <div
      className="score-ring relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
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
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-extrabold leading-none text-ink-900"
          style={{ fontSize: size * 0.27 }}
        >
          {Math.round(value)}
        </span>
        {label ? (
          <span className="mt-0.5 text-[0.52rem] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- Data tools ------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("search-box", className)}>
      <Search size={15} />
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Cari..."}
      />
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <p className="text-[0.72rem] text-slate-500">
        Halaman <span className="font-bold text-ink-900">{page}</span> dari{" "}
        <span className="font-bold text-ink-900">{pageCount}</span> — {total} data
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={14} /> Sebelumnya
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Berikutnya <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </span>
      <p className="mt-3 text-[0.86rem] font-bold text-ink-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[0.74rem] leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs scroll-area max-w-full overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={clsx("tab", value === tab.value && "active")}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold",
                value === tab.value
                  ? "bg-ink-900 text-white"
                  : "bg-slate-200 text-slate-600",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.07em] text-slate-400">
        {label}
      </p>
      <p
        className={clsx(
          "mt-0.5 text-[0.79rem] font-semibold leading-relaxed text-ink-900",
          mono && "mono text-[0.75rem]",
        )}
      >
        {value || "—"}
      </p>
      {hint ? <p className="mt-0.5 text-[0.65rem] text-slate-400">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------- Text diff ------------------------------- */

function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function DiffText({
  value,
  compare,
  className,
}: {
  value: string;
  compare: string;
  className?: string;
}) {
  const compareTokens = new Set(tokenize(compare).map(normalizeToken));
  const tokens = tokenize(value);
  return (
    <span className={className}>
      {tokens.map((token, index) => {
        const normalized = normalizeToken(token);
        const matched =
          normalized.length > 1 && compareTokens.has(normalized);
        const partial =
          !matched &&
          normalized.length > 3 &&
          [...compareTokens].some(
            (other) =>
              other.length > 3 &&
              (other.startsWith(normalized.slice(0, 4)) ||
                normalized.startsWith(other.slice(0, 4))),
          );
        return (
          <span key={`${token}-${index}`}>
            <span className={matched ? "diff-match" : partial ? "diff-partial" : ""}>
              {token}
            </span>
            {index < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <div
        className="progress-bar"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color
            ? `linear-gradient(90deg, ${color}, ${color}cc)`
            : undefined,
        }}
      />
    </div>
  );
}

export function Alert({
  variant = "info",
  title,
  children,
  icon,
}: {
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={clsx("alert", `alert-${variant}`)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div>
        {title ? <p className="font-bold">{title}</p> : null}
        <div className={clsx(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
