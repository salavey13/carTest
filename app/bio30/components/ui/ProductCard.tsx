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
      className={`card card__${isVertical ? 'vertical' : 'default'} card--product`}
      style={{ 
        backgroundColor: product.theme.bg, 
        color: product.theme.text,
        '--card-shadow': `${product.theme.bg}40`
      } as React.CSSProperties}
    >
      <Link href={product.link} className="card-link">
        <div className="card-content">
          <div className="card-text">
            <h2 className="title fs__md fw__bd">{product.title}</h2>
            <p className="subtitle fs__sm fw__md opc opc--75">{product.description}</p>
            <div className="card-price">
              <span className="price fs__lg fw__bd">{product.price} RUB</span>
            </div>
          </div>
          <div className="card-image">
            <picture>
              <source media="(max-width: 768px)" srcSet={product.image.mobile} />
              <img src={product.image.web} alt={product.title} loading="lazy" />
            </picture>
          </div>
        </div>
      </Link>
    </motion.article>
  );
});
ProductCard.displayName = 'ProductCard';