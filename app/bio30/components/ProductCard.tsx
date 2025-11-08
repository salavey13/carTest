"use client";

import React, { memo } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Product } from '../../types';
import Image from 'next/image';

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: "easeOut", delay: i * 0.1 }
  })
};

export const ProductCard = memo(({ product, index }: { product: Product; index: number }) => {
  const isVertical = product.variant === 'vertical';
  const isHorizontal = product.variant === 'horizontal';

  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={cardVariants}
      className="group relative overflow-hidden rounded-xl border border-border card--product"
      style={{ 
        backgroundColor: product.theme.bg, 
        color: product.theme.text
      }}
    >
      <Link href={product.link} className="block h-full">
        <div className={`flex h-full ${isHorizontal ? 'md:flex-row' : 'flex-col'}`}>
          {/* Текстовая часть */}
          <div className={`flex-1 p-6 ${isVertical ? 'md:order-2' : ''}`}>
            <h3 className="text-xl font-bold mb-2" style={{ color: product.theme.text }}>
              {product.title}
            </h3>
            <p className="text-sm opacity-75 mb-4 line-clamp-3" style={{ color: product.theme.text }}>
              {product.description}
            </p>
            <div className="mt-auto">
              <span className="text-2xl font-bold">{product.price} ₽</span>
              {product.tags.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {product.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-1 rounded-full bg-white/20">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Изображение */}
          <div className={`${isVertical ? 'md:h-full h-48' : 'h-48 md:h-auto'} ${isHorizontal ? 'md:w-1/2' : 'w-full'} relative`}>
            <Image
              src={product.image.web}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={index < 2}
            />
            {/* Мобильная версия через Picture */}
            <picture className="md:hidden">
              <source srcSet={product.image.mobile} media="(max-width: 768px)" />
              <img src={product.image.web} alt={product.title} className="w-full h-full object-cover" />
            </picture>
          </div>
        </div>
      </Link>
    </motion.article>
  );
});

ProductCard.displayName = 'ProductCard';