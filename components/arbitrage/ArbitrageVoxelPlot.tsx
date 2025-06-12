"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';

logger.debug("[ArbitrageVoxelPlot.tsx] V4 (Full Voxel Logic). File loaded.");

// --- Dynamically Loaded R3F/Three Libs ---
type R3FLibs = {
  THREE: typeof import('three');
  Canvas: typeof import('@react-three/fiber').Canvas;
  useThree: typeof import('@react-three/fiber').useThree;
  OrbitControls: React.FC<any>;
  Box: React.FC<any>;
  Text: React.FC<any>;
  Line: React.FC<any>;
  Grid: React.FC<any>;
  // Add any other Drei components you need
};

const normalizeAndScale = (value: number, minVal: number, maxVal: number, plotScale: number = 10, plotOffset: number = 0): number => {
  if (maxVal === minVal) return plotOffset + plotScale / 2;
  if (isNaN(value) || isNaN(minVal) || isNaN(maxVal)) return plotOffset;
  const clampedValue = Math.max(minVal, Math.min(value, maxVal));
  const normalized = (clampedValue - minVal) / (maxVal - minVal);
  return normalized * plotScale + plotOffset;
};

// --- Voxel Component with Hover and Click ---
interface VoxelProps {
  position: [number, number, number];
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  onClick: (op: ProcessedSandboxOpportunity) => void;
  isSelected: boolean;
  BoxComponent: R3FLibs['Box'];
}

const Voxel: React.FC<VoxelProps> = ({ opportunity, onHover, onClick, isSelected, BoxComponent, position }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [isHovered, setIsHovered] = useState(false);
  const safeSize = Math.max(0.05, opportunity.sizeValue || 0.1);

  const handlePointerOver = (e: any) => { e.stopPropagation(); setIsHovered(true); onHover(opportunity); };
  const handlePointerOut = (e: any) => { e.stopPropagation(); setIsHovered(false); onHover(null); };
  const handleClick = (e: any) => { e.stopPropagation(); onClick(opportunity); };

  const emissiveColor = isSelected ? 'hsl(180, 100%, 70%)' : isHovered ? 'darkorange' : 'black';
  const emissiveIntensity = isSelected ? 0.9 : isHovered ? 0.7 : opportunity.x_reward > 2 ? 0.3 : 0;
  const scale = isSelected ? 1.5 : 1;

  return (
    <BoxComponent
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]}
      position={position}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={opportunity.colorValue}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
        metalness={0.2}
        transparent
        opacity={isHovered || isSelected ? 1.0 : 0.8}
        toneMapped={false}
      />
    </BoxComponent>
  );
};

// --- Scene Component ---
interface SceneContentProps {
  opportunities: ProcessedSandboxOpportunity[];
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  onClick: (op: ProcessedSandboxOpportunity) => void;
  selectedOpportunity: ProcessedSandboxOpportunity | null;
  r3fLibs: R3FLibs;
  isPlotActive: boolean;
}

const SceneContent: React.FC<SceneContentProps> = ({ opportunities, onHover, onClick, selectedOpportunity, r3fLibs, isPlotActive }) => {
  const { THREE, useThree, OrbitControls, Box, Text, Line, Grid } = r3fLibs;
  const { scene } = useThree();

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    // ... same axis calculation as before ...
    if (opportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const xs = opportunities.map(p => p.x_reward).filter(v => !isNaN(v)); 
    const ys = opportunities.map(p => p.y_ezness).filter(v => !isNaN(v)); 
    const zs = opportunities.map(p => p.z_inv_effort).filter(v => !isNaN(v));
    const res = {
      minX: xs.length ? Math.min(...xs) : 0, maxX: xs.length ? Math.max(...xs, 0.1) : 1,
      minY: ys.length ? Math.min(...ys, 0) : 0, maxY: ys.length ? Math.max(...ys, 0.1) : 1,
      minZ: zs.length ? Math.min(...zs, 0) : 0, maxZ: zs.length ? Math.max(...zs, 0.1) : 1,
    };
    if (res.maxX - res.minX < 0.1) res.maxX = res.minX + 0.1;
    if (res.maxY - res.minY < 0.1) res.maxY = res.minY + 0.1;
    if (res.maxZ - res.minZ < 0.1) res.maxZ = res.minZ + 0.1;
    return res;
  }, [opportunities]);

  useEffect(() => { scene.background = new THREE.Color(0x0A0F1C); }, [scene, THREE]);

  const plotScale = 12; // Slightly larger plot area
  const plotOffset = -plotScale / 2;

  return (
    <>
      <ambientLight intensity={0.6} /> 
      <directionalLight position={[10, 15, 10]} intensity={1.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <OrbitControls makeDefault enabled={isPlotActive} minDistance={3} maxDistance={40} target={[0,0,0]} />
      
      <Line points={[[plotOffset, plotOffset, plotOffset], [plotOffset + plotScale + 1, plotOffset, plotOffset]]} color="#FF6B6B" lineWidth={2} />
      <Text position={[plotOffset + plotScale + 1.5, plotOffset, plotOffset]} fontSize={0.25} color="#FFC9C9" anchorX="left">X: Reward</Text>
      
      <Line points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset + plotScale + 1, plotOffset]]} color="#4ECDC4" lineWidth={2} />
      <Text position={[plotOffset - 0.3, plotOffset + plotScale + 1, plotOffset]} fontSize={0.25} color="#D6FFF6" anchorX="right" anchorY="middle">Y: Ezness</Text>

      <Line points={[[plotOffset, plotOffset, plotOffset], [plotOffset, plotOffset, plotOffset + plotScale + 1]]} color="#45A6E5" lineWidth={2} />
      <Text position={[plotOffset, plotOffset, plotScale + 1.3]} fontSize={0.25} color="#D4F1F9" anchorX="center" anchorY="middle" rotation-x={-Math.PI / 8}>Z: 1/Effort</Text>

      {processedOpportunities.map((pOp) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, plotScale, plotOffset);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, plotScale, plotOffset);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, plotScale, plotOffset);
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue) || pOp.sizeValue <= 0) return null;
        return (<Voxel key={pOp.id} opportunity={pOp} onHover={onHover} onClick={onClick} isSelected={selectedOpportunity?.id === pOp.id} position={[posX, posY, posZ]} BoxComponent={Box} castShadow />);
      })}
      <Grid args={[plotScale, plotScale]} sectionColor={'hsl(var(--brand-purple))'} cellColor={'hsla(var(--brand-purple), 0.2)'} position={[0, plotOffset, 0]} infiniteGrid={false} fadeDistance={plotScale * 3} sectionThickness={1} cellThickness={0.5} side={THREE.BackSide}/>
    </>
  );
};

// --- Main Component ---
const ArbitrageVoxelPlot: React.FC<{ 
  opportunities: ProcessedSandboxOpportunity[]; 
  isTabActive: boolean; 
  onVoxelSelect: (op: ProcessedSandboxOpportunity | null) => void;
}> = ({ opportunities, isTabActive, onVoxelSelect }) => {
  logger.info(`[ArbitrageVoxelPlot] VoxelRebirth render. Ops: ${opportunities.length}, TabActive: ${isTabActive}`);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [libs, setLibs] = useState<R3FLibs | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const loadLibs = async () => { 
        if (typeof window === 'undefined') return;
        try { 
            const [THREE_MOD, R3F_MOD, DREI_MOD] = await Promise.all([ import('three'), import('@react-three/fiber'), import('@react-three/drei') ]); 
            logger.info("[ArbitrageVoxelPlot] All R3F/Three dynamic imports SUCCESSFUL."); 
            setLibs({ THREE: THREE_MOD, Canvas: R3F_MOD.Canvas, useThree: R3F_MOD.useThree, OrbitControls: DREI_MOD.OrbitControls, Box: DREI_MOD.Box, Text: DREI_MOD.Text, Html: DREI_MOD.Html, Line: DREI_MOD.Line, Grid: DREI_MOD.Grid }); 
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
  if (!libs) { 
    return <div className="p-4 text-brand-yellow animate-pulse min-h-[600px] flex items-center justify-center">Plot: Loading 3D library components...</div>;
  }
  
  const { Canvas: R3FCanvas } = libs;
  const currentlyDisplayedOpportunity = hoveredOpportunity || selectedOpportunity;

  if (!isTabActive) { 
      return <div className="min-h-[600px] bg-card/10 dark:bg-gray-900/50 rounded-md flex items-center justify-center"><p className="text-muted-foreground italic">Visualization paused</p></div>;
  }

  if (opportunities.length === 0) {
    return <div className="min-h-[600px] flex items-center justify-center"><p className="text-center text-muted-foreground p-8">No opportunities to visualize based on current filters.</p></div>;
  }
  
  return (
    <div style={{ height: '600px', width: '100%', background: 'hsl(var(--card-background-rgb, 264 70% 11%))', borderRadius: '8px', position: 'relative', overflow: 'hidden', touchAction: isTabActive ? 'none' : 'auto' }} className="border border-border dark:border-brand-blue/60 shadow-xl dark:shadow-brand-blue/25">
        <R3FCanvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows gl={{ antialias: true }}>
          <SceneContent 
            opportunities={opportunities} 
            onHover={setHoveredOpportunity}
            onClick={onVoxelSelect}
            selectedOpportunity={selectedOpportunity}
            r3fLibs={libs}
            isPlotActive={isTabActive}
          />
        </R3FCanvas>
      {isTabActive && currentlyDisplayedOpportunity && ( 
          <div className="absolute top-2.5 left-2.5 pointer-events-none z-10 p-2 text-xs text-white bg-black/70 backdrop-blur-sm border border-brand-purple/50 rounded-md shadow-lg max-w-[220px]">
              <p className="font-bold text-brand-cyan text-sm mb-1 border-b border-brand-cyan/25 pb-1"> 
                  {currentlyDisplayedOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsTurnRight:: " /> : <VibeContentRenderer content="::FaShuffle:: " />} 
                  {currentlyDisplayedOpportunity.type === '2-leg' ? `${(currentlyDisplayedOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(currentlyDisplayedOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (currentlyDisplayedOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} 
                  <span className="text-gray-400 ml-1.5">({currentlyDisplayedOpportunity.currencyPair.substring(0,8)})</span> 
              </p> 
              <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{currentlyDisplayedOpportunity.profitPercentage.toFixed(2)}%</span></p> 
              <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${currentlyDisplayedOpportunity.potentialProfitUSD.toFixed(2)}</span></p> 
              <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {currentlyDisplayedOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p>
          </div> 
      )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };