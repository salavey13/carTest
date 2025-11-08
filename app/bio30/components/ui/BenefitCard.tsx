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
      className={`benefit benefit__${benefit.variant} card--benefit overflow-hidden`} // Добавлен overflow-hidden
      style={{ 
        backgroundColor: benefit.theme.bg, 
        color: benefit.theme.text,
        '--benefit-shadow': `${benefit.theme.bg}40`,
        borderRadius: 'var(--md)' // Явное закругление
      } as React.CSSProperties}
    >
      <div className="benefit-content aside pd__xl flex-1">
        <div className="col gp gp--md">
          <div className="col gp gp--sm">
            <h2 className="title fs__md fw__bd" style={{ color: benefit.theme.text }}>
              {benefit.title}
            </h2>
            <p className="subtitle fs__md fw__md opc opc--50" style={{ color: benefit.theme.text }}>
              {benefit.description}
            </p>
          </div>
        </div>
      </div>
      
      <div className="benefit-image bside flex-shrink-0">
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
    </motion.article>
  );
});

BenefitCard.displayName = 'BenefitCard';