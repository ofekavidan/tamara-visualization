"use client";

import React from "react";
import dynamic from "next/dynamic";

const Plot: any = dynamic(() => import("react-plotly.js"), { ssr: false });

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";
type BoxPlotProps = { rnaClass: RNACategory };

type CountsRow = { name: string; [sampleId: string]: string };
type MetaRow   = { sample: string; timepoint: "0" | "15" | "30" | "60" };

function parseCSV(text: string): Record<string,string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",");
    const row: Record<string,string> = {};
    headers.forEach((h,i) => row[h] = (cells[i] ?? "").trim());
    return row;
  });
}

export default function BoxPlot({ rnaClass }: BoxPlotProps) {
  const [names, setNames]       = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [counts, setCounts]     = React.useState<CountsRow[]>([]);
  const [meta, setMeta]         = React.useState<MetaRow[]>([]);
  const [deRows, setDeRows]     = React.useState<Record<"15"|"30"|"60", Record<string,string>>>({} as any);

  const countsFile =
    rnaClass === "tRFs"    ? "/interactive_boxplot/tRF_countsnorm.csv"   :
    rnaClass === "miRs"    ? "/interactive_boxplot/miR_countsnorm.csv"   :
    rnaClass === "lncRNAs" ? "/interactive_boxplot/lncRNA_countsnorm.csv":
                              "/interactive_boxplot/mRNA_countsnorm.csv";

  /* ------------------------ load metadata + counts ------------------------ */
  React.useEffect(() => {
    let dead = false;

    (async () => {
      const [mRes, cRes] = await Promise.all([
        fetch("/interactive_boxplot/Metadata.csv"),
        fetch(countsFile),
      ]);
      if (!mRes.ok || !cRes.ok) return;

      // Metadata: sample ↦ timepoint
      const metaRows = parseCSV(await mRes.text()).map(r => ({
        sample:    r["sample"] ?? r["Sample"] ?? r["name"],
        timepoint: (r["timepoint"] ?? r["Timepoint"] ?? r["tp"] ?? "0") as any,
      }));

      // Counts: העמודה הראשונה היא שם ה-RNA, שאר העמודות – דגימות
      const cText = await cRes.text();
      const cRowsRaw = parseCSV(cText);
      const countRows = cRowsRaw.map(r => {
        const entries = Object.entries(r);
        const nameKey = entries[0][0];     // העמודה הראשונה
        const name    = r[nameKey];
        const rest: any = { name };
        entries.slice(1).forEach(([k,v]) => rest[k] = v);
        return rest as CountsRow;
      });

      if (dead) return;

      setMeta(metaRows);
      setCounts(countRows);

      const allNames = countRows.map(r => r.name).filter(Boolean);
      setNames(allNames);
      setSelected(allNames[0] ?? "");
    })();

    return () => { dead = true; };
  }, [rnaClass]);

  /* ------------------------ short DE table under plot --------------------- */
  React.useEffect(() => {
    let dead = false;
    const tps: ("15"|"30"|"60")[] = ["15","30","60"];

    (async () => {
      const acc: any = {};
      for (const tp of tps) {
        try {
          // אותם קבצים של ה-Volcano
          const token =
            rnaClass === "tRFs"   ? "tRF"   :
            rnaClass === "miRs"   ? "miR"   :
            rnaClass === "lncRNAs"? "lncRNA": "mRNA";
          const url = `/de/DE_${token}_${tp}minvsBaseline.csv`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const rows = parseCSV(await res.text());
          const row  = rows.find(r => {
            const nm = (r["X.1"] ?? r["X"] ?? "").toLowerCase();
            return selected && nm.includes(selected.toLowerCase());
          });
          if (row) acc[tp] = row;
        } catch { /* ignore */ }
      }
      if (!dead) setDeRows(acc);
    })();

    return () => { dead = true; };
  }, [rnaClass, selected]);

  /* ------------------------ split counts per timepoint -------------------- */
  function valuesByTimepoint(row?: CountsRow) {
    const byTp: Record<"0"|"15"|"30"|"60", number[]> = { "0":[], "15":[], "30":[], "60":[] };
    if (!row) return byTp;

    const entries = Object.entries(row).filter(([k]) => k !== "name");
    for (const [sample, val] of entries) {
      const tp = meta.find(m => m.sample === sample)?.timepoint ?? "0";
      const num = Number(val);
      if (Number.isFinite(num)) byTp[tp].push(num);
    }
    return byTp;
  }

  const current = counts.find(r => r.name === selected);
  const byTp    = valuesByTimepoint(current);

  const boxes = (["0","15","30","60"] as const).map(tp => ({
    type: "box",
    name: (tp === "0" ? "0 min" : `${tp} min`),
    y: byTp[tp].length ? byTp[tp] : [0], // לא לקרוס אם ריק
    boxpoints: "all",
    jitter: 0.35,
    pointpos: 0,
    marker: { size: 6 },
    line:   { width: 1 },
  }));

  const means = (["0","15","30","60"] as const).map(tp => {
    const arr = byTp[tp];
    return arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : 0;
  });

  const meanTrace = {
    type: "scatter",
    mode: "lines+markers",
    x: boxes.map(b => b.name),
    y: means,
    name: "mean",
    marker: { size: 6 },
    line:   { width: 2 },
  };

  return (
    <section className="w-full mt-10">
      <h3 className="text-center text-2xl font-extrabold mb-4">Boxplot</h3>

      <div className="flex items-center gap-2 justify-center mb-3">
        <span className="text-sm">tRFs name:</span>
        <select className="min-w-[320px] px-3 py-1 border rounded-md" value={selected} onChange={e => setSelected(e.target.value)}>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-xs text-rose-500">droplist</span>
      </div>

      <div className="rounded-md border-2 border-[#2C5F7C] bg-white overflow-hidden">
        <Plot
          data={[...boxes, meanTrace]}
          layout={{
            paper_bgcolor: "#0f172a00",
            plot_bgcolor:  "#0f172a00",
            height: 420,
            margin: { l: 40, r: 10, t: 10, b: 60 },
            showlegend: true,
            xaxis: { title: "" },
            yaxis: { title: "DESeq2 normalized count" },
          }}
          config={{ displayModeBar: false }}
          style={{ width:"100%", height:"100%" }}
        />
        <p className="text-center text-xs pb-3">x-axis: timepoint, y-axis: DESeq2 normalized count</p>
      </div>

      {/* טבלת DE קצרה */}
      {selected && (
        <div className="max-w-3xl mx-auto mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">{selected}</th>
                  <th className="p-2">15 vs Baseline</th>
                  <th className="p-2">30 vs Baseline</th>
                  <th className="p-2">60 vs Baseline</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 font-medium">log2FoldChange</td>
                  {(["15","30","60"] as const).map(tp => (
                    <td key={tp} className="p-2 text-center">{deRows[tp]?.["log2FoldChange"] ?? "—"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 font-medium">padj</td>
                  {(["15","30","60"] as const).map(tp => (
                    <td key={tp} className="p-2 text-center">{deRows[tp]?.["padj"] ?? deRows[tp]?.["P.adj"] ?? "—"}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {!Object.keys(deRows).length && (
            <p className="text-xs text-center text-orange-600 mt-2">
              לא נמצאה שורת DE עבור "{selected}" ב-/public/de/.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
