"use client";

import React, { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  index: number;
}

export const ProductCard = memo(({ product, index }: ProductCardProps) => {
  const isVertical = product.tags.includes('bestseller');
  
  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
        visible: (i) => ({
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.7, ease: "easeOut", delay: i * 0.1 }
        })
      }}
      className="group relative overflow-hidden rounded-xl border border-border hover:shadow-lg transition-shadow min-h-[300px]"
      style={{ 
        backgroundColor: product.theme.bg, 
        color: product.theme.text,
        '--card-shadow': `${product.theme.bg}40`,
      } as React.CSSProperties}
    >
      <Link href={product.link} className="block h-full">
        <div className={`flex h-full ${isVertical ? 'flex-col' : 'flex-col md:flex-row'}`}>
          {/* Content Area */}
          <div className={`flex-1 ${isVertical ? '' : 'md:w-1/2'} p-4 md:p-6`}>
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-2">
                <h2 className="text-sm md:text-base font-bold leading-tight" style={{ color: product.theme.text }}>
                  {product.title}
                </h2>
                <p className="text-xs md:text-sm opacity-75 line-clamp-3" style={{ color: product.theme.text }}>
                  {product.description}
                </p>
              </div>
              <div className="mt-auto">
                <span className="text-base md:text-lg font-bold">{product.price} RUB</span>
              </div>
            </div>
          </div>
          
          {/* Image Area - Bottom Half on Mobile */}
          <div className={`relative ${isVertical ? 'h-1/2' : 'h-1/2 md:h-auto md:w-1/2'} min-h-[150px]`}>
            <picture>
              <source media="(max-width: 768px)" srcSet={product.image.mobile} />
              <img 
                src={product.image.web} 
                alt={product.title} 
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </picture>
            
            {/* Tags - moved to bottom of image */}
            {product.tags.length > 0 && (
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                {product.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="px-2 py-1 rounded-full text-xs bg-white/20 backdrop-blur-sm border border-white/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
});

ProductCard.displayName = 'ProductCard';