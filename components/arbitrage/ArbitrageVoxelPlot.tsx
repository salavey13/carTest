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
  if (maxVal === minVal) return offset + scaleFactor / 2;
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

interface VoxelProps extends ThreeElements['mesh'] {
  opportunity: ProcessedSandboxOpportunity; // Use the imported type
  onHover: (op: ProcessedSandboxOpportunity | null) => void;
}

const Voxel: React.FC<VoxelProps> = (props) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  
  const { opportunity, onHover, ...restBoxProps } = props; // Destructure opportunity and onHover

  useEffect(() => {
    // logger.debug(`[Voxel ${opportunity.id.substring(0,4)}] Mounted. Size: ${opportunity.sizeValue}, Color: ${opportunity.colorValue}`);
    // Optional: Add a small random offset to initial rotation to break uniformity if many voxels overlap
    if (meshRef.current) {
        meshRef.current.rotation.x = Math.random() * 0.1;
        meshRef.current.rotation.y = Math.random() * 0.1;
    }
  }, [opportunity.id, opportunity.sizeValue, opportunity.colorValue]);


  const handlePointerOver = (event: any) => {
    event.stopPropagation();
    setHover(true);
    onHover(opportunity);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('darkorange'); // Brighter hover
    }
  };

  const handlePointerOut = (event: any) => {
    event.stopPropagation();
    setHover(false);
    onHover(null);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(0x000000); // Black (no emission)
    }
  };
  
  const handleClick = (event: any) => {
    event.stopPropagation();
    onHover(opportunity); 
    logger.debug("[Voxel] Clicked:", opportunity);
  };

  // Ensure sizeValue is a positive number for Box args
  const safeSize = Math.max(0.01, opportunity.sizeValue);


  return (
    <Box
      {...restBoxProps} // Spread the rest of the props (like position)
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
        emissiveIntensity={hovered ? 0.8 : 0} 
        roughness={0.6} 
        metalness={0.2}
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
  const { scene, gl, camera } = useThree(); // gl for renderer, camera for controls target

  useEffect(() => {
    logger.debug("[SceneContent] Mounted or props changed. Opportunities:", processedOpportunities.length);
    // scene.background = new THREE.Color(0x0A021C); // Dark purple, almost black
    // scene.fog = new THREE.FogExp2(0x0A021C, 0.05); // Subtle fog
    
    return () => {
      logger.debug("[SceneContent] Unmounting.");
    };
  }, [processedOpportunities, scene]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[15, 20, 10]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize-width={2048} // Higher res shadow map
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#5500ff" /> {/* Purple backlight */}
      <OrbitControls 
        makeDefault // Important for multiple OrbitControls or if it's conditional
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true} 
        minDistance={3} 
        maxDistance={30}
        target={[0,0,0]} // Ensure controls target the center of your scene
      />
      
      <axesHelper args={[5.5]} /> {/* Adjusted scale */}
      <Text position={[6, 0.1, 0]} fontSize={0.2} color="#E0E0E0" anchorX="left">X: Reward</Text>
      <Text position={[0.1, 6, 0]} fontSize={0.2} color="#E0E0E0" anchorX="left" anchorY="top" rotation={[0,0,Math.PI/2]}>Y: Ezness</Text>
      <Text position={[0.1, 0, 6]} fontSize={0.2} color="#E0E0E0" rotation={[0, Math.PI/2, 0]} anchorY="bottom" anchorX="left">Z: 1/Effort</Text>

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
      <gridHelper args={[10, 10, '#333', '#1a1a1a']} position={[0, -5.05, 0]} />
    </>
  );
};

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.debug("[ArbitrageVoxelPlot] Component rendering. Opportunities count:", opportunities.length);
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    logger.debug("[ArbitrageVoxelPlot] useEffect for isClientReady. Setting to true.");
    setIsClientReady(true);
    return () => {
        logger.debug("[ArbitrageVoxelPlot] Unmounting. isClientReady was:", isClientReady);
    }
  }, []);

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
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.85)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/50">
      <Canvas dpr={[1, 1.5]} camera={{ position: [7, 6, 11], fov: 50, near: 0.1, far: 100 }} shadows >
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
                background: 'rgba(15, 5, 35, 0.9)', color: '#E0E0E0', fontSize: '10px',
                padding: '6px 8px', borderRadius: '4px', boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
                maxWidth: '200px', border: '1px solid hsla(var(--brand-purple), 0.7)', backdropFilter: 'blur(2px)'
            }} >
            <p className="font-bold text-brand-cyan text-[11px] mb-1 border-b border-brand-cyan/20 pb-0.5">
                {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsAltH:: " /> : <VibeContentRenderer content="::FaShareAlt:: " />}
                {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange.substring(0,3)}→${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange.substring(0,3)}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange.substring(0,6)}
                <span className="text-gray-400 ml-1">({hoveredOpportunity.currencyPair.substring(0,7)})</span>
            </p>
            <p><strong className="text-gray-400 w-[40px] inline-block">Spread:</strong> <span className="text-brand-lime font-semibold">{hoveredOpportunity.profitPercentage.toFixed(2)}%</span></p>
            <p><strong className="text-gray-400 w-[40px] inline-block">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p>
            <p><strong className="text-gray-400 w-[40px] inline-block">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p>
            <p><strong className="text-gray-400 w-[40px] inline-block">Risk:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p>
            <p className="mt-1 text-[9px] text-gray-500 opacity-70">ID: {hoveredOpportunity.id.substring(0,8)}</p>
        </div>
      )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };