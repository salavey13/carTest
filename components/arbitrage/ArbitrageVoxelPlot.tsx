"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';

logger.debug("[ArbitrageVoxelPlot.tsx] Voxel Rebirth V3. File loaded.");

interface R3FLibs {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  DreiOrbitControls: React.FC<any>;
  DreiBox: React.FC<any>;
  DreiText: React.FC<any>;
  DreiHtml: React.FC<any>;
  DreiLine: React.FC<any>;
  DreiGrid: React.FC<any>;
  error?: any;
  errorMessage?: string;
  errorStack?: string;
}

const normalizeAndScale = (value: number, minVal: number, maxVal: number, plotScale: number = 10, plotOffset: number = 0): number => {
  if (maxVal === minVal) return plotOffset + plotScale / 2;
  if (isNaN(value) || isNaN(minVal) || isNaN(maxVal)) {
    logger.warn(`[normalizeAndScale] NaN input detected: val=${value}, min=${minVal}, max=${maxVal}. Returning default offset.`);
    return plotOffset;
  }
  const clampedValue = Math.max(minVal, Math.min(value, maxVal));
  const normalized = (clampedValue - minVal) / (maxVal - minVal);
  return normalized * plotScale + plotOffset;
};

interface VoxelProps {
  position: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  BoxComponent: R3FLibs['DreiBox'];
}

const Voxel: React.FC<VoxelProps> = ({ opportunity, onHover, BoxComponent, position, ...restBoxProps }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [voxelHovered, setVoxelHover] = useState(false);
  const safeSize = Math.max(0.05, opportunity.sizeValue || 0.1);

  if (!BoxComponent) { logger.warn("[Voxel] BoxComponent is undefined!"); return null; }

  const handlePointerOver = (event: any) => { event.stopPropagation(); setVoxelHover(true); onHover(opportunity); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); };
  const handlePointerOut = (event: any) => { event.stopPropagation(); setVoxelHover(false); onHover(null); if (meshRef.current?.material) (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); };
  const handleClick = (event: any) => { event.stopPropagation(); onHover(opportunity); logger.debug("[Voxel] Clicked:", opportunity.id.substring(0,8), "at pos:", position); };
  
  return (
    <BoxComponent
      {...restBoxProps}
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]}
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow receiveShadow >
      <meshStandardMaterial 
        color={opportunity.colorValue} 
        emissive={voxelHovered ? 'darkorange' : 'black'} 
        emissiveIntensity={voxelHovered ? 0.8 : 0} 
        roughness={0.4} metalness={0.2} 
        transparent opacity={voxelHovered ? 1.0 : 0.85}
      />
    </BoxComponent>
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
  const { THREE, useThree, DreiOrbitControls, DreiBox, DreiText, DreiLine, DreiGrid } = r3fLibs;
  const { scene, camera } = useThree();

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    if (processedOpportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const xs = processedOpportunities.map(p => p.x_reward).filter(v => !isNaN(v)); 
    const ys = processedOpportunities.map(p => p.y_ezness).filter(v => !isNaN(v)); 
    const zs = processedOpportunities.map(p => p.z_inv_effort).filter(v => !isNaN(v));
    const res = {
      minX: xs.length ? Math.min(...xs, 0) : 0, maxX: xs.length ? Math.max(...xs, 0.1) : 1,
      minY: ys.length ? Math.min(...ys, 0) : 0, maxY: ys.length ? Math.max(...ys, 0.1) : 1,
      minZ: zs.length ? Math.min(...zs, 0) : 0, maxZ: zs.length ? Math.max(...zs, 0.1) : 1,
    };
    if (res.maxX - res.minX < 0.1) res.maxX = res.minX + 0.1;
    if (res.maxY - res.minY < 0.1) res.maxY = res.minY + 0.1;
    if (res.maxZ - res.minZ < 0.1) res.maxZ = res.minZ + 0.1;
    return res;
  }, [processedOpportunities]);


  useEffect(() => { 
    scene.background = new THREE.Color(0x0A0F1A);
  }, [scene, THREE]);

  if (!DreiLine || !DreiText || !DreiOrbitControls || !DreiGrid || !DreiBox) {
      return <group><DreiText position={[0,0,0]} color="red" fontSize={0.5}>Error: Essential 3D components missing!</DreiText></group>;
  }

  const plotScale = 12;
  const plotOffset = -plotScale / 2;

  return (
    <>
      <ambientLight intensity={0.7} /> 
      <directionalLight position={[plotScale, plotScale * 1.5, plotScale]} intensity={1.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <DreiOrbitControls makeDefault enabled={isPlotActive} minDistance={3} maxDistance={40} target={[0,0,0]} />
      
      <DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset + plotScale + 1, plotOffset, plotOffset]]} color="#FF6B6B" lineWidth={2} />
      <DreiText position={[plotOffset + plotScale + 1.5, plotOffset, plotOffset]} fontSize={0.25} color="#FFC9C9" anchorX="left">X: Reward</DreiText>
      
      <DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset + plotScale + 1, plotOffset]]} color="#4ECDC4" lineWidth={2} />
      <DreiText position={[plotOffset - 0.3, plotOffset + plotScale + 1, plotOffset]} fontSize={0.25} color="#D6FFF6" anchorX="right" anchorY="middle">Y: Ezness</DreiText>

      <DreiLine points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset, plotOffset + plotScale + 1]]} color="#45A6E5" lineWidth={2} />
      <DreiText position={[plotOffset, plotOffset - 0.3, plotOffset + plotScale + 1]} fontSize={0.25} color="#D4F1F9" anchorX="center" anchorY="top">Z: 1/Effort</DreiText>

      <DreiBox args={[0.1,0.1,0.1]} position={[0,0,0]}>
          <meshStandardMaterial color="magenta" emissive="magenta" emissiveIntensity={0.2} />
      </DreiBox>

      {processedOpportunities.map((pOp, index) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, plotScale, plotOffset);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, plotScale, plotOffset);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, plotScale, plotOffset);
        
        if (index < 10) { logger.debug(`[VOXEL #${index}] ID:${pOp.id.substring(0,4)} | Pos(X:${posX.toFixed(2)}, Y:${posY.toFixed(2)}, Z:${posZ.toFixed(2)})`); }
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue) || pOp.sizeValue <= 0) {
            return ( <DreiBox key={`error-${pOp.id}`} args={[0.1,0.1,0.1]} position={[plotOffset + Math.random()*0.1, plotOffset + Math.random()*0.1, plotOffset]}> <meshStandardMaterial color="red" emissive="red" /> </DreiBox> );
        }
        return (<Voxel key={pOp.id} opportunity={pOp} onHover={setHoveredOpportunity} position={[posX, posY, posZ]} BoxComponent={DreiBox} castShadow />);
      })}
      <DreiGrid args={[plotScale, plotScale]} sectionColor={'hsl(var(--brand-purple))'} cellColor={'hsla(var(--brand-purple), 0.2)'} position={[0, plotOffset, 0]} infiniteGrid={false} fadeDistance={plotScale * 3} sectionThickness={1} cellThickness={0.5} side={THREE.BackSide}/>
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[]; isTabActive: boolean; onVoxelHover: (op: ProcessedSandboxOpportunity | null) => void; }> = ({ opportunities, isTabActive, onVoxelHover }) => {
  logger.info(`[ArbitrageVoxelPlot] VoxelRebirth render. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    logger.debug("[ArbitrageVoxelPlot] useEffect: Component mounted. Attempting dynamic imports...");
    const loadLibs = async () => { 
        if (typeof window === 'undefined') { logger.warn("[ArbitrageVoxelPlot] Window undefined, skipping R3F load."); return; }
        try { 
            const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([ import('three'), import('@react-three/fiber'), import('@react-three/drei') ]); 
            logger.info("[ArbitrageVoxelPlot] All R3F/Three dynamic imports SUCCESSFUL."); 
            setLibs({ THREE: THREE_MOD, Canvas: R3F_MOD.Canvas, useThree: R3F_MOD.useThree, DreiOrbitControls: DREI_MOD.OrbitControls, DreiBox: DREI_MOD.Box, DreiText: DREI_MOD.Text, DreiHtml: DREI_MOD.Html, DreiLine: DREI_MOD.Line, DreiGrid: DREI_MOD.Grid }); 
        } catch (err: any) { 
            logger.error("[ArbitrageVoxelPlot] FAILED during ASYNC import stage:", err); 
            setLibs({ error: err, errorMessage: err.message, errorStack: err.stack } as R3FLibs);
        }
    };
    loadLibs();
  }, []); 

  if (!isMounted) return <div className="p-4 text-brand-orange min-h-[600px] flex items-center justify-center">Plot: Waiting for client mount...</div>;
  if (libs?.error) { 
    return ( <div className="p-4 text-red-400 bg-red-900/30 rounded-md min-h-[400px]"> <p className="font-bold text-lg mb-2">Plot: Error loading 3D libraries:</p> <p className="text-sm">Error: {libs.errorMessage || "Unknown error"}</p> <details className="mt-2 text-xs"> <summary className="cursor-pointer text-gray-400 hover:text-white">View Full Error Stack</summary> <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded text-[0.6rem] max-h-60 overflow-auto simple-scrollbar">{libs.errorStack || String(libs.error)}</pre> </details></div> );
  }
  if (!libs || !libs.Canvas || !libs.DreiBox || !libs.DreiOrbitControls || !libs.DreiText || !libs.DreiLine || !libs.DreiGrid || !libs.useThree) { 
    logger.warn("[ArbitrageVoxelPlot] Libs or essential components not fully loaded yet. Current libs state:", libs);
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Loading 3D library components...</div>;
  }
  
  const { Canvas: R3FCanvas, DreiHtml } = libs;

  if (!isTabActive) { 
      return <div className="min-h-[600px] bg-card/10 dark:bg-gray-900/50 rounded-md flex items-center justify-center"><p className="text-muted-foreground italic">Visualization paused</p></div>;
  }

  if (opportunities.length === 0) {
    return <div className="min-h-[600px] flex items-center justify-center"><p className="text-center text-muted-foreground p-8">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p></div>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Rendering Canvas. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'hsl(var(--card-rgb, 264 70% 11%))', borderRadius: '8px', position: 'relative', overflow: 'hidden', touchAction: isTabActive ? 'none' : 'auto' }} className="border border-border dark:border-brand-blue/60 shadow-xl dark:shadow-brand-blue/25">
        <R3FCanvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows gl={{ antialias: true }}>
          <SceneContent 
            processedOpportunities={opportunities} 
            setHoveredOpportunity={onVoxelHover}
            r3fLibs={libs}
            isPlotActive={isTabActive}
          />
        </R3FCanvas>
    </div>
  );
};

export { ArbitrageVoxelPlot as default };