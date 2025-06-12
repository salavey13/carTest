"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';

logger.debug("[ArbitrageVoxelPlot.tsx] FULL VERSION (Voxel Rebirth). File loaded.");

interface R3FLibs {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  DreiOrbitControls: typeof import('@react-three/drei').OrbitControls;
  DreiBox: typeof import('@react-three/drei').Box;
  DreiText: typeof import('@react-three/drei').Text;
  DreiHtml: typeof import('@react-three/drei').Html;
  DreiLine: typeof import('@react-three/drei').Line;
  DreiGrid: typeof import('@react-three/drei').Grid;
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const normalizeAndScale = (value: number, minVal: number, maxVal: number, plotScale: number = 10, plotOffset: number = 0): number => {
  const range = plotScale; // Plot will be from plotOffset to plotOffset + plotScale
  if (maxVal === minVal) { // Handle single point or all same values
    return plotOffset + range / 2;
  }
  if (isNaN(value) || isNaN(minVal) || isNaN(maxVal)) {
    logger.warn(`[normalizeAndScale] NaN input: val=${value}, min=${minVal}, max=${maxVal}. Returning center.`);
    return plotOffset + range / 2;
  }
  // Clamp value to be within minVal and maxVal to avoid extreme scaling for outliers
  const clampedValue = Math.max(minVal, Math.min(value, maxVal));
  const normalized = (clampedValue - minVal) / (maxVal - minVal);
  const result = normalized * range + plotOffset;
  // logger.debug(`[N&S] ${value.toFixed(2)} in [${minVal.toFixed(2)}-${maxVal.toFixed(2)}] -> ${result.toFixed(2)} (offset: ${plotOffset}, scale: ${range})`);
  return result;
};


interface VoxelProps {
  position: [number, number, number]; // Position is mandatory now
  castShadow?: boolean;
  receiveShadow?: boolean;
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  DreiBox: R3FLibs['DreiBox'];
}

const Voxel: React.FC<VoxelProps> = ({ opportunity, onHover, DreiBox, position, ...restBoxProps }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [voxelHovered, setVoxelHover] = useState(false);
  const baseSize = opportunity.sizeValue;
  const safeSize = (!isNaN(baseSize) && baseSize > 0.001) ? Math.max(0.05, baseSize) : 0.1;

  if (!DreiBox) { return null; }

  const handlePointerOver = (event: any) => { event.stopPropagation(); setVoxelHover(true); onHover(opportunity); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); };
  const handlePointerOut = (event: any) => { event.stopPropagation(); setVoxelHover(false); onHover(null); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); };
  const handleClick = (event: any) => { event.stopPropagation(); onHover(opportunity); logger.debug("[Voxel] Clicked:", opportunity.id.substring(0,8), "at pos:", position); };

  return (
    <DreiBox
      {...restBoxProps}
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]}
      position={position} // Use the calculated and passed position
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow receiveShadow >
      <meshStandardMaterial 
        color={opportunity.colorValue} 
        emissive={voxelHovered ? 'darkorange' : 'black'} 
        emissiveIntensity={voxelHovered ? 0.7 : 0} 
        roughness={0.4} metalness={0.1} 
        transparent opacity={voxelHovered ? 0.95 : 0.8}
      />
    </DreiBox>
  );
};

interface SceneContentProps {
  processedOpportunities: ProcessedSandboxOpportunity[];
  setHoveredOpportunity: (op: ProcessedSandboxOpportunity | null) => void;
  r3fLibs: R3FLibs;
  isPlotActive: boolean;
}

