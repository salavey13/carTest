"use client";

import React, { memo } from 'react';
import { motion, Variants } from 'framer-motion';
import { Benefit } from '../../types';
import Image from 'next/image';

const benefitVariants: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(6px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" }
  })
};

export const BenefitCard = memo(({ benefit, index }: { benefit: Benefit; index: number }) => {
  const isCenter = benefit.variant === 'center';

  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={benefitVariants}
      className="group relative overflow-hidden rounded-xl border border-border"
      style={{ 
        backgroundColor: benefit.theme.bg, 
        color: benefit.theme.text 
      }}
    >
      <div className={`flex ${isCenter ? 'flex-col h-full' : 'flex-col md:flex-row'} min-h-[200px]`}>
        {/* Контент */}
        <div className={`flex-1 p-6 ${isCenter ? 'text-center' : ''}`}>
          <h3 className="text-lg font-bold mb-2" style={{ color: benefit.theme.text }}>
            {benefit.title}
          </h3>
          <p className="text-sm opacity-75" style={{ color: benefit.theme.text }}>
            {benefit.description}
          </p>
        </div>
        
        {/* Изображение */}
        <div className={`${isCenter ? 'w-full h-32' : 'md:w-1/3 w-full h-32 md:h-auto'} relative`}>
          <Image
            src={benefit.image.web}
            alt={benefit.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <picture className="md:hidden">
            <source srcSet={benefit.image.mobile} media="(max-width: 768px)" />
            <img src={benefit.image.web} alt={benefit.title} className="w-full h-full object-cover" />
          </picture>
        </div>
      </div>
    </motion.article>
  );
});

BenefitCard.displayName = 'BenefitCard';