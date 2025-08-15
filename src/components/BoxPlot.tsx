"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// טעינת Plotly בצד לקוח בלבד
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as React.FC<any>;

type RNAClass = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";
type TimepointKey = "Baseline" | "15" | "30" | "60";

const COUNTS_FILE: Record<RNAClass, string> = {
  tRFs: "/interactive_boxplot/tRF_countsnorm.csv",
  miRs: "/interactive_boxplot/miR_countsnorm.csv",
  lncRNAs: "/interactive_boxplot/lncRNA_countsnorm.csv",
  mRNAs: "/interactive_boxplot/mRNA_countsnorm.csv",
};
const METADATA_FILE = "/interactive_boxplot/Metadata.csv";

/** חיבור קלאסים קטן (כמו cn) */
function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/** פרסור CSV פשוט (מתאים לקבצים: כותרת + ערכים מספריים). */
function parseCSV(text: string): { header: string[]; rows: string[][] } {
  // הסרה של BOM אפשרי + \r
  const clean = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((l) => l.split(","));
  return { header, rows };
}

/** בניית מיפוי SampleID -> נקודת זמן מתוך Metadata */
function buildSampleToTimepoint(metaText: string): Record<string, TimepointKey> {
  const { header, rows } = parseCSV(metaText);
  const idxSample = header.indexOf("SampleID");
  const idxGroup = header.indexOf("Group");
  const map: Record<string, TimepointKey> = {};
  if (idxSample === -1 || idxGroup === -1) return map;

  for (const r of rows) {
    const sample = r[idxSample]?.trim();
    const group = r[idxGroup]?.trim(); // "Baseline" | "15" | "30" | "60"
    if (!sample || !group) continue;
    if (group === "Baseline" || group === "15" || group === "30" || group === "60") {
      map[sample] = group as TimepointKey;
    }
  }
  return map;
}

/** שליפת שמות RNA (עמודה ראשונה) + מבנה מלא של הטבלה */
function prepareCounts(countsText: string): { rnaNames: string[]; header: string[]; rows: string[][] } {
  const { header, rows } = parseCSV(countsText);
  return { rnaNames: rows.map((r) => r[0]), header, rows };
}

interface BoxPlotProps {
  rnaClass: RNAClass;
  title?: string;
  /** שם ברירת מחדל (אם קיים ברשימה) */
  defaultGene?: string;
}

export default function BoxPlot({ rnaClass, title = "Boxplot", defaultGene }: BoxPlotProps) {
  const [metadataMap, setMetadataMap] = useState<Record<string, TimepointKey>>({});
  const [countsHeader, setCountsHeader] = useState<string[]>([]);
  const [countsRows, setCountsRows] = useState<string[][]>([]);
  const [geneList, setGeneList] = useState<string[]>([]);
  const [query, setQuery] = useState<string>("");
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // טעינת קבצים
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError(null);

        const [metaRes, countsRes] = await Promise.all([
          fetch(METADATA_FILE, { cache: "force-cache" }),
          fetch(COUNTS_FILE[rnaClass], { cache: "force-cache" }),
        ]);
        if (!metaRes.ok) throw new Error("Failed loading Metadata.csv");
        if (!countsRes.ok) throw new Error(`Failed loading counts for ${rnaClass}`);

        const [metaText, countsText] = await Promise.all([metaRes.text(), countsRes.text()]);
        if (cancelled) return;

        const metaMap = buildSampleToTimepoint(metaText);
        const { rnaNames, header, rows } = prepareCounts(countsText);

        setMetadataMap(metaMap);
        setCountsHeader(header);
        setCountsRows(rows);
        setGeneList(rnaNames);
        const initial = defaultGene && rnaNames.includes(defaultGene) ? defaultGene : rnaNames[0] ?? null;
        setSelectedGene(initial);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [rnaClass, defaultGene]);

  // סינון לחיפוש
  const filteredGenes = useMemo(() => {
    if (!query) return geneList.slice(0, 200);
    const q = query.toLowerCase();
    return geneList.filter((g) => g.toLowerCase().includes(q)).slice(0, 200);
  }, [geneList, query]);

  // חלוקה לערכי ביטוי לפי נקודת זמן
  const byTimepoint = useMemo(() => {
    const empty = { Baseline: [], "15": [], "30": [], "60": [] } as Record<TimepointKey, number[]>;
    if (!selectedGene || countsHeader.length === 0 || countsRows.length === 0) return empty;

    const row = countsRows.find((r) => r[0] === selectedGene);
    if (!row) return empty;

    const res: Record<TimepointKey, number[]> = { Baseline: [], "15": [], "30": [], "60": [] };
    for (let i = 1; i < countsHeader.length; i++) {
      const sample = countsHeader[i];
      const tp = metadataMap[sample];
      if (!tp) continue;
      const raw = row[i];
      const v = raw === undefined || raw === "" ? NaN : Number(raw);
      if (Number.isFinite(v)) res[tp].push(v);
    }
    return res;
  }, [selectedGene, countsHeader, countsRows, metadataMap]);

  // קו חציון בין הנקודות
  const medianLine = useMemo(() => {
    const order: TimepointKey[] = ["Baseline", "15", "30", "60"];
    return order.map((tp) => {
      const arr = byTimepoint[tp];
      if (!arr || arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    });
  }, [byTimepoint]);

  return (
    <section className="w-full">
      <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">{title}</h3>

      {/* חיפוש + בחירה */}
      <div className="mb-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm text-neutral-600 mb-1">Search a {rnaClass.slice(0, -1)} name</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Type to filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm text-neutral-600 mb-1">{rnaClass} list</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={selectedGene ?? ""}
            onChange={(e) => setSelectedGene(e.target.value)}
          >
            {filteredGenes.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : !selectedGene ? (
        <div className="text-neutral-500 text-sm">No gene selected.</div>
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl border bg-white p-2">
          {/* טיפוסי props של Plot עשויים להקשות ב-TS בפרויקטים מסוימים.
              משתמשים כאן ב-any באופן נקודתי כדי להבטיח build חלק. */}
          <Plot
            data={
              [
                { type: "box", name: "0 min", y: byTimepoint["Baseline"], boxpoints: "all", jitter: 0.2, pointpos: -1.8, marker: { size: 6 }, line: { width: 2 } },
                { type: "box", name: "15 min", y: byTimepoint["15"],       boxpoints: "all", jitter: 0.2, pointpos: -1.8, marker: { size: 6 }, line: { width: 2 } },
                { type: "box", name: "30 min", y: byTimepoint["30"],       boxpoints: "all", jitter: 0.2, pointpos: -1.8, marker: { size: 6 }, line: { width: 2 } },
                { type: "box", name: "60 min", y: byTimepoint["60"],       boxpoints: "all", jitter: 0.2, pointpos: -1.8, marker: { size: 6 }, line: { width: 2 } },
                {
                  type: "scatter",
                  mode: "lines+markers",
                  name: "Median",
                  x: ["0 min", "15 min", "30 min", "60 min"],
                  y: medianLine,
                  line: { width: 2 },
                  marker: { size: 6 },
                  hoverinfo: "skip",
                },
              ] as any
            }
            layout={
              {
                title: `${selectedGene}`,
                xaxis: { title: "timepoint" },
                yaxis: { title: "DESeq2 normalized count", rangemode: "tozero" },
                margin: { l: 60, r: 20, t: 40, b: 60 },
                showlegend: false,
                autosize: true,
              } as any
            }
            useResizeHandler
            style={{ width: "100%", height: "520px" }}
            config={{ displayModeBar: false, responsive: true } as any}
          />
        </div>
      )}

      <p className="text-xs text-neutral-500 mt-2">
        Expecting files in <code className="font-mono">public/interactive_boxplot/</code>:
        {" "}
        <code className="font-mono">{COUNTS_FILE[rnaClass].split("/").pop()}</code> and{" "}
        <code className="font-mono">Metadata.csv</code>.
      </p>
    </section>
  );
}
