"use client";

import React from "react";
import dynamic from "next/dynamic";

// Plotly לא עובד ב-SSR, טעינה דינמית
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";
type Timepoint = "15" | "30" | "60";
type VolcanoGridProps = { rnaClass: RNACategory };

/* ----------------------------- קבועים ושגרות ----------------------------- */
const FC_ABS_THRESH = 1;      // |log2FC| ≥ 1
const PADJ_CUTOFF = 0.05;     // קו סף padj
const PADJ_LINE_Y = -Math.log10(PADJ_CUTOFF);
const EPS = 1e-300;           // כש-p==0

/** שם קובץ לפי הקטגוריה */
function datasetUrl(rnaClass: RNACategory, tp: Timepoint) {
  const token =
    rnaClass === "tRFs" ? "tRF" :
    rnaClass === "miRs" ? "miR" :
    rnaClass === "lncRNAs" ? "lncRNA" : "mRNA";
  return `/de/DE_${token}_${tp}minvsBaseline.csv`;
}

/** CSV parser פשוט (הקבצים כאן לא מכילים פסיקים בתוך טקסטים) */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(s => s.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

const toNum = (s?: string) => (s == null || s === "") ? undefined : Number(s);
const pick = (r: Record<string, string>, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
};

/* ----------------------------- מצב צביעה/דגש ----------------------------- */
type ColorMode = "significance" | "name" | "family";

/* -------------------------------- קומפוננטה ------------------------------ */
export default function VolcanoGrid({ rnaClass }: VolcanoGridProps) {
  const [colorMode, setColorMode] = React.useState<ColorMode>("significance");
  const [selectedName, setSelectedName] = React.useState("");
  const [family, setFamily] = React.useState({ tRF_type: "", origin: "", aminoAcid: "" });

  const timepoints: Timepoint[] = ["15", "30", "60"];

  type Bucket = {
    x: number[]; y: number[]; labels: string[];
    tRF_type?: string[]; origin?: string[]; aminoAcid?: string[];
    base: any;
  };

  const [dataByTP, setDataByTP] = React.useState<Record<Timepoint, Bucket>>({} as any);
  const [hasRealData, setHasRealData] = React.useState(false);

  /* ----------------------------- טעינת הנתונים ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;

    async function load(tp: Timepoint): Promise<Bucket> {
      try {
        const res = await fetch(datasetUrl(rnaClass, tp));
        if (!res.ok) throw new Error("not found");
        const rows = parseCSV(await res.text());
        setHasRealData(true);

        const xs: number[] = [];
        const ys: number[] = [];
        const labels: string[] = [];
        const tRFType: string[] = [];
        const origin: string[] = [];
        const amino: string[] = [];

        for (const r of rows) {
          const l2fc = toNum(pick(r, ["log2FoldChange", "log2FC", "logFC", "log2fc"]));
          const pval = toNum(pick(r, ["pvalue", "p.value", "pval"]));
          const padj = toNum(pick(r, ["padj", "P.adj", "padjust"]));
          let p = pval ?? padj;
          if (p == null) continue;
          if (!Number.isFinite(p)) continue;
          if (p <= 0) p = EPS;         // הגנה מפני log10(0)
          const y = -Math.log10(p);

          let name = "";
          if (rnaClass === "tRFs") {
            name = pick(r, ["tRF_name", "X", "X.1"]) ?? "";
            tRFType.push(pick(r, ["tRF_type"]) ?? "");
            origin.push(pick(r, ["origin"]) ?? "");
            amino.push(pick(r, ["aminoAcid", "aminoacid", "amino_acid"]) ?? "");
          } else if (rnaClass === "miRs") {
            name = pick(r, ["miR_name", "X", "X.1"]) ?? "";
          } else {
            name = pick(r, ["X.1", "X", "gene", "id"]) ?? "";
          }

          if (l2fc != null && Number.isFinite(y)) {
            xs.push(l2fc);
            ys.push(y);
            labels.push(name);
          }
        }

        const base = {
          x: xs, y: ys, text: labels,
          type: "scattergl", mode: "markers",
          marker: { size: 6, color: "rgba(0,0,0,0.55)" }, // שחור כברירת מחדל
          hovertemplate: "%{text}<br>log2FC=%{x:.2f}<br>-log10(p)=%{y:.2f}<extra></extra>",
          name: "all",
        };

        const bucket: Bucket = { x: xs, y: ys, labels, base };
        if (rnaClass === "tRFs") {
          bucket.tRF_type = tRFType;
          bucket.origin = origin;
          bucket.aminoAcid = amino;
        }
        return bucket;
      } catch {
        // placeholder אם חסר קובץ
        const xs = Array.from({ length: 250 }, () => (Math.random() - 0.5) * 4);
        const ys = Array.from({ length: 250 }, () => Math.random() * 6);
        const labels = xs.map((_, i) => `${rnaClass}_${tp}_${i + 1}`);
        const base = {
          x: xs, y: ys, text: labels,
          type: "scattergl", mode: "markers",
          marker: { size: 6, color: "rgba(0,0,0,0.55)" },
          hovertemplate: "%{text}<br>log2FC=%{x:.2f}<br>-log10(p)=%{y:.2f}<extra></extra>",
          name: "all (placeholder)",
        };
        return { x: xs, y: ys, labels, base };
      }
    }

    (async () => {
      const out: Partial<Record<Timepoint, Bucket>> = {};
      for (const tp of timepoints) out[tp] = await load(tp);
      if (!cancelled) setDataByTP(out as Record<Timepoint, Bucket>);
    })();

    return () => { cancelled = true; };
  }, [rnaClass]);

  /* --------------------------- בניית שכבת הדגשה --------------------------- */
  function buildHighlight(tp: Timepoint) {
    const b = dataByTP[tp];
    if (!b) return undefined;

    if (colorMode === "significance") {
      const colors = b.x.map((x, i) => {
        const passPadj = b.y[i] >= PADJ_LINE_Y;
        const passFC = Math.abs(x) >= FC_ABS_THRESH;
        if (passPadj && passFC) return "#ef4444"; // שניהם – אדום
        if (passPadj) return "#3b82f6";          // רק padj – כחול
        if (passFC) return "#22c55e";            // רק FC – ירוק
        return "rgba(0,0,0,0.55)";               // NS – שחור
      });
      return { ...b.base, marker: { size: 6, color: colors }, name: "significance" };
    }

    if (colorMode === "name" && selectedName.trim()) {
      const q = selectedName.toLowerCase();
      const idx: number[] = [];
      b.labels.forEach((t, i) => t.toLowerCase().includes(q) && idx.push(i));
      return {
        x: idx.map(i => b.x[i]),
        y: idx.map(i => b.y[i]),
        text: idx.map(i => b.labels[i]),
        type: "scattergl", mode: "markers",
        marker: { size: 10, color: "#0ea5e9", line: { color: "#0ea5e9", width: 1 }, symbol: "diamond-open" },
        name: selectedName,
        hovertemplate: "%{text}<br>log2FC=%{x:.2f}<br>-log10(p)=%{y:.2f}<extra></extra>",
      };
    }

    if (colorMode === "family" && rnaClass === "tRFs" &&
        (family.tRF_type || family.origin || family.aminoAcid)) {
      const match = (a: string | undefined, q: string) =>
        a && q ? a.toLowerCase().includes(q.toLowerCase()) : false;

      const idx: number[] = [];
      b.labels.forEach((_, i) => {
        const okType  = !family.tRF_type || match(b.tRF_type?.[i], family.tRF_type);
        const okOrig  = !family.origin   || match(b.origin?.[i],    family.origin);
        const okAmino = !family.aminoAcid|| match(b.aminoAcid?.[i], family.aminoAcid);
        if (okType && okOrig && okAmino) idx.push(i);
      });

      return {
        x: idx.map(i => b.x[i]),
        y: idx.map(i => b.y[i]),
        text: idx.map(i => b.labels[i]),
        type: "scattergl", mode: "markers",
        marker: { size: 11, color: "#2563eb", line: { color: "#2563eb", width: 1.5 }, symbol: "triangle-up-open" },
        name: "tRF family",
        hovertemplate: "%{text}<br>log2FC=%{x:.2f}<br>-log10(p)=%{y:.2f}<extra></extra>",
      };
    }

    return undefined;
  }

  /* ------------------------------ Layout לכרטיס --------------------------- */
  const cardLayout = (): any => ({
    paper_bgcolor: "#0f172a00",
    plot_bgcolor:  "#0f172a00",
    height: 340,
    margin: { l: 40, r: 12, t: 10, b: 48 },
    xaxis: { title: { text: "log2(Fold Change)" }, zeroline: false },
    yaxis: { title: { text: "-log10(p-value)" }, zeroline: false },
    shapes: [
      { type: "line", x0: -FC_ABS_THRESH, x1: -FC_ABS_THRESH, y0: 0, y1: 10, line: { color: "#94a3b8", width: 1, dash: "dot" } },
      { type: "line", x0:  FC_ABS_THRESH, x1:  FC_ABS_THRESH, y0: 0, y1: 10, line: { color: "#94a3b8", width: 1, dash: "dot" } },
      { type: "line", x0: -10, x1: 10, y0: PADJ_LINE_Y, y1: PADJ_LINE_Y, line: { color: "#94a3b8", width: 1, dash: "dot" } },
    ],
    showlegend: false,
    hovermode: "closest",
  });

  /* ----------------------------- רינדור כרטיס ----------------------------- */
  function VolcanoCard({ tp }: { tp: Timepoint }) {
    const b  = dataByTP[tp];
    const hi = buildHighlight(tp);
    const data = b ? (hi ? [b.base, hi] : [b.base]) : [];
    return (
      <div className="rounded-md border-2 border-[#2C5F7C] overflow-hidden bg-white">
        <Plot
          data={data}
          layout={cardLayout()}
          config={{ displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
        />
        <div className="text-center py-2 text-sm border-t">{tp} min</div>
      </div>
    );
  }

  /* --------------------------------- UI ----------------------------------- */
  return (
    <section className="w-full">
      <h2 className="text-center text-3xl font-extrabold mb-6">Volcano plots</h2>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Color by:</span>
          {/* ← droplist במקום רדיו */}
          <select
            className="px-3 py-1 border rounded-md"
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
          >
            <option value="significance">significance</option>
            <option value="name">RNA name</option>
            <option value="family">tRF family</option>
          </select>
        </div>

        {colorMode === "name" && (
          <div className="flex items-center gap-2">
            <span className="text-sm">name:</span>
            <input
              className="px-3 py-1 border rounded-md min-w-[220px]"
              placeholder="e.g. tRF-1001 / miR-21 / CARMN"
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
            />
          </div>
        )}

        {colorMode === "family" && rnaClass === "tRFs" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="px-3 py-1 border rounded-md"
              placeholder="tRF_type"
              value={family.tRF_type}
              onChange={(e) => setFamily(f => ({ ...f, tRF_type: e.target.value }))}
            />
            <input
              className="px-3 py-1 border rounded-md"
              placeholder="origin"
              value={family.origin}
              onChange={(e) => setFamily(f => ({ ...f, origin: e.target.value }))}
            />
            <input
              className="px-3 py-1 border rounded-md"
              placeholder="aminoAcid"
              value={family.aminoAcid}
              onChange={(e) => setFamily(f => ({ ...f, aminoAcid: e.target.value }))}
            />
            <span className="text-xs text-slate-500">(גם חלקי, למשל “nuclear”, “Ala”)</span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {timepoints.map(tp => <VolcanoCard key={tp} tp={tp} />)}
      </div>

      {!hasRealData && (
        <p className="text-xs text-center text-orange-600 mt-3">
          Showing placeholder points (no CSV found under <code>/public/de/</code>).
        </p>
      )}

      <p className="text-center text-xs mt-6">
        x-axis: log2(Fold Change), y-axis: −log10(p-value)
      </p>
    </section>
  );
}
