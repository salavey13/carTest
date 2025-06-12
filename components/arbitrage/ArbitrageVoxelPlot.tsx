"use client";

import React, { useEffect, useState } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';
// НЕ ИМПОРТИРУЕМ R3F/THREE ЗДЕСЬ НА ТОП-УРОВНЕ ПОКА ЧТО

logger.debug("[ArbitrageVoxelPlot.tsx] File loaded by browser, component definition is being parsed. NO R3F IMPORTS YET.");

// Import ProcessedSandboxOpportunity from the sandbox page directly for strong typing
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';

const ArbitrageVoxelPlot: React.FC<{ opportunities: ProcessedSandboxOpportunity[] }> = ({ opportunities }) => {
  logger.info("[ArbitrageVoxelPlot] Component FUNCTION CALLED. Opportunities count:", opportunities.length);
  const [isTrulyClient, setIsTrulyClient] = useState(false);
  const [R3FComponents, setR3FComponents] = useState<any>(null); // Store dynamically imported components

  useEffect(() => {
    logger.debug("[ArbitrageVoxelPlot] useEffect for isTrulyClient. Setting to true.");
    setIsTrulyClient(true);

    // Попытка динамического импорта R3F/Three УЖЕ ВНУТРИ КЛИЕНТСКОГО useEffect
    const loadR3F = async () => {
      logger.debug("[ArbitrageVoxelPlot] Attempting ASYNC import of R3F/Three components INSIDE useEffect...");
      try {
        const THREE_MOD = await import('three');
        const R3F_MOD = await import('@react-three/fiber');
        const DREI_MOD = await import('@react-three/drei');
        logger.debug("[ArbitrageVoxelPlot] ASYNC R3F/Three components IMPORTED SUCCESSFULLY.");
        setR3FComponents({
          THREE: THREE_MOD,
          Canvas: R3F_MOD.Canvas,
          useThree: R3F_MOD.useThree,
          OrbitControls: DREI_MOD.OrbitControls,
          Box: DREI_MOD.Box,
          Text: DREI_MOD.Text,
          Html: DREI_MOD.Html,
          // Добавь сюда другие нужные компоненты из drei/fiber
        });
      } catch (err) {
        logger.error("[ArbitrageVoxelPlot] FAILED to ASYNC import R3F/Three components:", err);
        setR3FComponents({ error: err }); // Store error state
      }
    };

    if (typeof window !== 'undefined') { // Дополнительная проверка на клиент
        loadR3F();
    }

    return () => {
        logger.debug("[ArbitrageVoxelPlot] useEffect for isTrulyClient: Unmounting.");
    }
  }, []); 

  if (!isTrulyClient) {
    logger.warn("[ArbitrageVoxelPlot] PRE-RENDER GUARD: Not truly client-side yet, rendering placeholder.");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-cyan animate-pulse">Waiting for Full Client Hydration for 3D...</p></div>;
  }

  if (!R3FComponents) {
    logger.debug("[ArbitrageVoxelPlot] R3F components not loaded yet, rendering loading state...");
    return <div className="min-h-[600px] flex items-center justify-center bg-gray-800/30 rounded-md"><p className="text-brand-orange animate-pulse">Loading 3D Libraries...</p></div>;
  }

  if (R3FComponents.error) {
    logger.error("[ArbitrageVoxelPlot] Error loading R3F components, rendering error message:", R3FComponents.error);
    return <div className="min-h-[600px] flex flex-col items-center justify-center bg-red-900/30 rounded-md p-4 text-red-400"><p className="font-bold">Error loading 3D libraries:</p><pre className="text-xs whitespace-pre-wrap">{String(R3FComponents.error)}</pre></div>;
  }
  
  // Если мы дошли сюда, значит R3FComponents ЗАГРУЖЕНЫ
  const { Canvas, Box, OrbitControls, Text, Html } = R3FComponents; // Деструктурируем нужные компоненты

  // --- Внутренние компоненты (Voxel, SceneContent) и логика useMemo для осей ---
  // Они теперь должны использовать Canvas, Box и т.д. из R3FComponents
  // Для краткости, я не буду повторять их код здесь, но они должны быть такими же, как в предыдущем ответе,
  // просто убедись, что они используют компоненты из R3FComponents, а не прямые импорты с топ-уровня.

  // Пример того, как мог бы выглядеть SceneContent с динамически загруженными компонентами
  const DynamicSceneContent: React.FC<any> = ({ /* props */ processedOpportunities, setHoveredOpportunity, minX, maxX, minY, maxY, minZ, maxZ }) => {
    logger.debug("[DynamicSceneContent] Rendering with dynamically loaded R3F. Opportunities:", processedOpportunities.length);
    // ... (здесь код SceneContent, использующий Box, Text, OrbitControls из R3FComponents)
    // Вместо прямого <Box>, используй <R3FComponents.Box> или просто Box, если деструктурировал выше
    return (
        <>
            <ambientLight intensity={0.7} /> 
            <directionalLight position={[15, 20, 15]} intensity={1.2} castShadow />
            <R3FComponents.OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={true} minDistance={2} maxDistance={40} target={[0,0,0]} />
            {/* ... остальная часть сцены ... */}
            {processedOpportunities.map((pOp: ProcessedSandboxOpportunity) => {
                 const posX = normalizeAndScale(pOp.x_reward, minX, maxX, 10, -5);
                 const posY = normalizeAndScale(pOp.y_ezness, minY, maxY, 10, -5);
                 const posZ = normalizeAndScale(pOp.z_inv_effort, minZ, maxZ, 10, -5);
                 const safeSize = Math.max(0.01, pOp.sizeValue);
                if (isNaN(posX) || isNaN(posY) || isNaN(posZ) || isNaN(safeSize)) return null;
                return (
                    <R3FComponents.Box key={pOp.id} position={[posX, posY, posZ]} args={[safeSize,safeSize,safeSize]}>
                        <meshStandardMaterial color={pOp.colorValue} />
                    </R3FComponents.Box>
                )
            })}
            <gridHelper args={[10, 10, '#383838', '#202020']} position={[0, -5.05, 0]} />
        </>
    );
  };
  
  const { minX, maxX, minY, maxY, minZ, maxZ } = useMemo(() => {
    if (opportunities.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const xs = opportunities.map(p => p.x_reward); const ys = opportunities.map(p => p.y_ezness); const zs = opportunities.map(p => p.z_inv_effort);
    return { minX: Math.min(...xs, 0), maxX: Math.max(...xs, 0.1), minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0.1), minZ: Math.min(...zs, 0), maxZ: Math.max(...zs, 0.1) };
  }, [opportunities]);


  if (opportunities.length === 0) {
    logger.debug("[ArbitrageVoxelPlot] No opportunities to display, rendering placeholder (client is ready).");
    return <p className="text-center text-muted-foreground p-8 min-h-[600px] flex items-center justify-center">No opportunities to visualize based on current filters. Adjust filters or run simulation.</p>;
  }
  
  logger.debug(`[ArbitrageVoxelPlot] Client is ready, R3F libs loaded. Rendering Canvas with ${opportunities.length} opportunities.`);
  return (
    <div style={{ height: '600px', width: '100%', background: 'rgba(10, 2, 28, 0.9)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }} className="border border-brand-blue/60 shadow-lg shadow-brand-blue/20">
      <Canvas dpr={[1, 1.5]} camera={{ position: [8, 7, 12], fov: 50, near: 0.1, far: 1000 }} shadows >
        {/* Замени SceneContent на DynamicSceneContent или адаптируй SceneContent для использования R3FComponents */}
        <DynamicSceneContent 
          processedOpportunities={opportunities} 
          setHoveredOpportunity={() => {}} // Placeholder, т.к. Voxel и Tooltip пока убраны для теста
          minX={minX} maxX={maxX} minY={minY} maxY={maxY} minZ={minZ} maxZ={maxZ}
        />
      </Canvas>
      {/* Tooltip пока убран для максимального упрощения */}
    </div>
  );
};

export { ArbitrageVoxelPlot as default };