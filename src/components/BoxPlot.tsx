"use client";

import React from "react";
import dynamic from "next/dynamic";

// Plotly loads only on the client
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";

type BoxPlotProps = {
  rnaClass: RNACategory;
};

/* -------------------------------- helpers -------------------------------- */

const stripQuotes = (s: string) => s.replace(/^"+|"+$/g, "");
const toNumber = (x?: string) =>
  x == null || x === "" || Number.isNaN(Number(x)) ? undefined : Number(x);

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => stripQuotes(h).trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map(stripQuotes);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

const sanitize = (s: string | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9]+/g, ""); // keep letters/digits only

function normalizeTp(v?: string): "0" | "15" | "30" | "60" | undefined {
  const s = (v ?? "").toLowerCase();
  if (/(^|[^0-9])(0|min|t0|baseline)/.test(s)) return "0";
  if (/15/.test(s)) return "15";
  if (/30/.test(s)) return "30";
  if (/60/.test(s)) return "60";
  return undefined;
}

function datasetUrl(rnaClass: RNACategory, tp: "15" | "30" | "60") {
  const token =
    rnaClass === "tRFs"
      ? "tRF"
      : rnaClass === "miRs"
      ? "miR"
      : rnaClass === "lncRNAs"
      ? "lncRNA"
      : "mRNA";
  return `/de/DE_${token}_${tp}minvsBaseline.csv`;
}

const COLORS = {
  "0": "#60a5fa", // blue
  "15": "#f59e0b", // orange
  "30": "#10b981", // green
  "60": "#ef4444", // red
  mean: "#8b5cf6", // purple
};

/* -------------------------------- data types ------------------------------ */

type CountsRow = { name: string; [sampleCol: string]: string };
type MetaRow = { rawSample: string; tp: "0" | "15" | "30" | "60" };

/* -------------------------------- component ------------------------------- */

export default function BoxPlot({ rnaClass }: BoxPlotProps) {
  const [names, setNames] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string>("");

  const [counts, setCounts] = React.useState<CountsRow[]>([]);
  const [meta, setMeta] = React.useState<MetaRow[]>([]);
  const [deRows, setDeRows] = React.useState<
    Record<"15" | "30" | "60", Record<string, string>>
  >({} as any);

  const countsFile =
    rnaClass === "tRFs"
      ? "/interactive_boxplot/tRF_countsnorm.csv"
      : rnaClass === "miRs"
      ? "/interactive_boxplot/miR_countsnorm.csv"
      : rnaClass === "lncRNAs"
      ? "/interactive_boxplot/lncRNA_countsnorm.csv"
      : "/interactive_boxplot/mRNA_countsnorm.csv";

  const labelSingular =
    rnaClass === "tRFs"
      ? "tRF"
      : rnaClass === "miRs"
      ? "miR"
      : rnaClass === "lncRNAs"
      ? "lncRNA"
      : "mRNA";

  /* ------------------------------- load files ------------------------------ */
  React.useEffect(() => {
    let dead = false;

    (async () => {
      const [mRes, cRes] = await Promise.all([
        fetch("/interactive_boxplot/Metadata.csv"),
        fetch(countsFile),
      ]);
      if (!mRes.ok || !cRes.ok) return;

      const metaRows = parseCSV(await mRes.text())
        .map((r) => {
          const sample =
            r["sample"] ?? r["Sample"] ?? r["name"] ?? r["ID"] ?? r["id"] ?? "";
          const rawTp =
            r["timepoint"] ?? r["Timepoint"] ?? r["tp"] ?? r["TP"] ?? "";
          const tp = normalizeTp(rawTp);
          return { rawSample: sample, tp: (tp ?? "0") as MetaRow["tp"] };
        })
        .filter((r) => r.rawSample);

      const countRows = parseCSV(await cRes.text()).map((r) => {
        const entries = Object.entries(r);
        const firstKey = entries[0][0];
        const name = stripQuotes(r[firstKey] ?? "");
        const rest: any = { name };
        entries.slice(1).forEach(([k, v]) => (rest[k] = v));
        return rest as CountsRow;
      });

      if (dead) return;

      setMeta(metaRows);
      setCounts(countRows);
      const allNames = [...new Set(countRows.map((r) => stripQuotes(r.name)))].sort(
        (a, b) => a.localeCompare(b),
      );
      setNames(allNames);
      setSelected(allNames[0] ?? "");
    })();

    return () => {
      dead = true;
    };
  }, [rnaClass, countsFile]);

  /* ------------------------------- fetch DE row ---------------------------- */
  React.useEffect(() => {
    let dead = false;
    (async () => {
      const acc: any = {};
      for (const tp of ["15", "30", "60"] as const) {
        try {
          const res = await fetch(datasetUrl(rnaClass, tp));
          if (!res.ok) continue;
          const rows = parseCSV(await res.text());
          const wanted = sanitize(selected);
          const row =
            rows.find((r) => {
              const name =
                r["tRF_name"] ??
                r["miR_name"] ??
                r["X.1"] ??
                r["X"] ??
                r["name"] ??
                r["id"] ??
                "";
              return sanitize(name) === wanted;
            }) ?? undefined;
          if (row) acc[tp] = row;
        } catch {
          /* ignore */
        }
      }
      if (!dead) setDeRows(acc);
    })();
    return () => {
      dead = true;
    };
  }, [rnaClass, selected]);

  /* -------- map sample columns to timepoints (0 / 15 / 30 / 60) -------- */

  const metaMap = React.useMemo(() => {
    const m: Record<string, MetaRow["tp"]> = {};
    for (const r of meta) m[sanitize(r.rawSample)] = r.tp;
    return m;
  }, [meta]);

  const guessTpFromCol = (col: string): MetaRow["tp"] => {
    const tpn = normalizeTp(col) ?? "0";
    return tpn as MetaRow["tp"];
  };

  function valuesByTimepoint(row?: CountsRow) {
    const byTp: Record<"0" | "15" | "30" | "60", number[]> = {
      "0": [],
      "15": [],
      "30": [],
      "60": [],
    };
    if (!row) return byTp;

    const entries = Object.entries(row).filter(([k]) => k !== "name");
    for (const [sampleCol, rawVal] of entries) {
      const key = sanitize(sampleCol);
      const tp = metaMap[key] ?? guessTpFromCol(sampleCol);
      const num = toNumber(rawVal);
      if (num != null) byTp[tp].push(num);
    }
    return byTp;
  }

  const current = counts.find((r) => sanitize(r.name) === sanitize(selected));
  const byTp = valuesByTimepoint(current);

  /* -------------------------------- plot data ----------------------------- */

  const traces = (["0", "15", "30", "60"] as const).map((tp) => ({
    type: "box",
    name: tp === "0" ? "0 min" : `${tp} min`,
    y: byTp[tp].length ? byTp[tp] : [0], // protect from empty
    boxpoints: "all",
    jitter: 0.35,
    pointpos: 0,
    marker: { size: 6, color: COLORS[tp] },
    line: { width: 1, color: COLORS[tp] },
    hovertemplate: `${tp === "0" ? "0" : tp} min<br>%{y:.2f}<extra></extra>`,
  }));

  const means = (["0", "15", "30", "60"] as const).map((tp) => {
    const arr = byTp[tp];
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  });

  const meanTrace = {
    type: "scatter",
    mode: "lines+markers",
    x: traces.map((t) => t.name),
    y: means,
    name: "mean",
    marker: { size: 6, color: COLORS.mean },
    line: { width: 2, color: COLORS.mean },
    hovertemplate: "mean<br>%{y:.2f}<extra></extra>",
  };

  const nPerTp = (["0", "15", "30", "60"] as const).map((tp) => byTp[tp].length);

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <section className="w-full mt-10">
      <h3 className="text-center text-2xl font-extrabold mb-4">Boxplot</h3>

      {/* searchable droplist (input + datalist) */}
      <div className="flex items-center gap-2 justify-center mb-3">
        <span className="text-sm">{labelSingular} name:</span>
        <input
          className="min-w-[320px] px-3 py-1 border rounded-md"
          list="rna-names"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          placeholder="Start typing a name…"
        />
        <datalist id="rna-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <span className="text-xs text-rose-500">droplist</span>
      </div>

      <div className="rounded-md border-2 border-[#2C5F7C] bg-white overflow-hidden">
        <Plot
          data={[...traces, meanTrace]}
          layout={{
            paper_bgcolor: "#0f172a00",
            plot_bgcolor: "#0f172a00",
            height: 420,
            margin: { l: 40, r: 10, t: 10, b: 60 },
            showlegend: true,
            xaxis: { title: "" },
            yaxis: { title: "DESeq2 normalized count" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
        />
        <p className="text-center text-xs pb-3">
          x-axis: timepoint, y-axis: DESeq2 normalized count
        </p>
      </div>

      {/* English notice about sample counts per timepoint */}
      {(nPerTp.some((n) => n !== 6) || nPerTp.every((n) => n === 0)) && (
        <p className="text-center text-xs text-orange-600 mt-2">
          Note: detected samples — 0 min: {nPerTp[0]}, 15 min: {nPerTp[1]}, 30
          min: {nPerTp[2]}, 60 min: {nPerTp[3]} (expected 6 per timepoint). If
          this looks wrong, please confirm that sample column names in the{" "}
          <em>counts</em> table match the names in <em>Metadata</em>, or that
          they contain “0/T0/baseline”, “15/30/60”.
        </p>
      )}

      {/* short DE table below the boxplot */}
      {selected && (
        <div className="max-w-3xl mx-auto mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">
                    {selected.replace(/^"+|"+$/g, "")}
                  </th>
                  <th className="p-2">15 vs Baseline</th>
                  <th className="p-2">30 vs Baseline</th>
                  <th className="p-2">60 vs Baseline</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 font-medium">log2FoldChange</td>
                  {(["15", "30", "60"] as const).map((tp) => (
                    <td key={tp} className="p-2 text-center">
                      {deRows[tp]?.["log2FoldChange"] ??
                        deRows[tp]?.["log2FC"] ??
                        "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 font-medium">padj</td>
                  {(["15", "30", "60"] as const).map((tp) => (
                    <td key={tp} className="p-2 text-center">
                      {deRows[tp]?.["padj"] ?? deRows[tp]?.["P.adj"] ?? "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
