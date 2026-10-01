// Dev-only tool for choosing each object's 6 light angles (hardest → easiest).
// Saving writes to assets/catalog.json and the database through /api/dev.
import { useEffect, useState } from "react";
import { DEFAULT_ANGLES, type DevCatalogEntry, type LightAngle } from "@shadow/shared";
import { api } from "../../api/client";
import { ShadowScene } from "../../games/shadow-guess/scene/ShadowScene";

export default function AnglePicker() {
  const [catalog, setCatalog] = useState<DevCatalogEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [slots, setSlots] = useState<LightAngle[]>(DEFAULT_ANGLES);
  const [slot, setSlot] = useState(0);
  const [showObject, setShowObject] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api<DevCatalogEntry[]>("/api/dev/catalog").then(setCatalog, () => setStatus("API not reachable"));
  }, []);

  const entry = catalog[index];
  useEffect(() => {
    if (entry) setSlots(entry.angles);
    setSlot(0);
    setStatus(null);
  }, [entry]);

  if (!entry) return <p className="text-stone-400">{status ?? "Loading catalog…"}</p>;
  const angle = slots[slot];

  function setAngle(patch: Partial<LightAngle>) {
    setSlots((s) => s.map((a, i) => (i === slot ? { ...a, ...patch } : a)));
    setStatus("Unsaved changes");
  }

  async function save(angles: LightAngle[] | null) {
    await api(`/api/dev/catalog/${entry.id}/angles`, { method: "PUT", body: { angles } });
    const saved = { ...entry, angles: angles ?? DEFAULT_ANGLES, customAngles: angles !== null };
    setCatalog((c) => c.map((o) => (o.id === entry.id ? saved : o)));
    setStatus(angles ? "Saved to catalog.json" : "Reset to defaults");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Angle picker</h1>
        <select
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5"
        >
          {catalog.map((o, i) => (
            <option key={o.id} value={i}>
              {o.customAngles ? "✓ " : ""}
              {o.name} ({o.category})
            </option>
          ))}
        </select>
        <button onClick={() => setIndex((i) => (i + 1) % catalog.length)} className="text-sm underline">
          Next →
        </button>
        <label className="flex items-center gap-2 text-sm text-stone-400">
          <input type="checkbox" checked={showObject} onChange={(e) => setShowObject(e.target.checked)} />
          Show object
        </label>
      </div>

      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-800">
        <ShadowScene modelUrl={entry.modelUrl} angle={angle} revealed={showObject} snap />
      </div>

      <div className="flex flex-wrap gap-2">
        {slots.map((a, i) => (
          <button
            key={i}
            onClick={() => setSlot(i)}
            className={`rounded-lg border px-3 py-1.5 text-left text-xs ${
              i === slot ? "border-amber-400 text-stone-100" : "border-stone-700 text-stone-400"
            }`}
          >
            <div className="font-medium">
              Step {i + 1}
              {i === 0 ? " (hardest)" : i === slots.length - 1 ? " (easiest)" : ""}
            </div>
            az {a.azimuth}° · el {a.elevation}°
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-stone-400">
          <span>Azimuth {angle.azimuth}°</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={angle.azimuth}
            onChange={(e) => setAngle({ azimuth: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="space-y-1 text-sm text-stone-400">
          <span>Elevation {angle.elevation}°</span>
          <input
            type="range"
            min={-90}
            max={90}
            value={angle.elevation}
            onChange={(e) => setAngle({ elevation: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => void save(slots)} className="rounded-xl bg-amber-400 px-4 py-2 font-medium text-stone-950">
          Save angles
        </button>
        <button onClick={() => void save(null)} className="rounded-xl border border-stone-700 px-4 py-2 text-stone-300">
          Reset to defaults
        </button>
        {status && <span className="text-sm text-stone-400">{status}</span>}
      </div>
    </section>
  );
}
