"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { FaGlobeAmericas, FaAtlas } from "react-icons/fa"; // Specific imports
import {
    FaMapLocationDot,
    FaCompass,
    FaRulerCombined,
    FaMountain,
    FaUserSecret,
    FaWater,
    FaCloudSunRain,
    FaTree,
    FaPaw,
    FaGlobe,
    FaTable,
    FaRegCompass,
    FaImage,
    FaUsers
} from "react-icons/fa6"; // Use FaRegCompass instead of FaCompass if preferred for azimuth
import Link from "next/link";
import Image from "next/image";
import { translations } from '@/lib/translations/geography_vpr_cheatsheet'; // Import translations

// --- Component ---
const VprGeographyCheatsheet: React.FC = () => {
  // Assuming 'ru' for now, can be dynamic later
  const t = translations.ru;

  // Tooltip descriptions for image placeholders - using translations
  const tooltipDescriptions: Record<string, string> = t.tooltips;


  return (
    <div className="relative min-h-screen overflow-hidden pt-16 pb-8 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-300">
       {/* Subtle background grid */}
       <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px', // Smaller grid
        }}
      ></div>

      <TooltipProvider delayDuration={150}>
          <div className="relative z-10 container mx-auto px-2 md:px-4">
            {/* Main Card styling */}
            <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-sm text-white rounded-xl border border-brand-green/20 shadow-[0_0_20px_rgba(0,255,157,0.3)]">
              <CardHeader className="text-center border-b border-brand-green/15 pb-3 pt-4">
                {/* Title with glitch effect */}
                <CardTitle className="text-2xl md:text-4xl font-bold text-brand-green cyber-text glitch" data-text={t.mainTitle}>
                 {t.mainTitle}
                </CardTitle>
                 {/* Subtitle */}
                <p className="text-xs md:text-sm text-gray-400 mt-2 font-mono">
                  {t.mainSubtitle}
                </p>
              </CardHeader>

              {/* Content Area */}
              <CardContent className="space-y-8 p-3 md:p-6 text-sm md:text-base"> {/* Smaller base font size */}

                {/* Section: Карта Мира */}
                <section className="space-y-3">
                  <h2 className="flex items-center text-lg md:text-xl font-semibold text-cyan-400 mb-3">
                    <FaGlobeAmericas className="mr-2 text-cyan-400/70 text-xl" /> {t.worldMap.title}
                  </h2>
                   {/* Subsection: Материки и Океаны */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-cyan-300 mt-4 mb-1"> <FaWater className="mr-2 text-cyan-300/70" /> {t.worldMap.continentsOceans.title} </h3>
                   <p className="text-gray-300 text-xs md:text-sm">{t.worldMap.continentsOceans.description}</p>
                   <div className="my-4 p-1 border border-cyan-500/20 rounded-md bg-black/20">
                     <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                           <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//continents-99913414-d4cb-4624-9779-6a7498cbf67a.png" alt={t.worldMap.continentsOceans.imageAlt} width={600} height={338} className="w-full h-full object-cover" loading="lazy"/>
                         </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-cyan-500/50 text-white p-1.5 text-xs">
                          <p>{tooltipDescriptions['geo-continents.png']}</p>
                      </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.worldMap.continentsOceans.imageCaption}</p>
                   </div>

                   {/* Subsection: Координаты и Направления */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-cyan-300 mt-4 mb-1"> <FaCompass className="mr-2 text-cyan-300/70" /> {t.worldMap.coordinatesDirections.title} </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                      <li>{t.worldMap.coordinatesDirections.point1}</li>
                      <li>{t.worldMap.coordinatesDirections.point2}</li>
                   </ul>
                   <div className="my-4 p-1 border border-cyan-500/20 rounded-md bg-black/20 max-w-xs mx-auto">
                     <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                           <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//latitude-d685bb88-e694-408c-b01d-d285edc6ff29.png" alt={t.worldMap.coordinatesDirections.imageAlt} width={400} height={400} className="w-full h-full object-cover" loading="lazy"/>
                         </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-cyan-500/50 text-white p-1.5 text-xs">
                         <p>{tooltipDescriptions['geo-coordinates.png']}</p>
                      </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.worldMap.coordinatesDirections.imageCaption}</p>
                   </div>

                   {/* Subsection: Путешественники */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-cyan-300 mt-4 mb-1"> <FaUserSecret className="mr-2 text-cyan-300/70" /> {t.worldMap.explorers.title} </h3>
                   <p className="text-gray-300 text-xs md:text-sm">{t.worldMap.explorers.description}</p>
                   <div className="my-4 p-1 border border-cyan-500/20 rounded-md bg-black/20">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                          <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/explorers-673a4b3e-1fdb-42e3-bc14-990493afe92d.png" alt={t.worldMap.explorers.imageAlt} width={400} height={400} className="w-full h-full object-cover" loading="lazy"/>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-cyan-500/50 text-white p-1.5 text-xs">
                          <p>{tooltipDescriptions['geo-explorers.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-500 mt-1 italic">{t.worldMap.explorers.imageCaption}</p>
                   </div>

                   {/* Subsection: Географические Объекты */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-cyan-300 mt-4 mb-1"> <FaImage className="mr-2 text-cyan-300/70" /> {t.worldMap.geoObjects.title} </h3>
                   <p className="text-gray-300 text-xs md:text-sm">{t.worldMap.geoObjects.description}</p>
                </section>

                {/* Section: Топографическая Карта */}
                <section className="space-y-3 border-t border-orange-500/15 pt-6">
                  <h2 className="flex items-center text-lg md:text-xl font-semibold text-orange-400 mb-3">
                    <FaMapLocationDot className="mr-2 text-orange-400/70 text-xl" /> {t.topoMap.title}
                  </h2>
                   {/* Subsection: Масштаб и Расстояния */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-orange-300 mt-4 mb-1"> <FaRulerCombined className="mr-2 text-orange-300/70" /> {t.topoMap.scaleDistance.title} </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                     <li>{t.topoMap.scaleDistance.point1}</li>
                     <li>{t.topoMap.scaleDistance.point2}</li>
                     <li>{t.topoMap.scaleDistance.point3}</li>
                   </ul>
                   <div className="my-4 p-1 border border-orange-500/20 rounded-md bg-black/20">
                     <Tooltip>
                       <TooltipTrigger asChild>
                          <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//IMG_20250420_010735.jpg" alt={t.topoMap.scaleDistance.imageAlt} width={600} height={338} className="w-full h-full object-cover" loading="lazy"/>
                          </div>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-orange-500/50 text-white p-1.5 text-xs">
                           <p>{tooltipDescriptions['IMG_20250420_010735.jpg']}</p>
                       </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.topoMap.scaleDistance.imageCaption}</p>
                   </div>

                   {/* Subsection: Направления и Азимут */}
                   <h3 className="flex items-center text-base md:text-lg font-medium text-orange-300 mt-4 mb-1"> <FaRegCompass className="mr-2 text-orange-300/70" /> {t.topoMap.directionsAzimuth.title} </h3>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                     <li>{t.topoMap.directionsAzimuth.point1}</li>
                     <li>{t.topoMap.directionsAzimuth.point2}</li>
                     <li>{t.topoMap.directionsAzimuth.point3}</li>
                   </ul>
                   <div className="my-4 p-1 border border-orange-500/20 rounded-md bg-black/20 max-w-xs mx-auto">
                     <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//IMG_20250420_010521.jpg" alt={t.topoMap.directionsAzimuth.imageAlt} width={400} height={400} className="w-full h-full object-cover" loading="lazy"/>
                         </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-orange-500/50 text-white p-1.5 text-xs">
                          <p>{tooltipDescriptions['IMG_20250420_010521.jpg']}</p>
                      </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.topoMap.directionsAzimuth.imageCaption}</p>
                   </div>

                  {/* Subsection: Рельеф и Условные Знаки */}
                  <h3 className="flex items-center text-base md:text-lg font-medium text-orange-300 mt-4 mb-1"> <FaMountain className="mr-2 text-orange-300/70" /> {t.topoMap.reliefSigns.title} </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                    <li>{t.topoMap.reliefSigns.point1}</li>
                    <li>{t.topoMap.reliefSigns.point2}</li>
                    <li>{t.topoMap.reliefSigns.point3}</li>
                  </ul>
                  <div className="my-4 p-1 border border-orange-500/20 rounded-md bg-black/20">
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//3topo.png" alt={t.topoMap.reliefSigns.imageAlt} width={600} height={338} className="w-full h-full object-cover" loading="lazy"/>
                         </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-orange-500/50 text-white p-1.5 text-xs">
                          <p>{tooltipDescriptions['3topo.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-500 mt-1 italic">{t.topoMap.reliefSigns.imageCaption}</p>
                  </div>
                </section>

                {/* Section: Природа Земли */}
                <section className="space-y-3 border-t border-green-500/15 pt-6">
                  <h2 className="flex items-center text-lg md:text-xl font-semibold text-green-400 mb-3">
                    <FaTree className="mr-2 text-green-400/70 text-xl" /> {t.nature.title}
                  </h2>
                  {/* Subsection: Природные Зоны */}
                  <h3 className="flex items-center text-base md:text-lg font-medium text-green-300 mt-4 mb-1"> <FaPaw className="mr-2 text-green-300/70" /> {t.nature.naturalZones.title} </h3>
                  <p className="text-gray-300 text-xs md:text-sm">{t.nature.naturalZones.description}</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                    <li>{t.nature.naturalZones.example1}</li>
                    <li>{t.nature.naturalZones.example2}</li>
                     {/* Add more examples if needed */}
                  </ul>
                  <div className="my-4 p-1 border border-green-500/20 rounded-md bg-black/20">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help relative">
                           {/* Placeholder styling */}
                           <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center">
                             <FaImage className="text-gray-500 text-4xl" />
                           </div>
                           <Image src="/placeholders/geo-natural-zones.png" alt={t.nature.naturalZones.imageAlt} width={600} height={338} className="w-full h-full object-cover opacity-40" loading="lazy"/>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-green-500/50 text-white p-1.5 text-xs">
                          <p>{tooltipDescriptions['geo-natural-zones.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-500 mt-1 italic">{t.nature.naturalZones.imageCaption}</p>
                  </div>

                  {/* Subsection: Погода и Климат */}
                  <h3 className="flex items-center text-base md:text-lg font-medium text-green-300 mt-4 mb-1"> <FaCloudSunRain className="mr-2 text-green-300/70" /> {t.nature.weatherClimate.title} </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                    <li>{t.nature.weatherClimate.point1}</li>
                    <li>{t.nature.weatherClimate.point2}</li>
                    <li>{t.nature.weatherClimate.point3}</li>
                    <li>{t.nature.weatherClimate.point4}</li>
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                     {/* Weather Symbols Placeholder */}
                     <div className="p-1 border border-green-500/20 rounded-md bg-black/20">
                         <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help relative">
                              <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center"><FaImage className="text-gray-500 text-3xl" /></div>
                              <Image src="/placeholders/geo-weather-symbols.png" alt={t.nature.weatherClimate.imageAlt1} width={400} height={400} className="w-full h-full object-cover opacity-40" loading="lazy"/>
                           </div>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-green-500/50 text-white p-1.5 text-xs">
                            <p>{tooltipDescriptions['geo-weather-symbols.png']}</p>
                         </TooltipContent>
                         </Tooltip>
                         <p className="text-xs text-center text-gray-500 mt-1 italic">{t.nature.weatherClimate.imageCaption1}</p>
                     </div>
                     {/* Wind Rose Placeholder */}
                     <div className="p-1 border border-green-500/20 rounded-md bg-black/20">
                         <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="aspect-square w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help relative">
                             <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center"><FaImage className="text-gray-500 text-3xl" /></div>
                              <Image src="/placeholders/geo-wind-rose.png" alt={t.nature.weatherClimate.imageAlt2} width={400} height={400} className="w-full h-full object-cover opacity-40" loading="lazy"/>
                           </div>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-green-500/50 text-white p-1.5 text-xs">
                            <p>{tooltipDescriptions['geo-wind-rose.png']}</p>
                         </TooltipContent>
                         </Tooltip>
                         <p className="text-xs text-center text-gray-500 mt-1 italic">{t.nature.weatherClimate.imageCaption2}</p>
                     </div>
                  </div>

                  {/* Subsection: Географическая Оболочка */}
                  <h3 className="flex items-center text-base md:text-lg font-medium text-green-300 mt-4 mb-1"> <FaGlobe className="mr-2 text-green-300/70" /> {t.nature.geoShell.title} </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                    <li>{t.nature.geoShell.point1}</li>
                    <li>{t.nature.geoShell.point2}</li>
                    <li>{t.nature.geoShell.point3}</li>
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                    {/* Atmosphere Placeholder */}
                     <div className="p-1 border border-green-500/20 rounded-md bg-black/20">
                         <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help relative">
                              <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center"><FaImage className="text-gray-500 text-3xl" /></div>
                              <Image src="/placeholders/geo-atmosphere.png" alt={t.nature.geoShell.imageAlt1} width={400} height={225} className="w-full h-full object-cover opacity-40" loading="lazy"/>
                           </div>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-green-500/50 text-white p-1.5 text-xs">
                            <p>{tooltipDescriptions['geo-atmosphere.png']}</p>
                         </TooltipContent>
                         </Tooltip>
                         <p className="text-xs text-center text-gray-500 mt-1 italic">{t.nature.geoShell.imageCaption1}</p>
                     </div>
                     {/* Biosphere Image */}
                     <div className="p-1 border border-green-500/20 rounded-md bg-black/20">
                         <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/life-77b646d5-16f4-45e1-ab80-a810340f6c40.png" alt={t.nature.geoShell.imageAlt2} width={400} height={225} className="w-full h-full object-cover" loading="lazy"/>
                           </div>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[200px] bg-gray-950 border border-green-500/50 text-white p-1.5 text-xs">
                            <p>{tooltipDescriptions['geo-biosphere.png']}</p>
                         </TooltipContent>
                         </Tooltip>
                         <p className="text-xs text-center text-gray-500 mt-1 italic">{t.nature.geoShell.imageCaption2}</p>
                     </div>
                  </div>
                </section>

                {/* Section: Человек на Земле */}
                <section className="space-y-3 border-t border-yellow-500/15 pt-6">
                  <h2 className="flex items-center text-lg md:text-xl font-semibold text-yellow-400 mb-3">
                    <FaUsers className="mr-2 text-yellow-400/70 text-xl" /> {t.human.title}
                  </h2>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-3 text-xs md:text-sm">
                     <li>{t.human.point1}</li>
                     <li>{t.human.point2}</li>
                     <li>{t.human.point3}</li>
                     <li>{t.human.point4}</li>
                   </ul>
                   <div className="text-center my-3"><FaTable className="text-4xl md:text-5xl text-yellow-400/50 mx-auto"/></div>
                </section>

                {/* Final Tip */}
                <section className="border-t border-brand-green/15 pt-6 mt-6 text-center">
                  <h2 className="flex items-center justify-center text-lg md:text-xl font-semibold text-brand-green mb-3">
                    <FaAtlas className="mr-2 text-brand-green/70 text-xl" /> {t.finalTip.title}
                  </h2>
                   <p className="text-gray-300 text-xs md:text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t.finalTip.text }} />
                </section>

              </CardContent>
            </Card>
          </div>
      </TooltipProvider>
    </div>
  );
};

export default VprGeographyCheatsheet;