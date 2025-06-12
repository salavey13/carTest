"use client";

import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo for later
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // For error display

logger.debug("[ArbitrageVoxelPlot.tsx] ULTRA-MINIMAL R3F Import Test. File loaded.");

interface R3FLibs {
  Canvas?: React.ElementType;
  Box?: React.ElementType; // For a simple test
  OrbitControls?: React.ElementType;
  THREE_VERSION?: string; // To confirm three.js itself loads
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info(`[ArbitrageVoxelPlot ULTRA-MINIMAL] Component FUNCTION CALLED. Ops: ${opportunities.length}`);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Indicates component is now on the client
    logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] useEffect: Component mounted. Attempting controlled dynamic imports...");

    const loadLibs = async () => {
      if (typeof window === 'undefined') {
        logger.warn("[ArbitrageVoxelPlot ULTRA-MINIMAL] Window undefined in loadLibs. Aborting.");
        return;
      }
      
      let threeVersion: string | undefined = undefined;
      let R3F_Canvas: React.ElementType | undefined = undefined;
      let Drei_Box: React.ElementType | undefined = undefined; // For a simple Drei test later
      let Drei_OrbitControls: React.ElementType | undefined = undefined;

      try {
        logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] Stage 1: Importing 'three'...");
        const THREE_MOD = await import('three');
        threeVersion = THREE_MOD.REVISION;
        logger.debug(`[ArbitrageVoxelPlot ULTRA-MINIMAL] 'three' IMPORTED. Version: ${threeVersion}`);
        
        logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] Stage 2: Importing '@react-three/fiber'...");
        const R3F_MOD = await import('@react-three/fiber');
        R3F_Canvas = R3F_MOD.Canvas;
        logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] '@react-three/fiber' IMPORTED. Canvas available:", !!R3F_Canvas);

        // Only try to import Drei if R3F loaded
        if (R3F_Canvas) {
            logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] Stage 3: Importing '@react-three/drei'...");
            const DREI_MOD = await import('@react-three/drei');
            Drei_Box = DREI_MOD.Box;
            Drei_OrbitControls = DREI_MOD.OrbitControls;
            logger.debug("[ArbitrageVoxelPlot ULTRA-MINIMAL] '@react-three/drei' IMPORTED. Box:", !!Drei_Box, "OrbitControls:", !!Drei_OrbitControls);
        }
        
        setLibs({
          THREE_VERSION: threeVersion,
          Canvas: R3F_Canvas,
          Box: Drei_Box,
          OrbitControls: Drei_OrbitControls
        });
        logger.info("[ArbitrageVoxelPlot ULTRA-MINIMAL] All attempted libs processed and stored in state.");

      } catch (err: any) {
        logger.error("[ArbitrageVoxelPlot ULTRA-MINIMAL] FAILED during ASYNC import stage:", err);
        setLibs({ error: err, errorMessage: err.message, errorStack: err.stack, THREE_VERSION: threeVersion, Canvas: R3F_Canvas }); // Store partial success if any
      }
    };
    
    loadLibs();
    
  }, []); // Run once on mount

  // EERR calculations and axis scaling - Keep this logic as it doesn't depend on R3F
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
    return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount...</div>;
  }

  if (!libs) {
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Dynamically loading 3D libraries...</div>;
  }

  if (libs.error) {
    // This is what your screenshot shows!
    return (
      <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]">
        <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries (R3F Isolation Test):</p>
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
  
  const { Canvas, Box, OrbitControls } = libs;

  if (!Canvas || !Box || !OrbitControls) { // Check if essential components are loaded
      return <div className="p-4 text-red-600 min-h-[600px] flex items-center justify-center">Plot: Essential R3F/Drei components (Canvas, Box, OrbitControls) failed to load from bundle!</div>;
  }

  logger.info("[ArbitrageVoxelPlot ULTRA-MINIMAL] Libs loaded. Rendering BASIC Canvas with one Box.");
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(20, 5, 40, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-green/60 shadow-lg shadow-brand-green/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [1.5, 1.5, 3], fov: 50 }}> {/* Simplified camera */}
        <ambientLight intensity={1.0} />
        <pointLight position={[5,5,5]} intensity={0.8}/>
        <Box args={[1, 1, 1]} position={[0,0,0]}>
          <meshStandardMaterial color="royalblue" />
        </Box>
        <OrbitControls makeDefault />
         <Text position={[0, 1, 0]} fontSize={0.2} color="white">VIBE Cube!</Text>
      </Canvas>
       <div className="absolute top-2 left-2 text-xs text-lime-400 bg-black/50 p-1 rounded">
            ULTRA-MINIMAL R3F TEST: Canvas Rendered! THREE: {libs.THREE_VERSION}
       </div>
    </div>
  );
};

export { ArbitrageVoxelPlot as default };