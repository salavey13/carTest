// src/components/ResultDisplay.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/hooks/supabase';

const resultVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -50 }
};

const carVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  hover: { scale: 1.05, zIndex: 1 }
};

export default function ResultDisplay({ result }) {
  const [similarCars, setSimilarCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        const { data } = await supabase.rpc('similar_cars', {
          car_id: result.id,
          match_count: 3
        });
        setSimilarCars(data?.filter(c => c.id !== result.id) || []);
      } finally {
        setLoading(false);
      }
    };
    fetchSimilar();
  }, [result.id]);

  return (
    <div className="space-y-12">
      {/* Main Result */}
      <motion.div
        variants={resultVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ type: 'spring', stiffness: 150 }}
      >
        <div className="cyber-border bg-black/50 p-8 rounded-2xl">
          <h2 className="cyber-text-xl mb-6">ТВОЙ_КИБЕР-СУПЕРКАР://</h2>
          
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="relative aspect-video rounded-xl overflow-hidden"
              whileHover="hover"
              variants={{ hover: { scale: 1.02 } }}
            >
              <Image
                src={result.image_url}
                alt={result.make}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </motion.div>

            <div className="space-y-6">
              <div>
                <h3 className="cyber-text-lg text-[#00ff9d]">
                  {result.make.toUpperCase()} {result.model.toUpperCase()}
                </h3>
                <p className="cyber-text-sm text-[#00ffff] mt-2">
                  {result.description}
                </p>
              </div>

              <div className="flex gap-4">
                <Link href={`/rent/${result.id}`} passHref>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="cyber-button bg-[#ff00ff] text-black"
                  >
                    АРЕНДОВАТЬ_СЕЙЧАС//
                  </motion.button>
                </Link>
                
                <Link href={`/info/${result.id}`} passHref>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="cyber-button border-[#00ff9d] text-[#00ff9d]"
                  >
                    ПОЛНЫЕ_ХАРАКТЕРИСТИКИ//
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Similar Cars */}
      <div className="cyber-border bg-black/50 p-8 rounded-2xl">
        <h3 className="cyber-text-lg mb-6">ПОХОЖИЕ_КИБЕР-ТАЧКИ_ДЛЯ_АРЕНДЫ://</h3>
        
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="cyber-text-sm text-[#00ff9d]"
            >
              ЗАГРУЗКА_РЕКОМЕНДАЦИЙ...
            </motion.div>
          ) : similarCars.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.1 } }
              }}
            >
              {similarCars.map((car) => (
                <motion.div
                  key={car.id}
                  variants={carVariants}
                  whileHover="hover"
                  className="relative bg-black/30 rounded-xl overflow-hidden"
                >
                  <Link href={`/rent/${car.id}`} passHref>
                    <div className="cursor-pointer">
                      <div className="relative aspect-video">
                        <Image
                          src={car.image_url}
                          alt={car.make}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      </div>
                      
                      <div className="p-4 space-y-4">
                        <h4 className="cyber-text-md text-[#00ff9d]">
                          {car.make.toUpperCase()} {car.model.toUpperCase()}
                        </h4>
                        <div className="flex justify-between items-center">
                          <span className="cyber-text-sm text-[#00ffff]">
                            {car.daily_price}¥/ДЕНЬ
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            className="cyber-button-small bg-[#ff00ff] text-black"
                          >
                            ВЫБРАТЬ//
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="cyber-text-sm text-[#00ff9d]"
            >
              ПОХОЖИЕ_МАШИНЫ_НЕ_НАЙДЕНЫ//
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

