"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Box, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ArbitrageOpportunity } from '@/app/elon/arbitrage_scanner_types'; // Adjusted path
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // For icons in tooltip

interface ProcessedOpportunity extends ArbitrageOpportunity {
  x: number;
  y: number;
  z: number;
  colorValue: string; // Hex color string
  sizeValue: number; // For voxel size
  riskScore?: number; // Optional
}

// Helper to normalize a value to a 0-1 range, then scale for plot
const normalizeAndScale = (value: number, minVal: number, maxVal: number, scaleFactor: number = 10, offset: number = -5) => {
  if (maxVal === minVal) return offset + scaleFactor / 2; // Avoid division by zero, center it
  const normalized = (value - minVal) / (maxVal - minVal);
  return normalized * scaleFactor + offset;
};

const Voxel: React.FC<ThreeElements['mesh'] & { opportunity: ProcessedOpportunity, onHover: (op: ProcessedOpportunity | null) => void }> = (props) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [clicked, setClick] = useState(false);

  useFrame((state, delta) => {
    if (meshRef.current && hovered) {
      // Optional: slight animation on hover
      // meshRef.current.rotation.x += delta * 0.5;
      // meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Box
      {...props}
      ref={meshRef}
      args={[props.opportunity.sizeValue, props.opportunity.sizeValue, props.opportunity.sizeValue]} // Use sizeValue for args
      scale={clicked ? 1.5 : 1}
      onClick={(event) => { event.stopPropagation(); setClick(!clicked); props.onHover(props.opportunity); }}
      onPointerOver={(event) => { event.stopPropagation(); setHover(true); props.onHover(props.opportunity); (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('orange');}}
      onPointerOut={(event) => { event.stopPropagation(); setHover(false); props.onHover(null); (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set('black');}}
    >
      <meshStandardMaterial color={props.opportunity.colorValue} emissiveIntensity={hovered ? 0.7 : 0} />
    </Box>
  );
};


const ArbitrageVoxelPlot: React.FC<{ opportunities: ArbitrageOpportunity[] }> = ({ opportunities }) => {
  const [hoveredOpportunity, setHoveredOpportunity] = useState<ProcessedOpportunity | null>(null);

  const processedOpportunities = useMemo(() => {
    if (!opportunities || opportunities.length === 0) return [];

    const rewardScores = opportunities.map(op => op.profitPercentage);
    const minReward = Math.min(...rewardScores, 0); // Include 0 in min for better baseline
    const maxReward = Math.max(...rewardScores, 0.1); // Ensure max is at least a bit above 0

    return opportunities.map(op => {
      // Simplified EERR calculation - THIS NEEDS DEEP REFINEMENT from our "Not Dummies" page
      const rewardScore = op.profitPercentage;
      
      // Ezness: Higher volume, lower network fee, 2-leg is easier
      const eznessScore = 
        (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.5 +  // Max 50k volume for this factor
        (1 - Math.min(op.networkFeeUSD, 50) / 50) * 0.3 + // Max 50$ fee for this factor
        (op.type === '2-leg' ? 0.2 : 0.05);

      // Effort: Higher volume, 3-leg is harder
      const effortScore = 
        (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.6 + 
        (op.type === '3-leg' ? 0.4 : 0.1);
      
      const riskScore = parseFloat((effortScore / (eznessScore > 0 ? eznessScore : 0.01)).toFixed(2));

      let color = '#8A2BE2'; // Default: BlueViolet
      if (riskScore < 1.5 && rewardScore > 0.5) color = '#32CD32'; // LimeGreen (Low Risk, Good Reward - Alpha Zone)
      else if (riskScore > 3.5) color = '#FF6347'; // Tomato (High Risk)
      else if (rewardScore < 0.2) color = '#FFD700'; // Gold (Low Reward, maybe Routine)

      const size = Math.max(0.1, Math.min(1, op.tradeVolumeUSD / 20000 + 0.1)); // Scale size by volume

      return {
        ...op,
        x: rewardScore,
        y: eznessScore,
        z: 1 / (effortScore > 0 ? effortScore : 0.01), // Inverse Effort
        colorValue: color,
        sizeValue: size,
        riskScore: riskScore,
      };
    });
  }, [opportunities]);

  // Determine axis boundaries for scaling
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
    return <p className="text-center text-muted-foreground p-8">No opportunities to visualize. Run simulation.</p>;
  }
  
  return (
    <div style={{ height: '600px', width: '100%', background: 'hsl(var(--dark-card))', borderRadius: '8px', position: 'relative' }} className="border border-brand-blue/50">
      <Canvas camera={{ position: [7, 7, 10], fov: 55 }} shadows>
        <ambientLight intensity={0.7} />
        <pointLight position={[15, 15, 15]} intensity={1.2} castShadow />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        
        {/* Axes - More refined labels would be good */}
        <axesHelper args={[6]} /> {/* Scale based on plot scale */}
        <Text position={[6.5, 0, 0]} fontSize={0.3} color="white" anchorX="left">Reward (X)</Text>
        <Text position={[0, 6.5, 0]} fontSize={0.3} color="white" anchorX="middle" anchorY="top">Ezness (Y)</Text>
        <Text position={[0, 0, 6.5]} fontSize={0.3} color="white" rotation={[0, Math.PI/2, 0]} anchorX="right">1/Effort (Z)</Text>


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
            castShadow
            receiveShadow
          />
        ))}
        <gridHelper args={[10, 10, '#555', '#333']} position={[0, -5.1, 0]} /> {/* Grid on XZ plane below origin */}
      </Canvas>
      {hoveredOpportunity && (
        <Html positionType="absolute" wrapperClass="voxel-tooltip-wrapper" style={{ pointerEvents: 'none' }}>
            <div className="bg-black/80 text-white text-xs p-2 rounded-md shadow-lg max-w-xs border border-brand-purple backdrop-blur-sm">
                <p className="font-bold text-brand-cyan text-sm mb-0.5">
                  {hoveredOpportunity.type === '2-leg' ? `2-Leg: ${hoveredOpportunity.currencyPair}` : `3-Leg: ${hoveredOpportunity.currencyPair}`}
                </p>
                <p><VibeContentRenderer content="::FaPercentage::" /> Spread: {hoveredOpportunity.profitPercentage.toFixed(3)}%</p>
                <p><VibeContentRenderer content="::FaDollarSign::" /> Profit: ${hoveredOpportunity.potentialProfitUSD.toFixed(2)}</p>
                <p>Volume: ${hoveredOpportunity.tradeVolumeUSD}</p>
                <p>X (Reward): {hoveredOpportunity.x.toFixed(2)}</p>
                <p>Y (Ezness): {hoveredOpportunity.y.toFixed(2)}</p>
                <p>Z (1/Effort): {hoveredOpportunity.z.toFixed(2)}</p>
                <p>Risk Score: {hoveredOpportunity.riskScore?.toFixed(2) ?? 'N/A'}</p>
                {/* <p className="mt-1 text-gray-400 text-[0.65rem] break-all">{hoveredOpportunity.details}</p> */}
            </div>
        </Html>
      )}
       <style jsx global>{`
        .voxel-tooltip-wrapper {
          position: fixed; /* Use fixed to overlay everything */
          top: 10px;
          left: 10px;
          transform: none !important; /* Override R3F positioning */
          z-index: 100;
        }
      `}</style>
    </div>
  );
};

// Make sure the component is default exported for React.lazy
export { ArbitrageVoxelPlot as default };