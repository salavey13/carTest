// /components/BikeShowcase.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { motion } from 'framer-motion';

type ShowcaseBike = {
  name: string;
  description: string;
  imageUrl: string;
};

const bikes: ShowcaseBike[] = [
    {
        name: "MV Agusta Brutale & BMW HP4",
        description: "Два титана нашего парка. Необузданный итальянский нейкед и ультимативный немецкий гиперспорт. Выбор за тобой.",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/1-bfd373e6-8e1e-4570-ba5a-53e909b968e8.jpg"
    },
    {
        name: "BMW F800R",
        description: "Надежный и сбалансированный нейкед от BMW. Идеален как для города, так и для динамичных прохватов по извилистым дорогам.",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/2-af1aa642-520c-45ad-a9e7-8430a2fbd183.jpg"
    },
    {
        name: "Harley-Davidson Custom",
        description: "Легенда в кастомном исполнении. Этот байк - чистое заявление о себе на дороге. Для тех, кто ценит стиль и мощь.",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/3-3134724b-2b60-4113-a748-fcd4b5dadd40.jpg"
    }
];

export function BikeShowcase() {
  const [emblaRef] = useEmblaCarousel({ loop: true });

  return (
    <section className="h-[80vh] w-full overflow-hidden relative" ref={emblaRef}>
      <div className="flex h-full">
        {bikes.map((bike, index) => (
          <div className="relative flex-[0_0_100%] h-full" key={index}>
            <Image
              src={bike.imageUrl}
              alt={bike.name}
              layout="fill"
              objectFit="cover"
              className="brightness-50"
              priority={index === 0}
            />
            {/* ✨ ГРАДИЕНТ КАК НА HERO-СЕКЦИИ ✨ */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end items-center text-center text-white p-8">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: true }}
              >
                <h3 className="text-4xl md:text-6xl font-orbitron font-bold text-shadow-neon">{bike.name}</h3>
                <p className="text-lg text-gray-300 max-w-xl mx-auto my-4">{bike.description}</p>
                <Link href="/rent-bike" passHref>
                  <Button size="lg" variant="outline" className="bg-transparent border-2 font-orbitron text-lg backdrop-blur-sm">
                    <VibeContentRenderer content="::FaMotorcycle className='mr-2':: Смотреть весь парк" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}