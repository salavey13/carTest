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
        name: "VOGE 525 ACX", 
        description: "Абсолютно новый, потрясающе удобный и маневренный мотоцикл. Доступен уже сегодня!",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/1000033151-e9dcdbf2-03c3-45a2-87b0-4b22f1a9a084.jpg"
    },
    { 
        name: "Harley-Davidson Fat Boy", 
        description: "Байк в максимальном тюнинге для истинных ценителей. Такого в Нижнем Новгороде еще не было!",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/fat-1b4c292d-0c2d-452e-8139-93abc671df2d.webp"
    },
    { 
        name: "Ducati X-Diavel", 
        description: "Крутейший пауэр-круизер, который дарит невероятные эмоции. Один из флагманов нашего парка.",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233954_223-9d491e27-ba4a-4bcd-8c1d-23e426e1fdd5.jpg"
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
              className="brightness-75"
              priority={index === 0}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
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
                  <Button size="lg" variant="outline" className="bg-transparent border-2 border-brand-lime text-brand-lime hover:bg-brand-lime hover:text-black font-orbitron text-lg backdrop-blur-sm">
                    <VibeContentRenderer content="::FaMotorcycle:: Смотреть весь парк" classname="mr-2" />
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