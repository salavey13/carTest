"use client";

import React, { useState, useEffect, useMemo } from 'react'; // useMemo for axes later
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

logger.debug("[ArbitrageVoxelPlot.tsx] ULTRA-MINIMAL R3F Import Test (Text Alias Fix). File loaded.");

interface R3FLibs {
  THREE: typeof import('three'); // Keep THREE for version checking etc.
  Canvas: typeof import('@react-three/fiber').Canvas;
  // Specific components from drei, aliased if needed
  DreiBox: typeof import('@react-three/drei').Box;
  DreiText: typeof import('@react-three/drei').Text; // <<< ALIAS
  DreiOrbitControls: typeof import('@react-three/drei').OrbitControls;
  DreiLine: typeof import('@react-three/drei').Line;
  DreiGrid: typeof import('@react-three/drei').Grid;
  // ThreeElements from fiber for prop typing if we bring back complex Voxel
  // ThreeElements: typeof import('@react-three/fiber').ThreeElements; 
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info(`[ArbitrageVoxelPlot ALIASED] Component FUNCTION CALLED. Ops: ${opportunities.length}`);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot ALIASED] useEffect: Component mounted. Attempting controlled dynamic imports...");

    const loadLibs = async () => {
      if (typeof window === 'undefined') {
        logger.warn("[ArbitrageVoxelPlot ALIASED] Window undefined in loadLibs. Aborting.");
        return;
      }
      
      try {
        logger.debug("[ArbitrageVoxelPlot ALIASED] Stage 1: Importing 'three'...");
        const THREE_MOD = await import('three');
        logger.debug(`[ArbitrageVoxelPlot ALIASED] 'three' IMPORTED. Version: ${THREE_MOD.REVISION}`);
        
        logger.debug("[ArbitrageVoxelPlot ALIASED] Stage 2: Importing '@react-three/fiber'...");
        const R3F_MOD = await import('@react-three/fiber');
        logger.debug("[ArbitrageVoxelPlot ALIASED] '@react-three/fiber' IMPORTED. Canvas available:", !!R3F_MOD.Canvas);

        logger.debug("[ArbitrageVoxelPlot ALIASED] Stage 3: Importing '@react-three/drei'...");
        const DREI_MOD = await import('@react-three/drei');
        logger.debug("[ArbitrageVoxelPlot ALIASED] '@react-three/drei' IMPORTED. Box:", !!DREI_MOD.Box, "Text:", !!DREI_MOD.Text, "OrbitControls:", !!DREI_MOD.OrbitControls);
        
        setLibs({
          THREE: THREE_MOD,
          Canvas: R3F_MOD.Canvas,
          DreiBox: DREI_MOD.Box,
          DreiText: DREI_MOD.Text, // <<< STORE ALIASED
          DreiOrbitControls: DREI_MOD.OrbitControls,
          DreiLine: DREI_MOD.Line,
          DreiGrid: DREI_MOD.Grid,
        });
        logger.info("[ArbitrageVoxelPlot ALIASED] All attempted libs processed and stored in state.");

      } catch (err: any) { 
        logger.error("[ArbitrageVoxelPlot ALIASED] FAILED during ASYNC import stage:", err);
        // Store partial success if any to see which import failed
        setLibs({ 
            THREE: (globalThis as any).THREE, // If THREE loaded before error
            Canvas: (globalThis as any).R3F?.Canvas, // If R3F loaded before error
            error: err, 
            errorMessage: err.message, 
            errorStack: err.stack 
        });
      }
    };
    
    loadLibs();
    
  }, []); 

  // EERR calculations and axis scaling (Keep this logic for when we restore the full plot)
   const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    if (opportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const xs = opportunities.map(p => p.x_reward); const ys = opportunities.map(p => p.y_ezness); const zs = opportunities.map(p => p.z_inv_effort);
    return {
      minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1),
      minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1),
      minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1)
    };
  }, [opportunities]);


  if (!isMounted) {
    return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount (Text Alias Test)...</div>;
  }

  if (!libs) {
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Dynamically loading 3D libraries (Text Alias Test)...</div>;
  }

  if (libs.error) {
    return (
      <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]">
        <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries (Text Alias Test):</p>
        <p className="text-sm">Error Message: {libs.errorMessage}</p>
        <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-white">View Full Error & Stack</summary>
            <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded text-[0.6rem] max-h-60 overflow-auto simple-scrollbar">{String(libs.error)}</pre>
            <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded text-[0.6rem] max-h-60 overflow-auto simple-scrollbar">Stack: {libs.errorStack}</pre>
        </details>
        <p className="mt-3 text-xs text-yellow-400">THREE.js Version (if loaded): {libs.THREE_VERSION || "Not loaded"}</p>
        <p className="text-xs text-yellow-400">R3F Canvas (if loaded): {libs.Canvas ? "Module attempted" : "Not attempted or failed before"}</p>
      </div>
    );
  }
  
  const { Canvas, DreiBox, DreiText, DreiOrbitControls } = libs; // <<< USE ALIASED DreiText

  if (!Canvas || !DreiBox || !DreiOrbitControls || !DreiText) {
      logger.error("[ArbitrageVoxelPlot ALIASED] Essential R3F/Drei components (Canvas, Box, Text, OrbitControls) missing from loaded libs bundle!", libs);
      return <div className="p-4 text-red-600 min-h-[600px] flex items-center justify-center">Plot: Essential R3F/Drei components failed to load correctly!</div>;
  }

  logger.info("[ArbitrageVoxelPlot ALIASED] Libs loaded. Rendering BASIC Canvas with one Box and Aliased Text.");
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(20, 5, 40, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-green/60 shadow-lg shadow-brand-green/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [1.5, 1.5, 3], fov: 50 }}>
        <ambientLight intensity={1.0} />
        <pointLight position={[5,5,5]} intensity={0.8}/>
        <DreiBox args={[1, 1, 1]} position={[0,0,0]}>
          <meshStandardMaterial color="royalblue" />
        </DreiBox>
        <DreiOrbitControls makeDefault />
         {/* Use the aliased component */}
        <DreiText position={[0, 0.8, 0]} fontSize={0.3} color="white" anchorX="center">
          VIBE Cube! (Aliased Text)
        </DreiText>
      </Canvas>
       <div className="absolute top-2 left-2 text-xs text-lime-400 bg-black/50 p-1 rounded">
            ULTRA-MINIMAL R3F TEST (Text Alias): Canvas Rendered! THREE: {libs.THREE_VERSION}
       </div>
    </div>
  );
};

export { ArbitrageVoxelPlot as default };