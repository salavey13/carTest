"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, ThreeElements, useThree } from '@react-three/fiber';
import { OrbitControls, Box, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger'; // Using debugLogger
// Import ProcessedSandboxOpportunity from the sandbox page directly for strong typing
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';

logger.debug("[ArbitrageVoxelPlot.tsx] File loaded by browser, component definition is being parsed."); // TOP LEVEL LOG

const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal) return offset + scaleFactor / 2;
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

interface VoxelProps extends Omit<ThreeElements['mesh'], 'args'> { 
  opportunity: ProcessedSandboxOpportunity; 
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
}

const Voxel: React.FC<VoxelProps> = (props) => {
  // logger.debug("[Voxel] Component rendering/re-rendering with opportunity:", props.opportunity.id.substring(0,4));
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  
  const { opportunity, onHover, ...restBoxProps } = props; 

  useEffect(() => {
    // logger.debug(`[Voxel ${opportunity.id.substring(0,4)}] Mounted. Size: ${opportunity.sizeValue}, Color: ${opportunity.colorValue}`);
    if (meshRef.current) {
        meshRef.current.rotation.x = Math.random() * 0.05; 
        meshRef.current.rotation.y = Math.random() * 0.05;
    }
  }, [opportunity.id, opportunity.sizeValue, opportunity.colorValue]);


  const handlePointerOver = (event: React.MouseEvent<THREE.Mesh, MouseEvent>) => { 
    event.stopPropagation();
    setHover(true);
    onHover(opportunity);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange');
    }
  };

  const handlePointerOut = (event: React.MouseEvent<THREE.Mesh, MouseEvent>) => {
    event.stopPropagation();
    setHover(false);
    onHover(null);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
    }
  };
  
  const handleClick = (event: React.MouseEvent<THREE.Mesh, MouseEvent>) => {
    event.stopPropagation();
    onHover(opportunity); 
    logger.debug("[Voxel] Clicked:", opportunity);
  };

  const safeSize = Math.max(0.01, opportunity.sizeValue);

  return (
    <Box
      {...restBoxProps} 
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]} 
      onClick={handleClick as any} 
      onPointerOver={handlePointerOver as any}
      onPointerOut={handlePointerOut as any}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial 
        color={opportunity.colorValue} 
        emissive={hovered ? 'darkorange' : 'black'} 
        emissiveIntensity={hovered ? 0.6 : 0} 
        roughness={0.5} 
        metalness={0.3}
        transparent 
        opacity={hovered ? 1 : 0.85} 
      />
    </Box>
  );
};

interface SceneContentProps {
  processedOpportunities: ProcessedSandboxOpportunity[];
  setHoveredOpportunity: (op: ProcessedSandboxOpportunity | null) => void;
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
}

