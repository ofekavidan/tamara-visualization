// src/components/BoxPlot.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

// מטיפוס any כדי לא להתקע על טיפוסים של Plotly בזמן פיתוח/Deploy
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

type RNAClass = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";

type BoxPlotProps = {
  rnaClass: RNAClass;
};

const COUNTS_FILE: Record<RNAClass, string> = {
  tRFs: "tRF_countsnorm.csv",
  miRs: "miR_countsnorm.csv",
  lncRNAs: "lncRNA_countsnorm.csv",
  mRNAs: "mRNA_countsnorm.csv",
};

/* ---------- CSV utils ---------- */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0,
    cur = "",
    row: string[] = [],
    inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\t")) {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (cur.length > 0 || row.length) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      }
      if (ch === "\r" && text[i + 1] === "\n") i++;
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  if (cur.length > 0 || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function toObjects(rows: string[][]): Array<Record<string, string>> {
  if (!rows.length) return [];
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length && r.some((c) => c !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, idx) => (o[h] = r[idx] ?? ""));
      return o;
    });
}

/* ---------- helpers ---------- */
const mean = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const normalize = (s: string) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, "")
    .replace(/[^a-z0-9]+/g, ""); // משאיר רק a-z0-9

// A/B/C/D → 0/15/30/60
function fallbackTimeByPrefix(sample: string): string | null {
  const s = sample.trim().toUpperCase();
  if (s.startsWith("A")) return "0";
  if (s.startsWith("B")) return "15";
  if (s.startsWith("C")) return "30";
  if (s.startsWith("D")) return "60";
  return null;
}

export default function BoxPlot({ rnaClass }: BoxPlotProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [names, setNames] = React.useState<string[]>([]);
  const [selectedName, setSelectedName] = React.useState<string>("");

  const [trace, setTrace] = React.useState<any[] | null>(null);

  // נשמור את פונקציית בניית ה-trace כדי לשחזר כאשר בוחרים שם אחר
  const makeTraceRef = React.useRef<(name: string) => any[] | null>(() => null);

  React.useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);
      setError(null);
      setTrace(null);
      setNames([]);
      setSelectedName("");

      try {
        const base = "/interactive_boxplot";
        const [metaTxt, countsTxt] = await Promise.all([
          fetch(`${base}/Metadata.csv`).then((r) => {
            if (!r.ok) throw new Error("Failed to fetch Metadata.csv");
            return r.text();
          }),
          fetch(`${base}/${COUNTS_FILE[rnaClass]}`).then((r) => {
            if (!r.ok)
              throw new Error(`Failed to fetch ${COUNTS_FILE[rnaClass]}`);
            return r.text();
          }),
        ]);
        if (aborted) return;

        const metaRows = parseCSV(metaTxt);
        const countsRows = parseCSV(countsTxt);

        const meta = toObjects(metaRows);
        const counts = toObjects(countsRows);

        // נזהה מפתחות אפשריים למטה-דאטה
        const metaSampleKey =
          Object.keys(meta[0] ?? {}).find((k) => /^sample$/i.test(k)) ??
          Object.keys(meta[0] ?? {}).find((k) => /name|id/i.test(k)) ??
          "Sample";
        const metaTimeKey =
          Object.keys(meta[0] ?? {}).find((k) => /^time$/i.test(k)) ?? "Time";

        // נבנה מיפוי sample(raw & normalized) → time
        const sampleToTime = new Map<string, string>();
        const sampleToTimeNorm = new Map<string, string>();
        for (const m of meta) {
          const raw = (m as any)[metaSampleKey] ?? "";
          const t = (m as any)[metaTimeKey] ?? "";
          if (!raw || !t) continue;
          sampleToTime.set(raw, t);
          sampleToTimeNorm.set(normalize(raw), t);
        }

        // header
        const header = countsRows[0] ?? [];
        const idKey = header[0]; // העמודה הראשונה = שם ה-RNA
        const sampleCols = header.slice(1);

        // שמות לבחירה
        const allNames = counts.map((r) => r[idKey]).filter(Boolean);
        setNames(allNames);
        setSelectedName(allNames[0] ?? "");

        // פונקציה לבניית ה-trace
        const makeTrace = (gene: string) => {
          const row = counts.find((r) => r[idKey] === gene);
          if (!row) return null;

          const times = ["0", "15", "30", "60"];
          const yByTime: Record<string, number[]> = {
            "0": [],
            "15": [],
            "30": [],
            "60": [],
          };

          for (const col of sampleCols) {
            const raw = col;
            const norm = normalize(col);

            // 1) ניסיון התאמה ישירה לפי Metadata
            let tp =
              sampleToTime.get(raw) ??
              sampleToTimeNorm.get(norm) ??
              null;

            // 2) נפילה חכמה לפי האות הראשונה
            if (!tp) tp = fallbackTimeByPrefix(raw);

            if (!tp || !times.includes(tp)) continue;

            const vRaw = row[raw];
            const v = Number(vRaw);
            if (!Number.isFinite(v)) continue;

            yByTime[tp].push(v);
          }

          const xLabels = ["0 min", "15 min", "30 min", "60 min"];
          const yArrays = [yByTime["0"], yByTime["15"], yByTime["30"], yByTime["60"]];

          const boxes = yArrays.map((y, i) => ({
            type: "box",
            y,
            name: xLabels[i],
            boxpoints: "outliers",
            jitter: 0.3,
            marker: { size: 4 },
            line: { width: 1 },
            showlegend: false,
          }));

          const means = yArrays.map((a) => mean(a));
          const meanLine = {
            type: "scatter",
            mode: "lines+markers",
            x: xLabels,
            y: means,
            name: "mean",
            marker: { size: 6 },
            line: { shape: "linear", width: 2 },
          };

          return [...boxes, meanLine];
        };

        const initial = allNames[0] ? makeTrace(allNames[0]) : null;
        setTrace(initial);
        (makeTraceRef.current as any) = makeTrace;
      } catch (e: any) {
        console.error(e);
        if (!aborted) {
          setError(
            "Could not load CSVs. Expecting files in public/interactive_boxplot/*.csv"
          );
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [rnaClass]);

  // שינוי שם → בנה trace מחדש
  React.useEffect(() => {
    if (!selectedName) return;
    const mk = makeTraceRef.current;
    const t = mk ? mk(selectedName) : null;
    setTrace(t);
  }, [selectedName]);

  return (
    <section className="w-full">
      <h3 className="text-center text-xl font-extrabold mt-10 mb-2">Boxplot</h3>

      <div className="mx-auto max-w-3xl grid grid-cols-12 gap-3 items-center">
        <label className="col-span-2 text-sm text-neutral-700">
          {rnaClass} name:
        </label>

        <div className="col-span-8">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            disabled={loading || !!error}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 text-xs text-rose-500">droplist</div>
      </div>

      <div className="mt-4 min-h-[420px]">
        {error && <p className="text-center text-rose-600 text-sm">{error}</p>}
        {!error && loading && (
          <p className="text-center text-neutral-500 text-sm">Loading…</p>
        )}
        {!error && !loading && trace && (
          <Plot
            data={trace}
            layout={{
              paper_bgcolor: "#2C5F7C",
              plot_bgcolor: "#2C5F7C",
              height: 420,
              margin: { l: 60, r: 40, t: 10, b: 60 },
              xaxis: {
                title: "timepoint",
                tickfont: { color: "#fff" },
                titlefont: { color: "#fff" },
              },
              yaxis: {
                title: "DESeq2 normalized count",
                tickfont: { color: "#fff" },
                titlefont: { color: "#fff" },
                rangemode: "tozero",
              },
              showlegend: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "420px" }}
            useResizeHandler
          />
        )}
      </div>

      <p className="text-center text-xs mt-2">
        x-axis: timepoint, y-axis: DESeq2 normalized count
      </p>
    </section>
  );
}
