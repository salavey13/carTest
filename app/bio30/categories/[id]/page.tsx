"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppContext } from '@/contexts/AppContext';
import { useAppToast } from "@/hooks/useAppToast";
import { useBio30ThemeFix } from "../../hooks/useBio30ThemeFix";
import { fetchBio30ProductById } from '../actions';
import { addToCart } from '../../../actions';
import type { Bio30Product } from '../actions';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  // ✅ FIX: Properly decode Cyrillic ID
  const rawId = params.id as string;
  const id = decodeURIComponent(rawId || '').trim();
  
  console.log('Debug - Raw ID:', rawId);
  console.log('Debug - Decoded ID:', id);
  
  const [product, setProduct] = useState<Bio30Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  useBio30ThemeFix();
  const { dbUser, refreshDbUser } = useAppContext();
  const toast = useAppToast();

  useEffect(() => {
    if (!id) {
      setError('Invalid product ID');
      setIsLoading(false);
      return;
    }
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      toast.loading('Загрузка продукта...', { id: 'loading-product' });
      
      // ✅ FIX: Pass the decoded ID
      const result = await fetchBio30ProductById(id);
      
      if (result.success && result.data) {
        setProduct(result.data);
        toast.success('Продукт загружен');
      } else {
        const errorMessage = result.error || 'Продукт не найден';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки продукта';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      toast.dismiss('loading-product');
    }
  };

  const handleAddToCart = async () => {
    if (!dbUser?.user_id || !product) {
      toast.error('Необходимо авторизоваться');
      return;
    }
    
    try {
      setIsAddingToCart(true);
      toast.loading('Добавление в корзину...', { id: 'adding-to-cart' });
      
      await addToCart(dbUser.user_id, product.id);
      await refreshDbUser();
      
      toast.success(`"${product.title}" добавлен в корзину`);
    } catch (err) {
      toast.error('Ошибка добавления в корзину');
    } finally {
      setIsAddingToCart(false);
      toast.dismiss('adding-to-cart');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка продукта...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-16 bg-background">
        <h1 className="text-2xl font-bold text-destructive mb-4">Продукт не найден</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button 
          onClick={() => router.push('/bio30/categories')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Вернуться к каталогу
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold font-orbitron text-gradient mb-4">
            {product.title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {product.description}
          </p>
        </motion.section>

        {/* Product Content Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12"
        >
          {/* Image Section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="relative group"
          >
            <div className="relative overflow-hidden rounded-2xl border-2 border-border shadow-lg shadow-primary/10">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                loading="eager"
              />
              {product.hasDiscount && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute top-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-bold text-sm shadow-lg"
                >
                  СКИДКА -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                </motion.span>
              )}
            </div>
          </motion.div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            {/* Price and Cart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8 p-6 bg-card border border-border rounded-xl"
            >
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-4xl font-bold text-primary">{product.price} ₽</span>
                {product.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    {product.originalPrice} ₽
                  </span>
                )}
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
              >
                {isAddingToCart ? 'Добавляется...' : 'Добавить в корзину'}
              </motion.button>
            </motion.div>

            {/* Benefits */}
            {product.purpose && product.purpose.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
              >
                <h3 className="text-2xl font-bold font-orbitron text-foreground mb-4">
                  Преимущества
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {product.purpose.map((benefit: string, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="relative overflow-hidden p-5 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all"
                    >
                      <h4 className="text-lg font-semibold text-foreground mb-2">
                        {benefit}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {getBenefitDescription(benefit)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-8 pt-6 border-t border-border"
              >
                <h3 className="text-lg font-semibold text-foreground mb-3">Теги</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag: string) => (
                    <motion.span
                      key={tag}
                      whileHover={{ scale: 1.05 }}
                      className="px-3 py-1 bg-muted/50 text-muted-foreground rounded-full text-sm hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      #{tag}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Back to Catalog */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <button 
            onClick={() => router.push('/bio30/categories')}
            className="px-6 py-3 border border-border text-muted-foreground hover:text-foreground hover:border-foreground rounded-md transition-colors"
          >
            ← Вернуться к каталогу
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// Helper to map benefits to descriptions
function getBenefitDescription(benefit: string): string {
  const descriptions: Record<string, string> = {
    'Иммунитет': 'Укрепляет защитные силы организма, повышает сопротивляемость заболеваниям',
    'Улучшение памяти': 'Поддерживает когнитивные функции, улучшает работу памяти и концентрацию',
    'Стимуляция мозговой активности': 'Активирует нейронные связи, повышает ясность мышления и фокус',
    'Энергия': 'Придает жизненную силу и борется с усталостью',
    'Память': 'Улучшает краткосрочную и долгосрочную память',
    'Концентрация': 'Помогает сосредоточиться и поддерживать внимание',
    'Нейропротекция': 'Защищает нейроны от повреждений и старения'
  };
  return descriptions[benefit] || 'Полезное свойство для здоровья и благополучия';
}