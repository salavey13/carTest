"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { removeFromCart, checkoutCart } from "../../actions";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import Image from "next/image";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
}

export default function CartPage() {
  const { dbUser, refreshDbUser } = useAppContext();
  const cart: CartItem[] = dbUser?.metadata?.cart || [];
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  useBio30ThemeFix();
  const toast = useAppToast();
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const cartGrid = useStaggerFadeIn(cart.length, 0.1);

  const handleRemove = async (productId: string) => {
    if (!dbUser?.user_id) return;
    
    try {
      toast.loading('Удаление из корзины...', { id: 'removing-item' });
      
      const result = await removeFromCart(dbUser.user_id, productId);
      if (result.success) {
        await refreshDbUser();
        toast.success('Товар удален из корзины');
      } else {
        toast.error(result.error || 'Ошибка удаления');
      }
    } catch (err) {
      toast.error('Ошибка при удалении');
    } finally {
      toast.dismiss('removing-item');
    }
  };

  const handleCheckout = async () => {
    if (!dbUser?.user_id) {
      toast.error('Необходимо авторизоваться');
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading('Оформление заказа...', { id: 'processing-checkout' });
      
      // Here you would integrate with your payment system
      // For now, we'll just log and clear cart
      const result = await checkoutCart(dbUser.user_id);
      
      if (result.success) {
        await refreshDbUser();
        toast.success('Заказ успешно оформлен!');
        // Redirect to order confirmation or payment
      } else {
        toast.error(result.error || 'Ошибка оформления заказа');
      }
    } catch (err) {
      toast.error('Ошибка при оформлении заказа');
    } finally {
      setIsProcessing(false);
      toast.dismiss('processing-checkout');
    }
  };

  const total = cart.reduce((sum: number, item: CartItem) => {
    return sum + (item.price * item.quantity);
  }, 0);

  const totalItems = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-16">
        <section className="text-center py-16">
          <motion.h1
            ref={heroTitle.ref}
            initial="hidden"
            animate={heroTitle.controls}
            variants={heroTitle.variants}
            className="text-3xl font-bold gradient-text mb-2"
          >
            Корзина — BIO 3.0
          </motion.h1>
          <motion.p
            ref={heroSubtitle.ref}
            initial="hidden"
            animate={heroSubtitle.controls}
            variants={heroSubtitle.variants}
            className="text-muted-foreground max-w-xl mx-auto mb-8"
          >
            Ваша корзина пуста
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/bio30/categories'}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg"
          >
            Продолжить покупки
          </motion.button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <motion.h1
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="text-3xl md:text-4xl font-bold gradient-text mb-2"
        >
          Корзина — BIO 3.0
        </motion.h1>
        <motion.p
          ref={heroSubtitle.ref}
          initial="hidden"
          animate={heroSubtitle.controls}
          variants={heroSubtitle.variants}
          className="text-muted-foreground max-w-xl mx-auto"
        >
          Ваша корзина в BIO 3.0. Проверьте список товаров и оформите заказ.
        </motion.p>
      </section>

      {/* Cart Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <motion.div
              ref={cartGrid.ref}
              initial="hidden"
              animate={cartGrid.controls}
              variants={cartGrid.container}
              className="space-y-4"
            >
              <AnimatePresence>
                {cart.map((item: CartItem, index: number) => (
                  <motion.div
                    key={item.productId}
                    variants={cartGrid.child}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    layout
                    className="group relative overflow-hidden bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Product Image */}
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="80px"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate mb-1">
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.category}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-primary">
                            {item.price} ₽
                          </span>
                          <span className="text-sm text-muted-foreground">
                            × {item.quantity}
                          </span>
                          <span className="text-lg font-semibold text-foreground ml-auto">
                            {item.price * item.quantity} ₽
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleRemove(item.productId)}
                        className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors flex-shrink-0"
                        aria-label="Удалить из корзины"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-24 bg-card border border-border rounded-xl p-6"
            >
              <h3 className="text-xl font-bold font-orbitron text-foreground mb-6">
                Итог заказа
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-foreground">
                  <span>Товары ({totalItems})</span>
                  <span>{total} ₽</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Доставка</span>
                  <span>Бесплатно</span>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-lg font-bold text-foreground">
                    <span>Итого</span>
                    <span>{total} ₽</span>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={isProcessing || cart.length === 0}
                className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    Оформление...
                  </span>
                ) : (
                  'Оформить заказ'
                )}
              </motion.button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Нажимая «Оформить заказ», вы соглашаетесь с условиями покупки
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}