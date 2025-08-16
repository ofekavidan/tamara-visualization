"use client";

import * as React from "react";
import dynamic from "next/dynamic";

// ↓ מונעים בעיות טיפוס של react-plotly.js
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as React.FC<any>;

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";
type Timepoint = "15" | "30" | "60";

const CARD_HEIGHT = 260; // גובה אחיד לכל כרטיס – שומר על Layout יציב

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function makeVolcanoPoints(seedBase: number, n = 180) {
  const xs: number[] = [];
  const ys: number[] = [];
  const colors: string[] = [];
  for (let i = 0; i < n; i++) {
    const r1 = seededRandom(seedBase + i);
    const r2 = seededRandom(seedBase + 1000 + i);
    const x = (r1 - 0.5) * 5.5;           // log2FC סביב 0
    const y = Math.abs((r2 - 0.2) * 6.5); // -log10(p)
    xs.push(x);
    ys.push(y);
    // significance צבעים: אדום ↑, ירוק ↓, שחור NS
    if (y > 4.0 && x > 0.8) colors.push("crimson");
    else if (y > 3.2 && x < -0.8) colors.push("seagreen");
    else colors.push("#222222");
  }
  return { xs, ys, colors };
}

function VolcanoCard({
  title,
  seed,
}: {
  title: string;
  seed: number;
}) {
  const { xs, ys, colors } = React.useMemo(() => makeVolcanoPoints(seed, 220), [seed]);

  return (
    <div className="rounded-md border-2 border-[#2C5F7C] bg-white p-2">
      <div className="w-full" style={{ height: CARD_HEIGHT }}>
        <Plot
          data={[
            {
              type: "scattergl",
              mode: "markers",
              x: xs,
              y: ys,
              marker: { size: 6, color: colors, opacity: 0.9 },
              hovertemplate: "log2FC=%{x:.2f}<br>-log10(p)=%{y:.2f}<extra></extra>",
            },
            // קווי סף ורטיקלי/הוריזונטלי
            {
              type: "scatter",
              mode: "lines",
              x: [-0.8, -0.8],
              y: [0, 7],
              line: { width: 1, dash: "dot", color: "#777" },
              hoverinfo: "skip",
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines",
              x: [0.8, 0.8],
              y: [0, 7],
              line: { width: 1, dash: "dot", color: "#777" },
              hoverinfo: "skip",
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines",
              x: [-3, 3],
              y: [3, 3],
              line: { width: 1, dash: "dot", color: "#777" },
              hoverinfo: "skip",
              showlegend: false,
            },
          ]}
          layout={{
            margin: { l: 36, r: 10, t: 4, b: 36 },
            xaxis: { title: "log2(Fold Change)", zeroline: false, range: [-3, 3] },
            yaxis: { title: "-log10(p-value)", range: [0, 7], rangemode: "tozero" },
            autosize: true,
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="mt-1 text-center text-sm font-semibold">{title}</div>
    </div>
  );
}

export default function VolcanoGrid({
  rnaClass,
}: {
  rnaClass: RNACategory;
}) {
  // seed ייחודי לכל לשונית כדי לשמור על “יציבות” בין רינדורים
  const baseSeed: number = React.useMemo(() => {
    if (rnaClass === "tRFs") return 11;
    if (rnaClass === "miRs") return 22;
    if (rnaClass === "lncRNAs") return 33;
    return 44; // mRNAs
  }, [rnaClass]);

  return (
    <section className="w-full">
      <h2 className="text-center text-3xl font-extrabold mb-6">Volcano plots</h2>

      <div className="grid gap-5 md:grid-cols-3">
        <VolcanoCard title="15 min" seed={baseSeed + 15} />
        <VolcanoCard title="30 min" seed={baseSeed + 30} />
        <VolcanoCard title="60 min" seed={baseSeed + 60} />
      </div>

      <p className="mt-2 text-center text-xs text-neutral-600">
        x-axis: log2(Fold Change), y-axis: -log10(p-value)
      </p>
    </section>
  );
}
