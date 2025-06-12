"use client";

import React, { useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';

logger.debug("[ArbitrageVoxelPlot.tsx] R3F ISOLATION TEST. Top-level R3F/Three imports are AVOIDED.");

interface MinimalR3FLibs {
  THREE_VERSION?: string;
  Canvas?: React.ElementType;
  error?: any;
  errorMessage?: string; // For more detailed error messages
  errorStack?: string;
}

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info(`[ArbitrageVoxelPlot R3F-ISO] Component FUNCTION CALLED. Ops: ${opportunities.length}`);
  const [libs, setLibs] = useState<MinimalR3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot R3F-ISO] useEffect: Component mounted. Attempting R3F ISOLATION dynamic import...");

    const loadMinimalR3F = async () => {
      if (typeof window === 'undefined') {
        logger.warn("[ArbitrageVoxelPlot R3F-ISO] Window undefined in loadMinimalR3F. Aborting.");
        return;
      }
      try {
        logger.debug("[ArbitrageVoxelPlot R3F-ISO] Importing 'three'...");
        const THREE_MOD = await import('three');
        logger.debug("[ArbitrageVoxelPlot R3F-ISO] 'three' IMPORTED. Version:", THREE_MOD.REVISION);
        
        logger.debug("[ArbitrageVoxelPlot R3F-ISO] Importing '@react-three/fiber' ONLY...");
        const R3F_MOD = await import('@react-three/fiber');
        logger.debug("[ArbitrageVoxelPlot R3F-ISO] '@react-three/fiber' IMPORTED. Canvas available:", !!R3F_MOD.Canvas);
        
        setLibs({
          THREE_VERSION: THREE_MOD.REVISION,
          Canvas: R3F_MOD.Canvas,
        });
        logger.info("[ArbitrageVoxelPlot R3F-ISO] Minimal 'three' and 'R3F' libs successfully stored in state.");

      } catch (err: any) { // Catch as any to access message and stack
        logger.error("[ArbitrageVoxelPlot R3F-ISO] FAILED to ASYNC import R3F/Three components:", err);
        setLibs({ error: err, errorMessage: err.message, errorStack: err.stack });
      }
    };
    
    loadMinimalR3F();
    
  }, []); 

  if (!isMounted) {
    return <div className="p-4 text-brand-orange">Plot: Waiting for mount (R3F Isolation Test)...</div>;
  }

  if (!libs) {
    return <div className="p-4 text-brand-yellow animate-pulse">Plot: Loading 3D libraries (R3F Isolation Test)...</div>;
  }

  if (libs.error) {
    return (
      <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]">
        <p className="font-bold">Plot: Error loading 3D libraries (R3F Isolation Test):</p>
        <p className="text-xs mt-1">Error Message: {libs.errorMessage}</p>
        <details className="mt-2 text-xs">
            <summary className="cursor-pointer">View Full Error & Stack</summary>
            <pre className="whitespace-pre-wrap mt-1 bg-black/20 p-1 rounded text-[0.6rem]">{String(libs.error)}</pre>
            <pre className="whitespace-pre-wrap mt-1 bg-black/20 p-1 rounded text-[0.6rem]">Stack: {libs.errorStack}</pre>
        </details>
      </div>
    );
  }
  
  const { Canvas } = libs; // Only Canvas from R3F

  if (!Canvas) {
      return <div className="p-4 text-red-500">Plot: R3F Canvas component not available even after successful import!</div>;
  }

  logger.info("[ArbitrageVoxelPlot R3F-ISO] 'three' & 'R3F' libs loaded. Attempting to render basic Canvas.");
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/60 shadow-lg shadow-brand-blue/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
        {/* <OrbitControls makeDefault />  // Keep Drei out for now */}
      </Canvas>
       <div className="absolute top-2 left-2 text-xs text-lime-400 bg-black/50 p-1 rounded">
            R3F ISOLATION TEST: Canvas Rendered! THREE: {libs.THREE_VERSION}
       </div>
    </div>
  );
};

export { ArbitrageVoxelPlot as default };