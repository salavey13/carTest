"use client";

import React, { useRef, useMemo, useState, useEffect } from 'react'; // Added useEffect
import { Canvas, useFrame, ThreeElements, useThree } from '@react-three/fiber'; // Added useThree
import { OrbitControls, Box, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { logger } from '@/lib/logger'; // Using standard logger

interface ProcessedOpportunity extends ArbitrageOpportunity {
  x: number;
  y: number;
  z: number;
  colorValue: string;
  sizeValue: number;
  riskScore?: number;
}

const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal) return offset + scaleFactor / 2;
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

const Voxel: React.FC<ThreeElements['mesh'] & { opportunity: ProcessedOpportunity, onHover: (op: ProcessedOpportunity | null) => void }> = (props) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  // const [clicked, setClick] = useState(false); // Removed clicked state for simplicity now

  // It's good practice to check if meshRef.current and material exist
  const handlePointerOver = (event: any) => {
    event.stopPropagation();
    setHover(true);
    props.onHover(props.opportunity);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('orange');
    }
  };

  const handlePointerOut = (event: any) => {
    event.stopPropagation();
    setHover(false);
    props.onHover(null);
    if (meshRef.current?.material && (meshRef.current.material as THREE.MeshStandardMaterial).emissive) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('black');
    }
  };
  
  const handleClick = (event: any) => {
    event.stopPropagation();
    // setClick(!clicked); // Re-enable if needed
    props.onHover(props.opportunity); // Keep showing tooltip on click
    logger.debug("Voxel clicked:", props.opportunity);
  };


  return (
    <Box
      {...props}
      ref={meshRef}
      args={[props.opportunity.sizeValue, props.opportunity.sizeValue, props.opportunity.sizeValue]}
      // scale={clicked ? 1.5 : 1} // Re-enable if clicked state is used
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={props.opportunity.colorValue} emissiveIntensity={hovered ? 0.7 : 0} />
    </Box>
  );
};

const SceneContent: React.FC<{ processedOpportunities: ProcessedOpportunity[], setHoveredOpportunity: (op: ProcessedOpportunity | null) => void, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }> = ({
  processedOpportunities, setHoveredOpportunity, minX, maxX, minY, maxY, minZ, maxZ
}) => {
  const { scene } = useThree(); // Access the scene object

  useEffect(() => {
    // You can perform scene-specific setup here if needed
    // For example, setting background color, fog, etc.
    // scene.background = new THREE.Color('hsl(var(--dark-card))'); // Example, ensure HSL parsing if used
    return () => {
      // Cleanup scene elements if necessary when component unmounts
    };
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.8} /> {/* Slightly increased ambient light */}
      <directionalLight position={[10, 15, 10]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={2} maxDistance={50} />
      
      <axesHelper args={[6]} />
      <Text position={[6.5, 0.1, 0]} fontSize={0.25} color="white" anchorX="left">Reward (X)</Text>
      <Text position={[0.1, 6.5, 0]} fontSize={0.25} color="white" anchorX="left" anchorY="top" rotation={[0,0,Math.PI/2]}>Ezness (Y)</Text>
      <Text position={[0.1, 0, 6.5]} fontSize={0.25} color="white" rotation={[0, Math.PI/2, 0]} anchorY="bottom" anchorX="left">1/Effort (Z)</Text>

      {processedOpportunities.map((pOp) => (
        <Voxel
          key={pOp.id}
          opportunity={pOp}
          onHover={setHoveredOpportunity}
          position={[
            normalizeAndScale(pOp.x, minX, maxX, 10, -5),
            normalizeAndScale(pOp.y, minY, maxY, 10, -5),
            normalizeAndScale(pOp.z, minZ, maxZ, 10, -5)
          ]}
        />
      ))}
      <gridHelper args={[10, 10, '#444', '#222']} position={[0, -5.1, 0]} />
    </>
  );
};


const ArbitrageVoxelPlot: React.FC<{ opportunities: ArbitrageOpportunity[] }> = ({ opportunities }) => {
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedOpportunity | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setIsClientReady(true); // Ensure this runs only on client
  }, []);

  const processedOpportunities = useMemo(() => {
    if (!opportunities || opportunities.length === 0) return [];
    logger.debug("[VoxelPlot] Processing opportunities for memo:", opportunities.length);

    return opportunities.map(op => {
      const rewardScore = op.profitPercentage;
      
      const eznessScore = 
        (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.4 +
        (1 - Math.min((op as TwoLegArbitrageOpportunity).networkFeeUSD || 0, 50) / 50) * 0.4 + // Ensure networkFeeUSD exists
        (op.type === '2-leg' ? 0.2 : 0.05);

      const effortScore = 
        (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.5 + 
        (op.type === '3-leg' ? 0.4 : 0.1) +
        (((op as TwoLegArbitrageOpportunity).buyFeePercentage || 0) + ((op as TwoLegArbitrageOpportunity).sellFeePercentage || 0)) / 200 * 0.1; // Add fee impact

      const riskScore = parseFloat((effortScore / (eznessScore > 0.01 ? eznessScore : 0.01)).toFixed(2));

      let color = '#8A2BE2'; // BlueViolet (Default/Mid-Risk)
      if (rewardScore < 0.1) color = '#A9A9A9'; // DarkGray (Very Low Reward)
      else if (riskScore < 1.0 && rewardScore > 0.3) color = '#32CD32'; // LimeGreen (Low Risk, Good Reward - Alpha)
      else if (riskScore < 2.0 && rewardScore > 0.2) color = '#FFD700'; // Gold (Moderate Risk/Reward)
      else if (riskScore > 3.0) color = '#FF6347'; // Tomato (High Risk)
      else if (rewardScore > 0.5 && riskScore <= 2.5) color = '#1E90FF'; // DodgerBlue (Good Reward, Manageable Risk)


      const size = Math.max(0.15, Math.min(0.8, op.tradeVolumeUSD / 15000 + 0.1));

      return {
        ...op,
        x: rewardScore,
        y: eznessScore,
        z: 1 / (effortScore > 0.01 ? effortScore : 0.01),
        colorValue: color,
        sizeValue: size,
        riskScore: riskScore,
      };
    });
  }, [opportunities]);

  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    if (processedOpportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const xs = processedOpportunities.map(p => p.x);
    const ys = processedOpportunities.map(p => p.y);
    const zs = processedOpportunities.map(p => p.z);
    return {
      minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1),
      minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1),
      minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1)
    };
  }, [processedOpportunities]);

  if (opportunities.length === 0) {
    return <p className="text-center text-muted-foreground p-8 min-h-[400px] flex items-center justify-center">No opportunities to visualize. Run simulation.</p>;
  }
  
  if (!isClientReady) { // Prevent SSR/Pre-client mount rendering of Canvas
    return <div className="min-h-[400px] flex items-center justify-center"><p>Initializing 3D Canvas...</p></div>;
  }

  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.7)', borderRadius: '8px', position: 'relative' }} className="border border-brand-blue/50">
      <Canvas dpr={[1, 2]} camera={{ position: [8, 8, 12], fov: 50, near: 0.1, far: 1000 }} shadows >
        <SceneContent 
          processedOpportunities={processedOpportunities} 
          setHoveredOpportunity={setHoveredOpportunity}
          minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
        />
      </Canvas>
      {hoveredOpportunity && (
        <div 
            className="voxel-tooltip-wrapper" 
            style={{ 
                position: 'absolute', 
                top: '15px', 
                left: '15px', 
                pointerEvents: 'none', 
                zIndex: 100,
                background: 'rgba(0,0,0,0.85)',
                color: 'white',
                fontSize: '11px',
                padding: '8px 10px',
                borderRadius: '6px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                maxWidth: '220px',
                border: '1px solid hsl(var(--brand-purple))',
                backdropFilter: 'blur(3px)'
            }}
        >
            <p className="font-bold text-brand-cyan text-xs mb-1 border-b border-brand-cyan/30 pb-0.5">
                {hoveredOpportunity.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsLeftRight:: " /> : <VibeContentRenderer content="::FaRandom:: " />}
                {hoveredOpportunity.type === '2-leg' ? `${(hoveredOpportunity as TwoLegArbitrageOpportunity).buyExchange} → ${(hoveredOpportunity as TwoLegArbitrageOpportunity).sellExchange}` : (hoveredOpportunity as ThreeLegArbitrageOpportunity).exchange}
            </p>
            <p className="mb-0.5"><strong className="text-gray-400">Pair:</strong> {hoveredOpportunity.currencyPair}</p>
            <p className="mb-0.5"><strong className="text-gray-400">Spread:</strong> <span className="text-brand-lime">{hoveredOpportunity.profitPercentage.toFixed(3)}%</span></p>
            <p className="mb-0.5"><strong className="text-gray-400">Profit:</strong> <span className="text-brand-lime">${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</span></p>
            <p className="mb-0.5"><strong className="text-gray-400">Volume:</strong> ${hoveredOpportunity.tradeVolumeUSD}</p>
            <p className="mb-0.5"><strong className="text-gray-400">Risk Score:</strong> {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p>
            <p className="mt-1 text-[0.65rem] text-gray-500 opacity-80">ID: {hoveredOpportunity.id.substring(0,13)}</p>
        </div>
      )}
    </div>
  );
};

export { ArbitrageVoxelPlot as default }; // Ensure default export for React.lazy