const SceneContent: React.FC<SceneContentProps> = ({
  processedOpportunities, setHoveredOpportunity, minX, maxX, minY, maxY, minZ, maxZ
}) => {
  logger.debug("[SceneContent] Component rendering/re-rendering. Opportunities:", processedOpportunities.length);
  const { scene } = useThree();

  useEffect(() => {
    logger.debug("[SceneContent] useEffect: Mounted or props changed. Opportunities:", processedOpportunities.length);
    return () => {
      logger.debug("[SceneContent] useEffect: Unmounting.");
    };
  }, [processedOpportunities, scene]);

  return (
    <>
      <ambientLight intensity={0.7} /> 
      <directionalLight 
        position={[15, 20, 15]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024}
        shadow-camera-far={60} 
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
      />
      <pointLight position={[-15, -10, -15]} intensity={0.4} color="#6A0DAD" /> 
      <OrbitControls 
        makeDefault 
        enablePan={true} enableZoom={true} enableRotate={true} 
        minDistance={2} maxDistance={40} 
        target={[0,0,0]} 
      />
      
      <line position={[-5, -5, -5]} points={[[0,0,0], [11,0,0]]} color="red" lineWidth={2} /> 
      <Text position={[6, -0.3, -5]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="top">X: Reward</Text>
      
      <line position={[-5, -5, -5]} points={[[0,0,0], [0,11,0]]} color="green" lineWidth={2} /> 
      <Text position={[-5.3, 6, -5]} fontSize={0.25} color="#E0E0E0" anchorX="right" anchorY="middle" rotation={[0,0,0]}>Y: Ezness</Text>

      <line position={[-5, -5, -5]} points={[[0,0,0], [0,0,11]]} color="blue" lineWidth={2} /> 
      <Text position={[-5, -5.3, 6]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="bottom" rotation={[0,0,0]}>Z: 1/Effort</Text>

      {processedOpportunities.map((pOp) => {
        const posX = normalizeAndScale(pOp.x_reward, minX, maxX, 10, -5);
        const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, 10, -5);
        const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, 10, -5);
        
        if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(pOp.sizeValue)) {
            logger.warn(`[SceneContent] NaN detected for opportunity ${pOp.id}. Skipping voxel.`, {pOp, posX, posY, posZ});
            return null;
        }

        return (
            <Voxel
                key={pOp.id}
                opportunity={pOp}
                onHover={setHoveredOpportunity}
                position={[posX, posY, posZ]} 
            />
        );
      })}
      <gridHelper args={[10, 10, '#383838', '#202020']} position={[0, -5.05, 0]} />
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info("[ArbitrageVoxelPlot] Component FUNCTION CALLED. Opportunities count:", opportunities.length); // LOG AT THE VERY START
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    logger.debug("[ArbitrageVoxelPlot] useEffect for isClientReady. Setting to true.");
    setIsClientReady(true); 
    return () => {
        logger.debug("[ArbitrageVoxelPlot] useEffect for isClientReady: Unmounting. isClientReady was:", isClientReady);
    }
  }, []); 

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    // ... (memo logic for axes as before)
    if (opportunities.length === 0) { logger.debug("[ArbitrageVoxelPlot useMemo Axes] No opportunities, returning default axes."); return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }; }
    const xs = opportunities.map(p => p.x_reward); const ys = opportunities.map(p => p.y_ezness); const zs = opportunities.map(p => p.z_inv_effort);
    const result = { minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1), minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1), minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1) };
    logger.debug("[ArbitrageVoxelPlot useMemo Axes] Calculated axes:", result); return result;
  }, [opportunities]);

  if (!isClientReady) {
    logger.warn("[ArbitrageVoxelPlot] PRE-RENDER GUARD: Not client ready, rendering placeholder for Canvas.");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-cyan animate-pulse">Waiting for Client Hydration for 3D...</p></div>;
  }

  if (opportunities.length === 0) {
    logger.debug("[ArbitrageVoxelPlot] No opportunities to display, rendering placeholder (client is ready).");
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Client is ready. Rendering Canvas with ${opportunities.length} processed opportunities.`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/60 shadow-lg shadow-brand-blue/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows >
        <SceneContent 
          processedOpportunities={opportunities} 
          setHoveredOpportunity={setHoveredOpportunity}
          minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
        />
      </Canvas>
      {/* ... Tooltip HTML (same as before) ... */}
      {hoveredOpportunity && ( <div className="voxel-tooltip-wrapper" style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100, background: 'rgba(15, 5, 35, 0.92)', color: '#E8E8E8', fontSize: '10px', padding: '7px 9px', borderRadius: '5px', boxShadow: '0 1px 5px rgba(0,0,0,0.6)', maxWidth: '210px', border: '1px solid hsla(var(--brand-purple), 0.8)', backdropFilter: 'blur(3px)' }} > <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1"> {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsAltH:: " /> : <VibeContentRenderer content="::FaShareAlt:: " />} {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)} <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span> </p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p> <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p> <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p> </div> )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };