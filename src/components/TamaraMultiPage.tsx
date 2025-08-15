"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";

// טוענים את plotly בצד לקוח בלבד
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as React.FC<any>;

/** צבעים קבועים לפי הסקיצה */
const DARK = "#2C5F7C";
const LIGHT = "#A8C5D6";
const RED = "#d74a4a";

/** נווט עליון */
type PageKey = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";

/** Dropdown קומפוננט עם חיפוש וגלילה */
function ComboBox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  widthClass = "w-56",
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [q, options]);

  return (
    <div className={`relative ${widthClass}`}>
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-white"
        style={{ background: DARK }}
        onClick={() => setOpen((s) => !s)}
      >
        {value || <span className="opacity-70">{placeholder}</span>}
      </button>
      <span className="ml-2 text-[13px]" style={{ color: RED }}>
        droplist
      </span>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border bg-white shadow-md">
          <div className="p-2 border-b">
            <input
              autoFocus
              placeholder="Search…"
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt}
                className="block w-full text-left px-3 py-2 hover:bg-neutral-100 text-sm"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-neutral-500">No options</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** כפתור ניווט עם סטיילים לפי Active/Inactive */
function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-md text-sm md:text-base font-semibold transition"
      style={{
        background: active ? DARK : LIGHT,
        color: active ? "#fff" : "#000",
        borderBottom: active ? "none" : `3px solid ${RED}`,
      }}
    >
      {label}
    </button>
  );
}

/** בלוק כותרת אזור גרפים */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-3xl font-bold text-center my-4">{children}</h2>
  );
}

/** שורה של שלושה "Volcano" — נתמכים בשני מצבים: אמיתי (scatter) או "מלבן כחול" */
function VolcanoRow({
  mode, // "trfs" => scatter תלת-צבעי; אחרת => מלבנים כחולים
}: {
  mode: "trfs" | "blank";
}) {
  // נתונים סינתטיים לגרף tRFs: חיובי/שלילי/ניטרלי
  const trfsData = useMemo(() => {
    const make = (n: number, yShift = 0) =>
      Array.from({ length: n }, () => ({
        x: (Math.random() - 0.5) * 4,
        y: Math.abs(Math.random() * 4) + yShift,
      }));
    return {
      up: make(70, 2.8),
      down: make(70, 0.1).map((p) => ({ x: p.x, y: p.y * 0.6 })),
      ns: make(120, 0.9),
    };
  }, []);

  const card = (label: string, idx: number) => (
    <div
      key={label}
      className="rounded-xl border-4 overflow-hidden"
      style={{ borderColor: DARK }}
    >
      {mode === "trfs" && idx === 0 ? (
        <Plot
          data={
            [
              {
                x: trfsData.up.map((p) => p.x),
                y: trfsData.up.map((p) => p.y),
                type: "scatter",
                mode: "markers",
                name: "up",
                marker: { color: "red", size: 6, opacity: 0.9 },
              },
              {
                x: trfsData.down.map((p) => p.x),
                y: trfsData.down.map((p) => p.y),
                type: "scatter",
                mode: "markers",
                name: "down",
                marker: { color: "green", size: 6, opacity: 0.9 },
              },
              {
                x: trfsData.ns.map((p) => p.x),
                y: trfsData.ns.map((p) => p.y),
                type: "scatter",
                mode: "markers",
                name: "NS",
                marker: { color: "black", size: 5, opacity: 0.7 },
              },
            ] as any
          }
          layout={
            {
              margin: { l: 40, r: 10, t: 10, b: 40 },
              xaxis: { title: "log2FC", zeroline: true },
              yaxis: { title: "-log10(p)" },
              height: 260,
              showlegend: false,
            } as any
          }
          config={{ displayModeBar: false }}
        />
      ) : mode === "trfs" ? (
        // ל-30/60 דקה – מעט נקודות (בעיקר ירוק/שחור דליל)
        <Plot
          data={
            [
              {
                x: Array.from({ length: 20 }, () => (Math.random() - 0.5) * 4),
                y: Array.from({ length: 20 }, () => Math.random() * 1.2 + 0.2),
                type: "scatter",
                mode: "markers",
                marker: { color: "green", size: 6, opacity: 0.9 },
              },
              {
                x: Array.from({ length: 30 }, () => (Math.random() - 0.5) * 4),
                y: Array.from({ length: 30 }, () => Math.random() * 1.2 + 0.4),
                type: "scatter",
                mode: "markers",
                marker: { color: "black", size: 5, opacity: 0.7 },
              },
            ] as any
          }
          layout={
            {
              margin: { l: 40, r: 10, t: 10, b: 40 },
              xaxis: { title: "log2FC", zeroline: true },
              yaxis: { title: "-log10(p)" },
              height: 260,
              showlegend: false,
            } as any
          }
          config={{ displayModeBar: false }}
        />
      ) : (
        <div
          className="h-[260px] w-full"
          style={{ background: DARK }}
          aria-label="static dark rectangle"
        />
      )}
      <div className="py-2 text-center font-semibold">{label}</div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["15 min", "30 min", "60 min"].map((lbl, i) => card(lbl, i))}
      </div>
      <p className="text-sm text-center text-neutral-600 mt-2">
        x-axis: <span className="font-mono">log2(Fold Change)</span>, y-axis:{" "}
        <span className="font-mono">-log10(p-value)</span>
      </p>
    </>
  );
}

/** Boxplot לפי הסגנון: רקע כחול כהה, תיבות לבנות וקו מגמה לבן */
function BlueBoxplot({
  titleLeft = "",
}: {
  titleLeft?: string;
}) {
  const time = ["0 min", "15 min", "30 min", "60 min"];
  // שלושה/ארבעה וקטורים דמויים
  const series = [
    Array.from({ length: 10 }, () => 4 + Math.random() * 3),
    Array.from({ length: 10 }, () => 6 + Math.random() * 2),
    Array.from({ length: 10 }, () => 7 + Math.random() * 2),
    Array.from({ length: 10 }, () => 5 + Math.random() * 2),
  ];
  const medians = series.map((arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  });

  return (
    <div className="mt-8">
      <h3 className="text-2xl font-bold text-center mb-3">Boxplot</h3>
      <div className="flex items-center gap-3 mb-3 justify-center">
        <div className="font-semibold">{titleLeft}</div>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ borderColor: DARK }}>
        <Plot
          data={
            [
              { type: "box", y: series[0], name: time[0], marker: { color: "#fff" }, fillcolor: "#fff", line: { color: "#fff", width: 2 } },
              { type: "box", y: series[1], name: time[1], marker: { color: "#fff" }, fillcolor: "#fff", line: { color: "#fff", width: 2 } },
              { type: "box", y: series[2], name: time[2], marker: { color: "#fff" }, fillcolor: "#fff", line: { color: "#fff", width: 2 } },
              { type: "box", y: series[3], name: time[3], marker: { color: "#fff" }, fillcolor: "#fff", line: { color: "#fff", width: 2 } },
              { type: "scatter", mode: "lines+markers", x: time, y: medians, line: { color: "#fff", width: 3 }, marker: { color: "#fff", size: 8 }, hoverinfo: "skip", name: "median" },
            ] as any
          }
          layout={
            {
              paper_bgcolor: DARK,
              plot_bgcolor: DARK,
              font: { color: "#fff" },
              margin: { l: 60, r: 20, t: 30, b: 60 },
              xaxis: { title: "timepoint", tickfont: { color: "#fff" }, titlefont: { color: "#fff" } },
              yaxis: { title: "DESeq2 normalized count", tickfont: { color: "#fff" }, titlefont: { color: "#fff" } },
              showlegend: false,
              height: 360,
            } as any
          }
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      <p className="text-sm text-center text-neutral-600 mt-2">
        x-axis: <span className="font-mono">timepoint</span>, y-axis:{" "}
        <span className="font-mono">DESeq2 normalized count</span>
      </p>
    </div>
  );
}

/** תוכן אזור הבקרה (משמאל “Color by”, dropdownים וכו') */
function ControlBlock({
  entityLabel,
  dropdownOptions,
  dropdownValue,
  onDropdownChange,
  withTRFFilter = false,
}: {
  entityLabel: string;
  dropdownOptions: string[];
  dropdownValue: string | null;
  onDropdownChange: (v: string) => void;
  withTRFFilter?: boolean;
}) {
  // מצבי הסינון ל-tRFs
  const [families, setFamilies] = useState({
    "5'-half": false,
    "5'-tRFs": false,
    "i-tRFs": false,
    "3'-tRFs": true,
    "3'-half": false,
  });
  const [genome, setGenome] = useState({ nuclear: true, mitochondrial: false });
  const [aa, setAA] = useState("Ala");

  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="font-semibold">Color by:</div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-black" />
          <div className="font-semibold">significance</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm border" />
          <div className="font-semibold">{entityLabel} name:</div>
        </div>
        <ComboBox
          value={dropdownValue}
          onChange={onDropdownChange}
          options={dropdownOptions}
          placeholder={`Choose ${entityLabel}`}
        />
      </div>

      {withTRFFilter && (
        <div className="rounded-xl border p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-semibold">tRF family:</div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {Object.keys(families).map((k) => (
                  <label key={k} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(families as any)[k]}
                      onChange={(e) =>
                        setFamilies((s) => ({ ...s, [k]: e.target.checked }))
                      }
                    />
                    <span className="select-none">{k}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Genome:</div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {Object.keys(genome).map((k) => (
                  <label key={k} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(genome as any)[k]}
                      onChange={(e) =>
                        setGenome((s) => ({ ...s, [k]: e.target.checked }))
                      }
                    />
                    <span className="select-none">{k}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <div className="font-semibold mb-2">Amino acid:</div>
                <div className="flex items-center gap-2">
                  <ComboBox
                    value={aa}
                    onChange={setAA}
                    options={[
                      "Ala",
                      "Arg",
                      "Asn",
                      "Asp",
                      "Cys",
                      "Gln",
                      "Glu",
                      "Gly",
                      "His",
                      "Ile",
                      "Leu",
                      "Lys",
                      "Met",
                      "Phe",
                      "Pro",
                      "Ser",
                      "Thr",
                      "Trp",
                      "Tyr",
                      "Val",
                    ]}
                    widthClass="w-40"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** עמוד מלא יחיד (משמש לכל ארבעת הסוגים) */
function OnePage({
  page,
  dropdownOptions,
}: {
  page: PageKey;
  dropdownOptions: string[];
}) {
  const [selected, setSelected] = useState<string | null>(dropdownOptions[0] ?? null);
  const isTRFs = page === "tRFs";

  return (
    <div className="w-full">
      <SectionTitle>Volcano plots</SectionTitle>
      <VolcanoRow mode={isTRFs ? "trfs" : "blank"} />

      <ControlBlock
        entityLabel={page}
        dropdownOptions={dropdownOptions}
        dropdownValue={selected}
        onDropdownChange={setSelected}
        withTRFFilter={isTRFs}
      />

      <BlueBoxplot titleLeft={`${page} name:`} />
    </div>
  );
}

/** הרכיב הראשי שמחליף “דפים” */
export default function TamaraMultiPage() {
  const [page, setPage] = useState<PageKey>("tRFs");

  return (
    <div className="min-h-screen w-full bg-white text-black">
      {/* ניווט עליון */}
      <div className="w-full px-3 py-4 flex gap-2 sticky top-0 z-10 bg-white border-b">
        {(["tRFs", "miRs", "lncRNAs", "mRNAs"] as PageKey[]).map((key) => (
          <NavButton
            key={key}
            label={key}
            active={page === key}
            onClick={() => setPage(key)}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {page === "tRFs" && (
          <OnePage
            page="tRFs"
            dropdownOptions={[
              "tRF-1001",
              "tRF-1002",
              "tRF-1003",
              "tRF-2001",
              "tRF-2002",
              "tRF-3001",
            ]}
          />
        )}
        {page === "miRs" && (
          <OnePage
            page="miRs"
            dropdownOptions={["miR-21", "miR-155", "miR-146a", "miR-451a", "miR-9"]}
          />
        )}
        {page === "lncRNAs" && (
          <OnePage
            page="lncRNAs"
            dropdownOptions={["HOTAIR", "MALAT1", "H19", "NEAT1", "XIST"]}
          />
        )}
        {page === "mRNAs" && (
          <OnePage
            page="mRNAs"
            dropdownOptions={["GAPDH", "ACTB", "TP53", "EGFR", "MYC"]}
          />
        )}
      </div>
    </div>
  );
}
