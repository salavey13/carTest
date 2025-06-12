"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, ThreeElements, useThree } from '@react-three/fiber';
import { OrbitControls, Box, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { logger } from '@/lib/logger';
// Import ProcessedSandboxOpportunity from the sandbox page directly for strong typing
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';


const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal) return offset + scaleFactor / 2; // Avoid division by zero, center it
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

// --- CORRECTED VoxelProps Interface ---
interface VoxelProps extends Omit<ThreeElements['mesh'], 'args'> { // Omit 'args' from ThreeElements['mesh']
  opportunity: ProcessedSandboxOpportunity;
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
  // args will be implicitly handled by <Box args={...} /> so we don't need to pass it explicitly
  // If you intend to pass args for the Box directly, it would be:
  // args?: [number, number, number];
}

const Voxel: React.FC<VoxelProps> = (props) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  
  // Destructure props carefully
  const { opportunity, onHover, ...restBoxProps } = props; 

  useEffect(() => {
    // logger.debug(`[Voxel ${opportunity.id.substring(0,4)}] Mounted. Size: ${opportunity.sizeValue}, Color: ${opportunity.colorValue}`);
    if (meshRef.current) {
        meshRef.current.rotation.x = Math.random() * 0.05; // Reduced random rotation
        meshRef.current.rotation.y = Math.random() * 0.05;
    }
  }, [opportunity.id, opportunity.sizeValue, opportunity.colorValue]);


  const handlePointerOver = (event: React.MouseEvent<THREE.Mesh, MouseEvent>) => { // More specific event type
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
      {...restBoxProps} // Spread other props like position, castShadow etc.
      ref={meshRef}
      args={[safeSize, safeSize, safeSize]} // Args for the Box geometry
      onClick={handleClick as any} // Cast to any if types are tricky with event specifics
      onPointerOver={handlePointerOver as any}
      onPointerOut={handlePointerOut as any}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial 
        color={opportunity.colorValue} 
        emissive={hovered ? 'darkorange' : 'black'} // Use emissive color string directly
        emissiveIntensity={hovered ? 0.6 : 0} // Control intensity
        roughness={0.5} 
        metalness={0.3}
        transparent // Enable transparency if opacity is used
        opacity={hovered ? 1 : 0.85} // Make slightly transparent when not hovered
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
  const { scene } = useThree();

  useEffect(() => {
    logger.debug("[SceneContent] Mounted or props changed. Opportunities:", processedOpportunities.length);
    // scene.background = new THREE.Color(0x0A021C);
    // scene.fog = new THREE.Fog(0x0A021C, 10, 40); // Linear fog for depth
    
    return () => {
      logger.debug("[SceneContent] Unmounting.");
    };
  }, [processedOpportunities, scene]);

  return (
    <>
      <ambientLight intensity={0.7} /> {/* Slightly more ambient light */}
      <directionalLight 
        position={[15, 20, 15]} // Adjusted position
        intensity={1.2} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024}
        shadow-camera-far={60} // Increased far for larger scenes
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
      />
      <pointLight position={[-15, -10, -15]} intensity={0.4} color="#6A0DAD" /> {/* Dimmer, different purple backlight */}
      <OrbitControls 
        makeDefault 
        enablePan={true} enableZoom={true} enableRotate={true} 
        minDistance={2} maxDistance={40} // Adjusted max distance
        target={[0,0,0]} 
      />
      
      {/* Axes Lines using simple Line segments from Drei for clarity */}
      <line position={[-5, -5, -5]} points={[[0,0,0], [11,0,0]]} color="red" lineWidth={2} /> {/* X axis */}
      <Text position={[6, -0.3, -5]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="top">X: Reward</Text>
      
      <line position={[-5, -5, -5]} points={[[0,0,0], [0,11,0]]} color="green" lineWidth={2} /> {/* Y axis */}
      <Text position={[-5.3, 6, -5]} fontSize={0.25} color="#E0E0E0" anchorX="right" anchorY="middle" rotation={[0,0,0]}>Y: Ezness</Text>

      <line position={[-5, -5, -5]} points={[[0,0,0], [0,0,11]]} color="blue" lineWidth={2} /> {/* Z axis */}
      <Text position={[-5, -5.3, 6]} fontSize={0.25} color="#E0E0E0" anchorX="center" anchorY="bottom" rotation={[0,0,0]}>Z: 1/Effort</Text>


      {processedOpportunities.map((pOp) => {
        // Ensure positions are numbers
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
                position={[posX, posY, posZ]} // Pass position as a prop
            />
        );
      })}
      <gridHelper args={[10, 10, '#383838', '#202020']} position={[0, -5.05, 0]} />
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.debug("[ArbitrageVoxelPlot] Component rendering. Opportunities count:", opportunities.length);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    logger.debug("[ArbitrageVoxelPlot] useEffect for isClientReady. Setting to true.");
    setIsClientReady(true); // This ensures Canvas only renders on client
    return () => {
        logger.debug("[ArbitrageVoxelPlot] Unmounting. isClientReady was:", isClientReady);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // isClientReady should not be in dependencies here

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    if (opportunities.length === 0) {
      logger.debug("[ArbitrageVoxelPlot useMemo Axes] No opportunities, returning default axes.");
      return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    }
    const xs = opportunities.map(p => p.x_reward);
    const ys = opportunities.map(p => p.y_ezness);
    const zs = opportunities.map(p => p.z_inv_effort);
    const result = {
      minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1),
      minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1),
      minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1)
    };
    logger.debug("[ArbitrageVoxelPlot useMemo Axes] Calculated axes:", result);
    return result;
  }, [opportunities]);

  if (!isClientReady) {
    logger.debug("[ArbitrageVoxelPlot] Not client ready, rendering placeholder for Canvas.");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-cyan animate-pulse">Initializing 3D Voxel Universe...</p></div>;
  }

  if (opportunities.length === 0) {
    logger.debug("[ArbitrageVoxelPlot] No opportunities to display, rendering placeholder.");
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Rendering Canvas with ${opportunities.length} processed opportunities.`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/60 shadow-lg shadow-brand-blue/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows >
        <SceneContent 
          processedOpportunities={opportunities} 
          setHoveredOpportunity={setHoveredOpportunity}
          minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
        />
      </Canvas>
      {hoveredOpportunity && (
        <div 
            className="voxel-tooltip-wrapper" 
            style={{ 
                position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', zIndex: 100,
                background: 'rgba(15, 5, 35, 0.92)', color: '#E8E8E8', fontSize: '10px',
                padding: '7px 9px', borderRadius: '5px', boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                maxWidth: '210px', border: '1px solid hsla(var(--brand-purple), 0.8)', backdropFilter: 'blur(3px)'
            }} >
            <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/25 pb-1">
                {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsAltH:: " /> : <VibeContentRenderer content="::FaShareAlt:: " />}
                {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,4)} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,4)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,7)}
                <span className="text-gray-400 ml-1.5">({hoveredOpportunity.currencyPair.substring(0,8)})</span>
            </p>
            <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p>
            <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p>
            <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p>
            <p className="leading-tight"><strong className="text-gray-400 w-[45px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p>
            <p className="mt-1.5 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,10)}...</p>
        </div>
      )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };