"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { SensorOption } from "@/lib/api-types";

type SensorPickerProps = {
  /** Visible label. */
  label: string;
  /** Input name — free text is submitted as-is (manual-entry fallback). */
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

const MAX_RESULTS = 50;

/**
 * Searchable HA sensor dropdown with a manual-input fallback. Loads
 * power/energy sensors from /api/admin/ha-sensors (admin-only), filters on
 * friendly name and entity_id, and lets the admin type an entity_id by hand
 * when the sensor list is unavailable or the entity is new.
 */
export function SensorPicker({
  label,
  name,
  value,
  onChange,
  required,
}: SensorPickerProps) {
  const [sensors, setSensors] = useState<SensorOption[] | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ha-sensors")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSensors(Array.isArray(data.sensors) ? data.sensors : []);
        setDegraded(Boolean(data.degraded));
      })
      .catch(() => {
        if (!cancelled) setSensors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    if (!sensors) return [];
    const query = value.trim().toLowerCase();
    const filtered = sensors.filter(
      (sensor) =>
        !query ||
        sensor.entityId.toLowerCase().includes(query) ||
        (sensor.friendlyName ?? "").toLowerCase().includes(query),
    );
    return filtered.slice(0, MAX_RESULTS);
  }, [sensors, value]);

  const exactMatch = useMemo(
    () => sensors?.some((sensor) => sensor.entityId === value.trim()) ?? false,
    [sensors, value],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function select(entityId: string) {
    onChange(entityId);
    setOpen(false);
  }

  let hint: string;
  if (sensors === null) {
    hint = "Loading sensors from Home Assistant…";
  } else if (degraded) {
    hint = "Home Assistant unreachable — type an entity_id manually.";
  } else if (!exactMatch && value.trim()) {
    hint = "Manual entry — no exact match in the Home Assistant sensor list.";
  } else {
    hint = `${sensors.length} power/energy sensor${sensors.length === 1 ? "" : "s"} available`;
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={name} className="block text-sm font-medium text-ink-secondary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        autoComplete="off"
        placeholder="Search sensor or type entity_id"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlighted((h) => Math.min(h + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (event.key === "Enter" && open && matches[highlighted]) {
            event.preventDefault();
            select(matches[highlighted].entityId);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />

      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {matches.map((sensor, index) => (
            <li key={sensor.entityId}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(sensor.entityId);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={`w-full px-3 py-2 text-left ${index === highlighted ? "bg-sky-50 dark:bg-sky-500/10" : ""}`}
              >
                <span className="block text-sm font-medium text-ink">
                  {sensor.friendlyName ?? sensor.entityId}
                </span>
                <span className="block text-xs text-ink-muted">
                  {sensor.entityId}
                  {sensor.unit ? ` · ${sensor.unit}` : ""}
                  {sensor.deviceClass ? ` · ${sensor.deviceClass}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}
