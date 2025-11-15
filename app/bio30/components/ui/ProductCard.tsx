"use client";

import React, { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Bio30Product } from '../../categories/actions';

interface ProductCardProps {
  product: Bio30Product;
  index: number;
}

export const ProductCard = memo(({ product, index }: ProductCardProps) => {
  return (
    <motion.article
      custom={index}
      initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
      whileInView={{ 
        opacity: 1, 
        y: 0, 
        filter: "blur(0px)",
        transition: { 
          duration: 0.7, 
          ease: "easeOut", 
          delay: index * 0.1 
        }
      }}
      viewport={{ 
        once: true, 
        margin: "-10%"
      }}
      className="group relative overflow-hidden rounded-xl border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[300px] bg-card"
      style={{ 
        backgroundColor: 'hsl(var(--card))',
        opacity: 1
      }}
    >
      <Link href={`/bio30/categories/${encodeURIComponent(product.id)}`} className="block h-full">
        <div className="flex h-full flex-col">
          {/* Content Area (текст сверху) */}
          <div className="flex-1 p-4 md:p-6">
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-2">
                <h2 className="text-sm md:text-base font-bold leading-tight text-foreground">
                  {product.title}
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">
                  {product.description}
                </p>
              </div>
              <div className="mt-auto">
                <span className="text-base md:text-lg font-bold text-primary">
                  {product.price} ₽
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through ml-2">
                    {product.originalPrice} ₽
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Image Area (изображение снизу) */}
          <div className="relative h-1/2 min-h-[150px] flex-shrink-0">
            <img 
              src={product.image} 
              alt={product.title} 
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback на дефолтное изображение при ошибке загрузки
                (e.target as HTMLImageElement).src = "https://bio30.ru/front/static/uploads/products/default.webp ";
              }}
            />
            
            {/* Tags - ограничено 2 для лучшей визуализации */}
            {product.tags.length > 0 && (
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                {product.tags.slice(0, 2).map(tag => (
                  <span 
                    key={tag} 
                    className="px-2 py-1 rounded-full text-xs bg-primary/20 backdrop-blur-sm border border-primary/10 text-primary-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            
            {/* Discount Badge */}
            {product.hasDiscount && product.originalPrice && (
              <span className="absolute top-3 right-3 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-bold">
                -{Math.round((1 - product.price / product.originalPrice) * 100)}%
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
});

ProductCard.displayName = 'ProductCard';