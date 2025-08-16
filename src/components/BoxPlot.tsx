"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as React.FC<any>;

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";
type TimeKey = "Baseline" | "15" | "30" | "60";

const COUNTS_FILE: Record<RNACategory, string> = {
  tRFs: "/interactive_boxplot/tRF_countsnorm.csv",
  miRs: "/interactive_boxplot/miR_countsnorm.csv",
  lncRNAs: "/interactive_boxplot/lncRNA_countsnorm.csv",
  mRNAs: "/interactive_boxplot/mRNA_countsnorm.csv",
};
const METADATA_FILE = "/interactive_boxplot/Metadata.csv";

type ParsedCSV = { header: string[]; rows: string[][] };

function parseCSV(text: string): ParsedCSV {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = lines.slice(1).map((l) => l.split(",").map((s) => s.trim()));
  return { header, rows };
}

export default function BoxPlot({
  rnaClass,
  title = "Boxplot",
  defaultGene,
}: {
  rnaClass: RNACategory;
  title?: string;
  defaultGene?: string;
}) {
  const [allGenes, setAllGenes] = React.useState<string[]>([]);
  const [gene, setGene] = React.useState<string>(defaultGene ?? "");
  const [byTime, setByTime] = React.useState<Record<TimeKey, number[]>>({
    Baseline: [],
    "15": [],
    "30": [],
    "60": [],
  });
  const [error, setError] = React.useState<string>("");

  // טוען CSV + Metadata ומכין את ה-y לכל timepoint
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setByTime({ Baseline: [], "15": [], "30": [], "60": [] });

      try {
        const [countsText, metaText] = await Promise.all([
          fetch(COUNTS_FILE[rnaClass]).then((r) => {
            if (!r.ok) throw new Error("counts CSV not found");
            return r.text();
          }),
          fetch(METADATA_FILE).then((r) => {
            if (!r.ok) throw new Error("metadata CSV not found");
            return r.text();
          }),
        ]);

        const counts = parseCSV(countsText);
        const meta = parseCSV(metaText);

        // header: [Gene/Sample?, Sample1, Sample2, ...]
        const sampleNames = counts.header.slice(1);
        const geneNames = counts.rows.map((r) => r[0]);
        const geneIndex = gene
          ? counts.rows.findIndex((r) => r[0] === gene)
          : 0;

        const pickedGene = geneIndex >= 0 ? counts.rows[geneIndex][0] : geneNames[0];
        const valuesRow = geneIndex >= 0 ? counts.rows[geneIndex] : counts.rows[0];

        // Metadata: מחפשים עמודות שמזהות sample ו–timepoint
        const metaSampleIdx =
          meta.header.findIndex((h) => /sample/i.test(h)) ?? 0;
        const metaTimeIdx =
          meta.header.findIndex((h) => /(time|timepoint|min)/i.test(h)) ?? 1;

        const sample2time: Record<string, TimeKey> = {};
        meta.rows.forEach((r) => {
          const s = r[metaSampleIdx];
          const t = r[metaTimeIdx];
          let tk: TimeKey = "Baseline";
          if (/^15/.test(t)) tk = "15";
          else if (/^30/.test(t)) tk = "30";
          else if (/^60/.test(t)) tk = "60";
          else if (/base/i.test(t)) tk = "Baseline";
          sample2time[s] = tk;
        });

        // מפזרים ערכים לפי timepoint
        const grouped: Record<TimeKey, number[]> = {
          Baseline: [],
          "15": [],
          "30": [],
          "60": [],
        };

        sampleNames.forEach((sample, i) => {
          const time = sample2time[sample] ?? "Baseline";
          const v = Number(valuesRow[i + 1] ?? ""); // +1 כי col0 הוא שם הגן
          if (!Number.isNaN(v)) grouped[time].push(v);
        });

        if (!cancelled) {
          setAllGenes(geneNames);
          setGene(pickedGene);
          setByTime(grouped);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(
            "Could not load CSVs. Expecting files in public/interactive_boxplot/*.csv"
          );
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // נריץ בכל פעם שמשתנים class/gene
  }, [rnaClass, gene]);

  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const means = [
    mean(byTime.Baseline),
    mean(byTime["15"]),
    mean(byTime["30"]),
    mean(byTime["60"]),
  ];

  return (
    <section className="w-full mt-10">
      <h3 className="text-center text-2xl font-extrabold mb-4">{title}</h3>

      {/* בוחר גן */}
      <div className="mb-3 flex items-center gap-3 justify-center">
        <span className="font-medium">{rnaClass} name:</span>
        <select
          className="min-w-[240px] rounded bg-[#2C5F7C] px-3 py-2 text-white"
          value={gene}
          onChange={(e) => setGene(e.target.value)}
        >
          {allGenes.slice(0, 5000).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="text-red-500 text-sm">droplist</span>
      </div>

      {error ? (
        <div className="text-center text-sm text-red-600">{error}</div>
      ) : (
        <div className="rounded-md border-2 border-[#2C5F7C] bg-[#2C5F7C] p-3">
          <div style={{ height: 360 }}>
            <Plot
              data={[
                // קופסאות לכל timepoint
                {
                  type: "box",
                  name: "0 min",
                  y: byTime.Baseline,
                  boxpoints: "all",
                  jitter: 0.2,
                  pointpos: -1.8,
                  marker: { size: 6 },
                  line: { width: 2 },
                } as any,
                {
                  type: "box",
                  name: "15 min",
                  y: byTime["15"],
                  boxpoints: "all",
                  jitter: 0.2,
                  pointpos: -1.8,
                  marker: { size: 6 },
                  line: { width: 2 },
                } as any,
                {
                  type: "box",
                  name: "30 min",
                  y: byTime["30"],
                  boxpoints: "all",
                  jitter: 0.2,
                  pointpos: -1.8,
                  marker: { size: 6 },
                  line: { width: 2 },
                } as any,
                {
                  type: "box",
                  name: "60 min",
                  y: byTime["60"],
                  boxpoints: "all",
                  jitter: 0.2,
                  pointpos: -1.8,
                  marker: { size: 6 },
                  line: { width: 2 },
                } as any,
                // קו ממוצעים בין הקופסאות
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: ["0 min", "15 min", "30 min", "60 min"],
                  y: means,
                  line: { width: 2 },
                  marker: { size: 6 },
                  name: "mean",
                },
              ]}
              layout={{
                margin: { l: 40, r: 12, t: 10, b: 48 },
                paper_bgcolor: "#2C5F7C",
                plot_bgcolor: "#2C5F7C",
                font: { color: "white" },
                xaxis: { title: "timepoint" },
                yaxis: { title: "DESeq2 normalized count", rangemode: "tozero" },
                showlegend: false,
                autosize: true,
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-white/80">
            x-axis: timepoint, y-axis: DESeq2 normalized count
          </p>
        </div>
      )}
    </section>
  );
}
