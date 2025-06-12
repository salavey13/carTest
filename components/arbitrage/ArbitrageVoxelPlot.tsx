"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';

logger.debug("[ArbitrageVoxelPlot.tsx] FULL VERSION. File loaded.");

interface R3FLibs {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  // Aliased Drei components
  DreiOrbitControls: typeof import('@react-three/drei').OrbitControls;
  DreiBox: typeof import('@react-three/drei').Box;
  DreiText: typeof import('@react-three/drei').Text;
  DreiHtml: typeof import('@react-three/drei').Html;
  DreiLine: typeof import('@react-three/drei').Line;
  DreiGrid: typeof import('@react-three/drei').Grid; // Changed from GridHelper
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal || isNaN(value) || isNaN(minVal) || isNaN(maxVal)) return offset + scaleFactor / 2;
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

interface VoxelProps {
  position?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  DreiBox: R3FLibs['DreiBox']; // Pass Box component constructor
}

const Voxel: React.FC<VoxelProps> = ({ opportunity, onHover, DreiBox, ...restBoxProps }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [voxelHovered, setVoxelHover] = useState(false);
  const safeSize = Math.max(0.05, opportunity.sizeValue);

  if (!DreiBox) { // Guard against DreiBox being undefined
    logger.warn("[Voxel] DreiBox component is undefined, cannot render Voxel.");
    return null; 
  }

  const handlePointerOver = (event: any) => { event.stopPropagation(); setVoxelHover(true); onHover(opportunity); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); };
  const handlePointerOut = (event: any) => { event.stopPropagation(); setVoxelHover(false); onHover(null); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); };
  const handleClick = (event: any) => { event.stopPropagation(); onHover(opportunity); logger.debug("[Voxel] Clicked:", opportunity.id); };

  return (
    <DreiBox // Use the passed DreiBox component
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
        transparent opacity={voxelHovered ? 0.95 : 0.75} // Make them a bit more solid
      />
    </DreiBox>
  );
};

interface SceneContentProps {
  processedOpportunities: ProcessedSandboxOpportunity[];
  setHoveredOpportunity: (op: ProcessedSandboxOpportunity | null) => void;
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  r3fLibs: R3FLibs;
  isPlotActive: boolean;
}