const SceneContent: React.FC<SceneContentProps> = ({
  processedOpportunities, setHoveredOpportunity, r3fLibs, isPlotActive
}) => {
  logger.debug(`[SceneContent] Rendering. Opportunities: ${processedOpportunities.length}, PlotActive: ${isPlotActive}`);
  const { scene, camera } = r3fLibs.useThree(); // useThree must be called within Canvas context

  // Calculate axis boundaries based on current opportunities
  const { minX, maxX, minY, maxY, minZ, maxZ, dataCenter } = useMemo(() => {
    if (processedOpportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, dataCenter: new r3fLibs.THREE.Vector3(0,0,0) };
    const xs = processedOpportunities.map(p => p.x_reward).filter(v => !isNaN(v)); 
    const ys = processedOpportunities.map(p => p.y_ezness).filter(v => !isNaN(v)); 
    const zs = processedOpportunities.map(p => p.z_inv_effort).filter(v => !isNaN(v));
    
    const res = {
      minX: xs.length ? Math.min(...xs) : 0, maxX: xs.length ? Math.max(...xs) : 1,
      minY: ys.length ? Math.min(...ys) : 0, maxY: ys.length ? Math.max(...ys) : 1,
      minZ: zs.length ? Math.min(...zs) : 0, maxZ: zs.length ? Math.max(...zs) : 1,
      dataCenter: new r3fLibs.THREE.Vector3(
        xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0,
        ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0,
        zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0
      )
    };
    // Add small padding to max if min and max are too close or same
    if (res.maxX - res.minX < 0.1) res.maxX = res.minX + 0.1;
    if (res.maxY - res.minY < 0.1) res.maxY = res.minY + 0.1;
    if (res.maxZ - res.minZ < 0.1) res.maxZ = res.minZ + 0.1;
    logger.debug("[SceneContent useMemo Axes] Calculated axes:", res);
    return res;
  }, [processedOpportunities, r3fLibs.THREE.Vector3]);

  useEffect(() => { 
    scene.background = new r3fLibs.THREE.Color(0x0A0F1C); // Dark blueish
    logger.debug("[SceneContent] useEffect: Scene background set.");
  }, [scene, r3fLibs.THREE]);
  
  // Center camera on data, or origin if no data
  useEffect(() => {
    if (camera && r3fLibs.DreiOrbitControls && processedOpportunities.length > 0) {
        // Placeholder, OrbitControls target is usually handled by the control itself
        // If you need to force a lookAt, you might do it here, but OrbitControls usually manages this.
        // camera.lookAt(dataCenter);
    }
  }, [camera, r3fLibs.DreiOrbitControls, dataCenter, processedOpportunities.length]);


  if (!r3fLibs.DreiLine || !r3fLibs.DreiText || !r3fLibs.DreiOrbitControls || !r3fLibs.DreiGrid || !r3fLibs.DreiBox) {
      logger.error("[SceneContent] Essential Drei components missing from r3fLibs for scene rendering!", r3fLibs);
      return <group><r3fLibs.DreiText position={[0,0,0]} color="red" fontSize={0.5}>Error: 3D components missing!</r3fLibs.DreiText></group>;
  }

  const plotScale = 10; // The size of our plot cube in 3D space (e.g., -5 to +5)
  const plotOffset = -plotScale / 2; // To center the plot around the origin

  return (
    <>
      <ambientLight intensity={0.8} /> 
      <directionalLight position={[plotScale, plotScale * 1.5, plotScale]} intensity={1.3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <r3fLibs.DreiOrbitControls makeDefault enabled={isPlotActive} enablePan={isPlotActive} enableZoom={isPlotActive} enableRotate={isPlotActive} minDistance={2} maxDistance={plotScale * 3} target={[0,0,0]} />
      
      {/* Axes Lines and Text - scaled relative to plotScale and plotOffset */}
      <r3fLibs.DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset + plotScale + 1, plotOffset, plotOffset]]} color="#FF5555" lineWidth={1.5} />
      <r3fLibs.DreiText position={[plotOffset + plotScale + 1.5, plotOffset, plotOffset]} fontSize={0.25} color="#FFDDDD" anchorX="left">X: Reward</r3fLibs.DreiText>
      
      <r3fLibs.DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset + plotScale + 1, plotOffset]]} color="#55FF55" lineWidth={1.5} />
      <r3fLibs.DreiText position={[plotOffset - 0.3, plotOffset + plotScale + 1, plotOffset]} fontSize={0.25} color="#DDFFDD" anchorX="right" anchorY="middle">Y: Ezness</r3fLibs.DreiText>

      <r3fLibs.DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset, plotOffset + plotScale + 1]]} color="#5555FF" lineWidth={1.5} />
      <r3fLibs.DreiText position={[plotOffset, plotOffset - 0.3, plotOffset + plotScale + 1]} fontSize={0.25} color="#DDDDFF" anchorX="center" anchorY="top">Z: 1/Effort</r3fLibs.DreiText>

      <r3fLibs.DreiBox args={[0.1,0.1,0.1]} position={[0,0,0]}>
          <meshStandardMaterial color="magenta" />
      </r3fLibs.DreiBox>

      {processedOpportunities.map((pOp, index) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, plotScale, plotOffset);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, plotScale, plotOffset);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, plotScale, plotOffset);
        
        if (index < 10) { // Log first 10 calculated positions for denser data
            logger.debug(`[VOXEL #${index}] ID:${pOp.id.substring(0,4)} | Raw(R:${pOp.x_reward.toFixed(2)}, E:${pOp.y_ezness.toFixed(2)}, IE:${pOp.z_inv_effort.toFixed(2)}) | Scaled(X:${posX.toFixed(2)}, Y:${posY.toFixed(2)}, Z:${posZ.toFixed(2)}) | Size:${pOp.sizeValue.toFixed(2)} Clr:${pOp.colorValue}`);
        }

        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue) || pOp.sizeValue <= 0) {
            logger.warn(`[SceneContent] Invalid data for voxel ${pOp.id.substring(0,4)}. Pos[${posX},${posY},${posZ}], Size ${pOp.sizeValue}. Skipping.`);
            return null; // Skip rendering this voxel
        }
        return (<Voxel key={pOp.id} opportunity={pOp} onHover={setHoveredOpportunity} position={[posX, posY, posZ]} dreiBoxComponent={r3fLibs.DreiBox} castShadow />);
      })}
      <r3fLibs.DreiGrid args={[plotScale, plotScale]} sectionColor={'hsl(var(--brand-purple))'} cellColor={'hsla(var(--brand-purple-hsl), 0.2)'} position={[plotOffset + plotScale/2, plotOffset -0.05 , plotOffset + plotScale/2]} infiniteGrid={false} fadeDistance={plotScale * 2.5} sectionThickness={1} cellThickness={0.5} followCamera={false} side={r3fLibs.THREE.BackSide}/>
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[]; isTabActive: boolean; }> = ({ opportunities, isTabActive }) => {
  // ... (useState, useEffect for libs, loadError, isMounted - same as previous "Ultra-Minimal" version)
  logger.info(`[ArbitrageVoxelPlot] Rendering. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null); // Changed from just error string to potentially any
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot] useEffect: Component mounted. Attempting dynamic imports...");
    const loadLibs = async () => { 
        if (typeof window === 'undefined') {
            logger.warn("[ArbitrageVoxelPlot] Window undefined, skipping R3F load in useEffect.");
            return;
        }
        try { 
            const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([ import('three'), import('@react-three/fiber'), import('@react-three/drei') ]); 
            logger.info("[ArbitrageVoxelPlot] All R3F/Three dynamic imports SUCCESSFUL."); 
            setLibs({ THREE: THREE_MOD, Canvas: R3F_MOD.Canvas, useThree: R3F_MOD.useThree, DreiOrbitControls: DREI_MOD.OrbitControls, DreiBox: DREI_MOD.Box, DreiText: DREI_MOD.Text, DreiHtml: DREI_MOD.Html, DreiLine: DREI_MOD.Line, DreiGrid: DREI_MOD.Grid }); 
        } catch (err: any) { 
            logger.error("[ArbitrageVoxelPlot] FAILED during ASYNC import stage:", err); 
            setLibs({ error: err, errorMessage: err.message, errorStack: err.stack }); // Store full error
            setLoadError(err.message || String(err)); // Also set simple error message for display
        }
    };
    loadLibs();
  }, []); 

  if (!isMounted) return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount...</div>;
  if (libs?.error) { // Check error object in libs
    return ( <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]"> <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries:</p> <p className="text-sm">Error: {libs.errorMessage || "Unknown error"}</p> <details className="mt-2 text-xs"> <summary className="cursor-pointer text-gray-400 hover:text-white">View Full Error Stack</summary> <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded text-[0.6rem] max-h-60 overflow-auto simple-scrollbar">{libs.errorStack || String(libs.error)}</pre> </details></div> );
  }
  if (!libs || !libs.Canvas || !libs.DreiBox || !libs.DreiOrbitControls || !libs.DreiText || !libs.DreiLine || !libs.DreiGrid || !libs.useThree || !libs.THREE) { 
    logger.warn("[ArbitrageVoxelPlot] Libs or essential components not fully loaded yet.", libs);
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Loading 3D library components...</div>;
  }
  
  const { Canvas: R3FCanvas, DreiHtml } = libs;

  if (opportunities.length === 0 && isTabActive) { 
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  if (!isTabActive) { 
      return <div className="min-h-[600px] bg-gray-900/50 rounded-md flex items-center justify-center"><p className="text-gray-600 text-sm">Visualization Paused (Tab Inactive)</p></div>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Rendering Canvas. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'hsl(var(--card-background-rgb, 264 70% 11%))', borderRadius: '8px', position: 'relative', overflow: 'hidden', touchAction: isTabActive ? 'none' : 'auto' }} className="border border-brand-blue/60 shadow-xl shadow-brand-blue/25">
      {opportunities.length > 0 ? (
        <R3FCanvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows gl={{ antialias: true }}>
          <SceneContent 
            processedOpportunities={opportunities} 
            setHoveredOpportunity={setHoveredOpportunity}
            // minX, maxX etc. are calculated in SceneContent's useMemo now based on opportunities passed to it
            r3fLibs={libs}
            isPlotActive={isTabActive}
            // Pass min/max explicitly if needed by SceneContent for some reason, but it recalculates
            minX={useMemo(() => opportunities.length ? Math.min(...opportunities.map(p => p.x_reward),0) : 0, [opportunities])}
            maxX={useMemo(() => opportunities.length ? Math.max(...opportunities.map(p => p.x_reward),0.1) : 1, [opportunities])}
            minY={useMemo(() => opportunities.length ? Math.min(...opportunities.map(p => p.y_ezness),0) : 0, [opportunities])}
            maxY={useMemo(() => opportunities.length ? Math.max(...opportunities.map(p => p.y_ezness),0.1) : 1, [opportunities])}
            minZ={useMemo(() => opportunities.length ? Math.min(...opportunities.map(p => p.z_inv_effort),0) : 0, [opportunities])}
            maxZ={useMemo(() => opportunities.length ? Math.max(...opportunities.map(p => p.z_inv_effort),0.1) : 1, [opportunities])}
          />
        </R3FCanvas>
      ) : ( 
        <div className="w-full h-full flex items-center justify-center bg-gray-800/10"><p className="text-gray-500 italic">No data for current filters to visualize.</p></div>
      )}
      {isTabActive && hoveredOpportunity && ( <div className="voxel-tooltip-wrapper" style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100, background: 'hsla(var(--card-rgb, 22 8 49) / 0.92)', color: 'hsl(var(--card-foreground, 0 0% 95%))', fontSize: '10px', padding: '7px 9px', borderRadius: '5px', boxShadow: '0 1px 5px rgba(0,0,0,0.6)', maxWidth: '210px', border: '1px solid hsla(var(--brand-purple-hsl), 0.8)', backdropFilter: 'blur(3px)' }} > <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1"> {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsTurnRight:: " /> : <VibeContentRenderer content="::FaShuffle:: " />} {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span> </p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p> <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p> </div> )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };