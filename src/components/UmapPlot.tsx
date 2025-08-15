// src/components/UmapPlot.tsx

import React from "react";
import Image from "next/image";

interface UmapPlotProps {
  miRNAKey: string;
}

const UmapPlot: React.FC<UmapPlotProps> = ({ miRNAKey }) => {
  if (!miRNAKey) return null;

  const imagePath = `/interactive_umap/${miRNAKey}.png`;

  return (
    <div className="rounded-2xl shadow-md bg-white dark:bg-gray-900 p-4">
      <h2 className="text-xl font-semibold mb-2 text-center">UMAP Plot</h2>
      <div className="flex justify-center">
        <Image
          src={imagePath}
          alt={`UMAP plot for ${miRNAKey}`}
          width={600}
          height={400}
          className="rounded-lg"
        />
      </div>
    </div>
  );
};

export default UmapPlot;
