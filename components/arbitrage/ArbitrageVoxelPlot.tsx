"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
// NO R3F/THREE IMPORTS AT TOP LEVEL!
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';

logger.debug("[ArbitrageVoxelPlot.tsx] File loaded by browser. Top-level R3F/Three imports are AVOIDED.");

// --- Types for dynamically loaded R3F components ---
interface R3FBundle {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  OrbitControls: typeof import('@react-three/drei').OrbitControls;
  Box: typeof import('@react-three/drei').Box;
  Text: typeof import('@react-three/drei').Text;
  Html: typeof import('@react-three/drei').Html;
  // Add other components from R3F/Drei as needed
  Line: typeof import('@react-three/drei').Line; // For axes
  Grid: typeof import('@react-three/drei').Grid; // For gridHelper
  // Potentially more specific types for props if needed, e.g. ThreeElements
  ThreeElements: typeof import('@react-three/fiber').ThreeElements;
  error?: any; // To store import errors
}


const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal) return offset + scaleFactor / 2;
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

// Voxel and SceneContent will now need R3FBundle to be passed or accessed from context/state
// For simplicity, let's define them inline or pass R3FBundle

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info(`[ArbitrageVoxelPlot] Component FUNCTION CALLED. Opportunities count: ${opportunities.length}`);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [r3f, setR3f] = useState<R3FBundle | null>(null); // State to hold dynamically loaded R3F components
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Component has mounted on client
    logger.debug("[ArbitrageVoxelPlot] useEffect: Component mounted, isMounted=true. Attempting to load R3F/Three...");
    
    const loadR3FLibs = async () => {
      try {
        // Check for window to be absolutely sure
        if (typeof window === 'undefined') {
          logger.warn("[ArbitrageVoxelPlot loadR3FLibs] Window is undefined, skipping R3F load (should not happen if isMounted is true).");
          return;
        }
        logger.debug("[ArbitrageVoxelPlot loadR3FLibs] Window object confirmed. Starting dynamic imports.");

        const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([
          import('three'),
          import('@react-three/fiber'),
          import('@react-three/drei')
        ]);
        
        logger.info("[ArbitrageVoxelPlot loadR3FLibs] R3F/Three dynamic imports SUCCESSFUL.");
        setR3f({
          THREE: THREE_MOD,
          Canvas: R3F_MOD.Canvas,
          useThree: R3F_MOD.useThree,
          OrbitControls: DREI_MOD.OrbitControls,
          Box: DREI_MOD.Box,
          Text: DREI_MOD.Text,
          Html: DREI_MOD.Html,
          Line: DREI_MOD.Line,
          Grid: DREI_MOD.Grid,
          ThreeElements: R3F_MOD.ThreeElements,
        });
      } catch (err) {
        logger.error("[ArbitrageVoxelPlot loadR3FLibs] FAILED to ASYNC import R3F/Three components:", err);
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    };

    loadR3FLibs();

    return () => {
      logger.debug("[ArbitrageVoxelPlot] useEffect: Unmounting.");
    }
  }, []); // Run once on mount

  // --- EERR calculations and axis scaling (moved from inner components) ---
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
    logger.debug("[ArbitrageVoxelPlot] Render: isMounted is false, rendering initial load placeholder.");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-cyan animate-pulse">Initializing 3D Plot Container...</p></div>;
  }

  if (loadError) {
    logger.error("[ArbitrageVoxelPlot] Render: loadError is present, rendering error message:", loadError);
    return <div className="min-h-[600px] flex flex-col items-center justify-center bg-red-900/30 rounded-md p-4 text-red-400"><p className="font-bold">Error loading 3D libraries:</p><pre className="text-xs whitespace-pre-wrap">{loadError}</pre><p className="mt-2 text-xs">The 'S' error likely occurred here during library import.</p></div>;
  }

  if (!r3f) {
    logger.debug("[ArbitrageVoxelPlot] Render: R3F bundle not loaded yet, rendering 'Loading 3D Libraries...'");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-orange animate-pulse">Loading 3D Libraries...</p></div>;
  }

  // If we reach here, R3F libs are loaded
  const { Canvas, Box, OrbitControls, Text, Html, Line, Grid, ThreeElements } = r3f;

  // --- Inline Voxel Component ---
  interface DynamicVoxelProps extends Omit<InstanceType<typeof ThreeElements>['mesh'], 'args'> {
    opportunity: ProcessedSandboxOpportunity;
    onHover: (op: ProcessedSandboxOpportunity | null) => void;
  }
  const DynamicVoxel: React.FC<DynamicVoxelProps> = ({ opportunity, onHover, ...restBoxProps }) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const [voxelHovered, setVoxelHover] = useState(false);
    const safeSize = Math.max(0.01, opportunity.sizeValue);

    return (
      <Box
        {...restBoxProps}
        ref={meshRef}
        args={[safeSize, safeSize, safeSize]}
        onClick={(e: any) => { e.stopPropagation(); onHover(opportunity); logger.debug("Voxel Clicked (Dynamic):", opportunity); }}
        onPointerOver={(e: any) => { e.stopPropagation(); setVoxelHover(true); onHover(opportunity); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); }}
        onPointerOut={(e: any) => { e.stopPropagation(); setVoxelHover(false); onHover(null); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); }}
        castShadow receiveShadow
      >
        <meshStandardMaterial color={opportunity.colorValue} emissive={voxelHovered ? 'darkorange' : 'black'} emissiveIntensity={voxelHovered ? 0.6 : 0} roughness={0.5} metalness={0.3} transparent opacity={voxelHovered ? 1 : 0.85} />
      </Box>
    );
  };

  // --- Inline SceneContent Component ---
  const DynamicSceneContent: React.FC<{ processedOpportunities: ProcessedSandboxOpportunity[] }> = ({ processedOpportunities }) => {
    logger.debug("[DynamicSceneContent] Rendering with dynamically loaded R3F. Opportunities:", processedOpportunities.length);
    return (
      <>
        <ambientLight intensity={0.7} /> 
        <directionalLight position={[15, 20, 15]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-far={60} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20}/>
        <pointLight position={[-15, -10, -15]} intensity={0.4} color="#6A0DAD" /> 
        <OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={true} minDistance={2} maxDistance={40} target={[0,0,0]} />
        
        <Line position={[-5, -5, -5]} points={[[0,0,0], [11,0,0]]} color="red" lineWidth={2} /> 
        <Text position={[6, -0.3, -5]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="top">X: Reward</Text>
        <Line position={[-5, -5, -5]} points={[[0,0,0], [0,11,0]]} color="green" lineWidth={2} /> 
        <Text position={[-5.3, 6, -5]} fontSize={0.25} color="#E0E0E0" anchorX="right" anchorY="middle">Y: Ezness</Text>
        <Line position={[-5, -5, -5]} points={[[0,0,0], [0,0,11]]} color="blue" lineWidth={2} /> 
        <Text position={[-5, -5.3, 6]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="bottom">Z: 1/Effort</Text>

        {processedOpportunities.map((pOp) => {
          const posX = normalizeAndScale(pOp.x_reward, minX, maxX, 10, -5);
          const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, 10, -5);
          const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, 10, -5);
          if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue)) return null;
          return (<DynamicVoxel key={pOp.id} opportunity={pOp} onHover={setHoveredOpportunity} position={[posX, posY, posZ]} />);
        })}
        <Grid args={[10, 10]} sectionColor={'#383838'} cellColor={'#202020'} position={[0, -5.05, 0]} infiniteGrid={false} fadeDistance={50} />
      </>
    );
  };

  if (opportunities.length === 0) {
    logger.debug("[ArbitrageVoxelPlot] No opportunities to display, rendering placeholder (client is ready, R3F loaded).");
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Client is ready, R3F libs loaded. Rendering Canvas with ${opportunities.length} opportunities.`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/60 shadow-lg shadow-brand-blue/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows>
        <DynamicSceneContent processedOpportunities={opportunities} />
      </Canvas>
      {hoveredOpportunity && ( <div className="voxel-tooltip-wrapper" style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100, background: 'rgba(15, 5, 35, 0.92)', color: '#E8E8E8', fontSize: '10px', padding: '7px 9px', borderRadius: '5px', boxShadow: '0 1px 5px rgba(0,0,0,0.6)', maxWidth: '210px', border: '1px solid hsla(var(--brand-purple), 0.8)', backdropFilter: 'blur(3px)' }} > <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1"> {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsAltH:: " /> : <VibeContentRenderer content="::FaShareAlt:: " />} {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span> </p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p> <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p> </div> )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };