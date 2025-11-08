"use client";

import React, { memo } from 'react';
import { motion, Variants } from 'framer-motion';
import { Benefit } from '../../types';

const benefitVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40,
    filter: "blur(6px)" 
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { 
      duration: 0.6, 
      delay: i * 0.1,
      ease: "easeOut" 
    }
  })
};

export const BenefitCard = memo(({ benefit, index }: { benefit: Benefit; index: number }) => {
  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={benefitVariants}
      className="relative overflow-hidden rounded-xl border border-border min-h-[300px] shadow-sm hover:shadow-lg transition-shadow"
      style={{ 
        backgroundColor: benefit.theme.bg, 
        color: benefit.theme.text
      } as React.CSSProperties}
    >
      <div className="flex flex-col h-full">
        {/* Text Content */}
        <div className={`flex-1 p-6 md:p-8 ${benefit.variant === 'center' ? 'text-center' : ''}`}>
          <h2 className="text-base md:text-lg font-bold mb-2" style={{ color: benefit.theme.text }}>
            {benefit.title}
          </h2>
          <p className="text-sm md:text-base opacity-50" style={{ color: benefit.theme.text }}>
            {benefit.description}
          </p>
        </div>
        
        {/* Image */}
        <div className="w-full h-48 md:h-56 flex-shrink-0">
          <picture>
            <source media="(max-width: 768px)" srcSet={benefit.image.mobile} />
            <img 
              src={benefit.image.web} 
              alt={benefit.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>
      </div>
    </motion.article>
  );
});

BenefitCard.displayName = 'BenefitCard';