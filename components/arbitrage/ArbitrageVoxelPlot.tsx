"use client";

import React, { useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page'; // Keep this for prop type

logger.debug("[ArbitrageVoxelPlot.tsx] MINIMAL VERSION LOADED. Top-level R3F/Three imports are AVOIDED.");

interface MinimalR3FLibs {
  THREE_VERSION?: string;
  Canvas?: React.ElementType; // Just check if we can get Canvas
  error?: any;
}

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info(`[ArbitrageVoxelPlot MINIMAL] Component FUNCTION CALLED. Ops: ${opportunities.length}`);
  const [libs, setLibs] = useState<MinimalR3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot MINIMAL] useEffect: Component mounted. Attempting MINIMAL dynamic import...");

    const loadMinimal = async () => {
      if (typeof window === 'undefined') {
        logger.warn("[ArbitrageVoxelPlot MINIMAL] Window undefined in loadMinimal. Aborting.");
        return;
      }
      try {
        logger.debug("[ArbitrageVoxelPlot MINIMAL] Importing 'three'...");
        const THREE_MOD = await import('three');
        logger.debug("[ArbitrageVoxelPlot MINIMAL] 'three' IMPORTED. Version:", THREE_MOD.REVISION);
        
        logger.debug("[ArbitrageVoxelPlot MINIMAL] Importing '@react-three/fiber'...");
        const R3F_MOD = await import('@react-three/fiber');
        logger.debug("[ArbitrageVoxelPlot MINIMAL] '@react-three/fiber' IMPORTED. Canvas available:", !!R3F_MOD.Canvas);
        
        // Optional: Try 'drei' if the above two work
        // logger.debug("[ArbitrageVoxelPlot MINIMAL] Importing '@react-three/drei'...");
        // const DREI_MOD = await import('@react-three/drei');
        // logger.debug("[ArbitrageVoxelPlot MINIMAL] '@react-three/drei' IMPORTED. Box available:", !!DREI_MOD.Box);

        setLibs({
          THREE_VERSION: THREE_MOD.REVISION,
          Canvas: R3F_MOD.Canvas,
          // Box: DREI_MOD.Box // if imported
        });
        logger.info("[ArbitrageVoxelPlot MINIMAL] Minimal R3F libs successfully stored in state.");

      } catch (err) {
        logger.error("[ArbitrageVoxelPlot MINIMAL] FAILED to ASYNC import R3F/Three components:", err);
        setLibs({ error: err });
      }
    };
    
    loadMinimal();
    
  }, []); // Run once on mount

  if (!isMounted) {
    return <div className="p-4 text-brand-orange">Plot: Waiting for mount...</div>;
  }

  if (!libs) {
    return <div className="p-4 text-brand-yellow animate-pulse">Plot: Loading 3D libraries (minimal test)...</div>;
  }

  if (libs.error) {
    return (
      <div className="p-4 text-red-400 bg-red-900/30 rounded-md">
        <p className="font-bold">Plot: Error loading 3D libraries (Minimal Test):</p>
        <pre className="text-xs whitespace-pre-wrap">{String(libs.error)}</pre>
        <p className="mt-2 text-xs">Stack: {libs.error?.stack}</p>
      </div>
    );
  }

  // If we reach here, the minimal imports worked.
  // We won't try to render a Canvas yet, just confirm imports.
  logger.info("[ArbitrageVoxelPlot MINIMAL] Minimal libs loaded. Rendering success message. Canvas available:", !!libs.Canvas);
  return (
    <div className="p-4 text-brand-lime bg-green-900/30 rounded-md min-h-[600px]">
      <h3 className="text-lg font-bold">Minimal 3D Libs Loaded! VIBE CHECK PASSED!</h3>
      <p>THREE.js version: {libs.THREE_VERSION}</p>
      <p>R3F Canvas component available: {libs.Canvas ? 'Yes' : 'No'}</p>
      {/* <p>Drei Box component available: {libs.Box ? 'Yes' : 'No'}</p> */}
      <p className="mt-4">Next step: If this works, gradually re-introduce Canvas and basic R3F scene elements.</p>
      <p className="mt-2 text-xs text-gray-400">Raw opportunities received: {opportunities.length}</p>
    </div>
  );
};

export { ArbitrageVoxelPlot as default };