const SceneContent: React.FC<SceneContentProps> = ({
  processedOpportunities, setHoveredOpportunity, minX, maxX, minY, maxY, minZ, maxZ, r3fLibs, isPlotActive
}) => {
  logger.debug(`[SceneContent] Rendering. Opportunities: ${processedOpportunities.length}, PlotActive: ${isPlotActive}`);
  const { scene } = r3fLibs.useThree(); // useThree must be called within Canvas context

  useEffect(() => { 
    scene.background = new r3fLibs.THREE.Color(0x0A0F1A); // Dark blueish for dark theme
    // For light theme, you might want a lighter background, controlled by CSS variable or prop
    // Example: scene.background = new r3fLibs.THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#ffffff');

    logger.debug("[SceneContent] useEffect: Scene background set.");
  }, [scene, r3fLibs.THREE]);

  if (!r3fLibs.DreiLine || !r3fLibs.DreiText || !r3fLibs.DreiOrbitControls || !r3fLibs.DreiGrid || !r3fLibs.DreiBox) {
      logger.error("[SceneContent] One or more Drei components missing from r3fLibs for scene rendering!", r3fLibs);
      return <group><r3fLibs.DreiText>Error: Essential 3D components missing.</r3fLibs.DreiText></group>; // Fallback within Canvas
  }

  return (
    <>
      <ambientLight intensity={0.8} /> 
      <directionalLight position={[10, 15, 12]} intensity={1.3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <r3fLibs.DreiOrbitControls makeDefault enabled={isPlotActive} enablePan={isPlotActive} enableZoom={isPlotActive} enableRotate={isPlotActive} minDistance={3} maxDistance={35} target={[0,0,0]} />
      
      <r3fLibs.DreiLine points={[[-5, -5, -5], [6, -5, -5]]} color="red" lineWidth={1.5} />
      <r3fLibs.DreiText position={[6.5, -5, -5]} fontSize={0.2} color="white" anchorX="left">X: Reward</r3fLibs.DreiText>
      
      <r3fLibs.DreiLine points={[[-5, -5, -5], [-5, 6, -5]]} color="lime" lineWidth={1.5} /> {/* Green -> Lime for better dark bg contrast */}
      <r3fLibs.DreiText position={[-5.3, 6, -5]} fontSize={0.2} color="white" anchorX="right">Y: Ezness</r3fLibs.DreiText>

      <r3fLibs.DreiLine points={[[-5, -5, -5], [-5, -5, 6]]} color="cyan" lineWidth={1.5} /> {/* Blue -> Cyan */}
      <r3fLibs.DreiText position={[-5, -5.3, 6]} fontSize={0.2} color="white" anchorX="center" anchorY="top">Z: 1/Effort</r3fLibs.DreiText>

      {processedOpportunities.map((pOp) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, 10, -5);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, 10, -5);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, 10, -5);
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue)) {
            logger.warn(`[SceneContent] NaN for ${pOp.id}, skipping voxel.`);
            return null;
        }
        return (<Voxel key={pOp.id} opportunity={pOp} onHover={setHoveredOpportunity} position={[posX, posY, posZ]} dreiBoxComponent={r3fLibs.DreiBox} castShadow />);
      })}
      <r3fLibs.DreiGrid args={[10, 10]} sectionColor={'#5A009D'} cellColor={'#2A0060'} position={[0, -5.05, 0]} infiniteGrid={false} fadeDistance={50} sectionThickness={1} cellThickness={0.5} />
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[]; isTabActive: boolean; }> = ({ opportunities, isTabActive }) => {
  logger.info(`[ArbitrageVoxelPlot] Rendering. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot] useEffect: Component mounted. Attempting dynamic imports...");
    const loadLibs = async () => { /* ... same import logic as previous, ensure debugLogger is used ... */ if (typeof window === 'undefined') return; try { const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([ import('three'), import('@react-three/fiber'), import('@react-three/drei') ]); logger.info("[ArbitrageVoxelPlot] All R3F/Three dynamic imports SUCCESSFUL."); setLibs({ THREE: THREE_MOD, Canvas: R3F_MOD.Canvas, useThree: R3F_MOD.useThree, DreiOrbitControls: DREI_MOD.OrbitControls, DreiBox: DREI_MOD.Box, DreiText: DREI_MOD.Text, DreiHtml: DREI_MOD.Html, DreiLine: DREI_MOD.Line, DreiGrid: DREI_MOD.Grid }); } catch (err: any) { logger.error("[ArbitrageVoxelPlot] FAILED during ASYNC import stage:", err); setLibs({ error: err, errorMessage: err.message, errorStack: err.stack });} };
    loadLibs();
  }, []); 

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => { /* ... same axis calculation ... */ if (opportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }; const xs = opportunities.map(p => p.x_reward); const ys = opportunities.map(p => p.y_ezness); const zs = opportunities.map(p => p.z_inv_effort); return { minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1), minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1), minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1) }; }, [opportunities]);

  if (!isMounted) return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount...</div>;
  if (loadError) return ( <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]"> <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries:</p> <p className="text-sm">Error: {loadError}</p> <details className="mt-2 text-xs"> <summary className="cursor-pointer text-gray-400 hover:text-white">View Full Error Stack</summary> <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded text-[0.6rem] max-h-60 overflow-auto simple-scrollbar">{libs?.errorStack || "No stack available."}</pre> </details></div> );
  if (!libs || !libs.Canvas || !libs.DreiBox || !libs.DreiOrbitControls || !libs.DreiText || !libs.DreiLine || !libs.DreiGrid || !libs.useThree || !libs.THREE) { // More thorough check
    logger.warn("[ArbitrageVoxelPlot] Libs or essential components not fully loaded yet.", libs);
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Loading 3D library components...</div>;
  }
  
  const { Canvas: R3FCanvas, DreiHtml } = libs; // Destructure Canvas with an alias

  if (opportunities.length === 0 && isTabActive) { 
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize. Adjust filters or run simulation.</p>;
  }
  if (!isTabActive && opportunities.length === 0) { 
      return <div className="min-h-[600px] bg-gray-900/50 rounded-md flex items-center justify-center"><p className="text-gray-600 text-sm">Visualization Paused</p></div>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Rendering Canvas. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'hsl(var(--card-background-rgb, 264 70% 11%))', /* Fallback to dark card */ borderRadius: '8px', position: 'relative', overflow: 'hidden', touchAction: isTabActive ? 'none' : 'auto' }} className="border border-brand-blue/60 shadow-xl shadow-brand-blue/25">
      {isTabActive && opportunities.length > 0 ? ( // Only render Canvas if tab is active AND there are opportunities
        <R3FCanvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows gl={{ antialias: true }}>
          <SceneContent 
            processedOpportunities={opportunities} 
            setHoveredOpportunity={setHoveredOpportunity}
            minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
            r3fLibs={libs}
            isPlotActive={isTabActive}
          />
        </R3FCanvas>
      ) : ( // Fallback if not active or no opportunities for plot
        <div className="w-full h-full flex items-center justify-center bg-gray-800/10">
            <p className="text-gray-500 italic">
                {isTabActive && opportunities.length === 0 ? "No data for current filters to visualize." : "Visualization paused."}
            </p>
        </div>
      )}
      {isTabActive && hoveredOpportunity && ( <div className="voxel-tooltip-wrapper" style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100, background: 'hsla(var(--card-rgb, 22 8 49) / 0.92)', color: 'hsl(var(--card-foreground, 0 0% 95%))', fontSize: '10px', padding: '7px 9px', borderRadius: '5px', boxShadow: '0 1px 5px rgba(0,0,0,0.6)', maxWidth: '210px', border: '1px solid hsla(var(--brand-purple-hsl), 0.8)', backdropFilter: 'blur(3px)' }} > <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1"> {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsTurnRight:: " /> : <VibeContentRenderer content="::FaShuffle:: " />} {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span> </p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p> <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p> </div> )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };