"use client";

import React from "react";
import VolcanoGrid from "./VolcanoGrid";
import BoxPlot from "./BoxPlot";

type RNACategory = "tRFs" | "miRs" | "lncRNAs" | "mRNAs";

export default function TamaraMultiPage() {
  const [active, setActive] = React.useState<RNACategory>("tRFs");

  const NavButton = ({
    label,
    isActive,
    onClick,
  }: {
    label: RNACategory;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={
        "rounded-md px-4 py-2 text-sm font-medium border-[3px] " +
        (isActive
          ? "bg-[#2C5F7C] text-white border-[#2C5F7C]"
          : "bg-[#A8C5D6] text-black border-red-300")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* שורה עליונה – שם האתר + baseline */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Tamara Visualization</span>
        <span>Baseline · 15 · 30 · 60 min</span>
      </div>

      <hr className="border-neutral-300" />

      {/* ניווט 4 הכפתורים */}
      <div className="flex gap-3">
        {(["tRFs", "miRs", "lncRNAs", "mRNAs"] as RNACategory[]).map((k) => (
          <NavButton
            key={k}
            label={k}
            isActive={active === k}
            onClick={() => setActive(k)}
          />
        ))}
      </div>

      {/* חשוב: בלי כותרות כאן – הכותרות בתוך הקומפוננטות עצמן */}
      <section className="mt-4">
        <VolcanoGrid rnaClass={active} />
      </section>

      <section className="mt-10">
        <BoxPlot rnaClass={active} />
      </section>
    </div>
  );
}
