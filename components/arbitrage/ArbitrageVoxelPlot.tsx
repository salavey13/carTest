"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types'; // For casting

logger.debug("[ArbitrageVoxelPlot.tsx] FULL VERSION LOADED. Attempting R3F/Three imports via dynamic pattern in parent.");

interface R3FLibs {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  OrbitControls: typeof import('@react-three/drei').OrbitControls;
  Box: typeof import('@react-three/drei').Box;
  Text: typeof import('@react-three/drei').Text;
  Html: typeof import('@react-three/drei').Html;
  Line: typeof import('@react-three/drei').Line;
  Grid: typeof import('@react-three/drei').Grid;
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal || isNaN(value) || isNaN(minVal) || isNaN(maxVal)) return offset + scaleFactor / 2; // Guard against NaN/division by zero
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

interface VoxelProps { // Omit<R3FLibs['ThreeElements']['mesh'], 'args'> was too complex, direct props better
  position?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  dreiBoxComponent: R3FLibs['DreiBox']; // Pass Box component
}

const Voxel: React.FC<VoxelProps> = ({ opportunity, onHover, dreiBoxComponent: DreiBox, ...restBoxProps }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [voxelHovered, setVoxelHover] = useState(false);
  const safeSize = Math.max(0.05, opportunity.sizeValue); // Ensure minimum size

  const handlePointerOver = (event: any) => { event.stopPropagation(); setVoxelHover(true); onHover(opportunity); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); };
  const handlePointerOut = (event: any) => { event.stopPropagation(); setVoxelHover(false); onHover(null); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); };
  const handleClick = (event: any) => { event.stopPropagation(); onHover(opportunity); logger.debug("[Voxel] Clicked:", opportunity.id); };

  return (
    <DreiBox
      {...restBoxProps}
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial 
        color={opportunity.colorValue} 
        emissive={voxelHovered ? 'darkorange' : 'black'} 
        emissiveIntensity={voxelHovered ? 0.7 : 0} 
        roughness={0.4} metalness={0.1} 
        transparent opacity={voxelHovered ? 1 : 0.8}
      />
    </DreiBox>
  );
};

interface SceneContentProps {
  processedOpportunities: ProcessedSandboxOpportunity[];
  setHoveredOpportunity: (op: ProcessedSandboxOpportunity | null) => void;
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  r3fLibs: R3FLibs; // Pass the loaded libraries
  isPlotActive: boolean; // To control OrbitControls
}

