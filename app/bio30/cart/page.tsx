// /app/bio30/cart/page.tsx
"use client";

import React from "react";

import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { removeFromCart, checkoutCart } from "../ref_actions";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

const CartPage: React.FC = () => {
  const { dbUser, refreshDbUser, tg } = useAppContext();
  const cart = dbUser?.metadata?.cart || [];
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const cartGrid = useStaggerFadeIn(cart.length, 0.1);

  const handleRemove = async (productId: string) => {
    if (!dbUser?.user_id) return;
    const result = await removeFromCart(dbUser.user_id, productId);
    if (result.success) await refreshDbUser();
  };

  const handleCheckout = async () => {
    if (!dbUser?.user_id || !tg?.initDataUnsafe?.user?.id) return;
    const result = await checkoutCart(dbUser.user_id, tg.initDataUnsafe.user.id.toString());
    if (!result.success) console.error("checkout failed");
  };

  const total = cart.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);

  return (
    <div>
      
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Корзина — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Ваша корзина в BIO 3.0. Проверьте список товаров и оформите заказ.
        </motion.p>
      </section>

      <section className="grid gap-6 max-w-4xl mx-auto px-4">
        {cart.length ? (
          <motion.div
            ref={cartGrid.ref}
            initial="hidden"
            animate={cartGrid.controls}
            variants={cartGrid.container}
            className="space-y-4"
          >
            {cart.map((item: any, i: number) => (
              <motion.div
                key={item.productId}
                variants={cartGrid.child}
                className="p-4 bg-card rounded-xl shadow-md flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-muted-foreground">× {item.quantity}</div>
                  <div className="font-medium">{item.price * item.quantity} руб.</div>
                </div>
                <button onClick={() => handleRemove(item.productId)} className="btn btn--danger text-sm">
                  Удалить
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <span className="text-center text-muted-foreground">Корзина пуста</span>
        )}
      </section>

      <div className="flex justify-center items-center gap-4 py-8">
        <span className="text-lg font-bold">Итого: {total} руб.</span>
        <button onClick={handleCheckout} disabled={!cart.length || !tg} className="btn btn--primary">
          Оформить заказ
        </button>
      </div>

      
    </div>
  );
};

export default CartPage;