const SceneContent: React.FC<SceneContentProps> = ({
  processedOpportunities, setHoveredOpportunity, minX, maxX, minY, maxY, minZ, maxZ, r3fLibs, isPlotActive
}) => {
  logger.debug(`[SceneContent] Rendering. Opportunities: ${processedOpportunities.length}, PlotActive: ${isPlotActive}`);
  const { scene } = r3fLibs.useThree();

  useEffect(() => { scene.background = new r3fLibs.THREE.Color(0x0A0F1A); /* Dark blueish */}, [scene, r3fLibs.THREE]);

  return (
    <>
      <ambientLight intensity={0.8} /> 
      <directionalLight position={[10, 15, 12]} intensity={1.3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-far={50} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />
      <r3fLibs.DreiOrbitControls makeDefault enablePan={isPlotActive} enableZoom={isPlotActive} enableRotate={isPlotActive} minDistance={3} maxDistance={35} target={[0,0,0]} />
      
      {/* Axes using DreiLine for better control */}
      <r3fLibs.DreiLine points={[[-5, -5, -5], [6, -5, -5]]} color="red" lineWidth={1.5} position={[0,0,0]} />
      <r3fLibs.DreiText position={[6.5, -5, -5]} fontSize={0.2} color="#FF7777" anchorX="left">X: Reward</r3fLibs.DreiText>
      
      <r3fLibs.DreiLine points={[[-5, -5, -5], [-5, 6, -5]]} color="green" lineWidth={1.5} position={[0,0,0]} />
      <r3fLibs.DreiText position={[-5.3, 6, -5]} fontSize={0.2} color="#77FF77" anchorX="right">Y: Ezness</r3fLibs.DreiText>

      <r3fLibs.DreiLine points={[[-5, -5, -5], [-5, -5, 6]]} color="blue" lineWidth={1.5} position={[0,0,0]} />
      <r3fLibs.DreiText position={[-5, -5.3, 6]} fontSize={0.2} color="#7777FF" anchorX="center" anchorY="top">Z: 1/Effort</r3fLibs.DreiText>

      {processedOpportunities.map((pOp) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, 10, -5);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, 10, -5);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, 10, -5);
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue)) return null;
        return (<Voxel key={pOp.id} opportunity={pOp} onHover={setHoveredOpportunity} position={[posX, posY, posZ]} dreiBoxComponent={r3fLibs.DreiBox} castShadow />);
      })}
      <r3fLibs.DreiGrid args={[10, 10]} sectionColor={'#4A00E0'} cellColor={'#2A0060'} position={[0, -5.05, 0]} infiniteGrid={false} fadeDistance={50} sectionThickness={1.2} cellThickness={0.8} />
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[]; isTabActive: boolean; }> = ({ opportunities, isTabActive }) => {
  logger.info(`[ArbitrageVoxelPlot FULL] Func Call. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot FULL] useEffect: Component mounted. Attempting dynamic imports...");
    const loadLibs = async () => {
      if (typeof window === 'undefined') return;
      try {
        const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([ import('three'), import('@react-three/fiber'), import('@react-three/drei') ]);
        logger.info("[ArbitrageVoxelPlot FULL] All R3F/Three dynamic imports SUCCESSFUL.");
        setLibs({ THREE: THREE_MOD, Canvas: R3F_MOD.Canvas, useThree: R3F_MOD.useThree, OrbitControls: DREI_MOD.OrbitControls, Box: DREI_MOD.Box, Text: DREI_MOD.Text, Html: DREI_MOD.Html, Line: DREI_MOD.Line, Grid: DREI_MOD.Grid });
      } catch (err: any) { logger.error("[ArbitrageVoxelPlot FULL] FAILED during ASYNC import stage:", err); setLibs({ error: err, errorMessage: err.message, errorStack: err.stack });}
    };
    loadLibs();
  }, []); 

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => { /* ... same axis calculation ... */ if (opportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }; const xs = opportunities.map(p => p.x_reward); const ys = opportunities.map(p => p.y_ezness); const zs = opportunities.map(p => p.z_inv_effort); return { minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1), minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1), minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1) }; }, [opportunities]);

  if (!isMounted) return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount...</div>;
  if (loadError) return ( <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]"> <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries:</p> <p className="text-sm">Error: {loadError}</p> {/* ... more error details if needed ... */} </div> );
  if (!libs) return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Dynamically loading 3D libraries...</div>;
  
  const { Canvas, Html } = libs; // Destructure what's needed for the outer shell

  if (opportunities.length === 0 && isTabActive) { // Show this only if tab is active and no data
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  if (!isTabActive && opportunities.length === 0) { // If tab is not active and no data, render minimal
      return <div className="min-h-[600px] bg-gray-900/50 rounded-md flex items-center justify-center"><p className="text-gray-600 text-sm">Visualization Paused</p></div>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot FULL] Rendering Canvas. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.92)', borderRadius: '8px', position: 'relative', overflow: 'hidden', touchAction: isTabActive ? 'none' : 'auto' }} className="border border-brand-blue/60 shadow-xl shadow-brand-blue/25"> {/* touchAction based on active tab */}
      {isTabActive ? ( // Only render Canvas if tab is active to save resources and prevent event capture
        <Canvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows gl={{ antialias: true }}>
          <SceneContent 
            processedOpportunities={opportunities} 
            setHoveredOpportunity={setHoveredOpportunity}
            minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
            r3fLibs={libs}
            isPlotActive={isTabActive}
          />
        </Canvas>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800/10"><p className="text-gray-500 italic">Visualization paused (tab not active)</p></div>
      )}
      {isTabActive && hoveredOpportunity && ( <div className="voxel-tooltip-wrapper" style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100, background: 'rgba(15, 5, 35, 0.92)', color: '#E8E8E8', fontSize: '10px', padding: '7px 9px', borderRadius: '5px', boxShadow: '0 1px 5px rgba(0,0,0,0.6)', maxWidth: '210px', border: '1px solid hsla(var(--brand-purple), 0.8)', backdropFilter: 'blur(3px)' }} > <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1"> {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsAltH:: " /> : <VibeContentRenderer content="::FaShareAlt:: " />} {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span> </p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p> <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p> </div> )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };