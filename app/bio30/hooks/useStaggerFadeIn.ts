"use client";

import { useAnimation, Variants, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

export const useStaggerFadeIn = (count: number = 10, staggerDelay: number = 0.1) => {
  const ref = useRef<HTMLElement>(null);
  const controls = useAnimation();
  const inView = useInView(ref, { once: true, margin: "-50px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.2
      }
    }
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
    visible: (i) => ({ 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      transition: { 
        duration: 0.6, 
        ease: "easeOut",
        delay: i * staggerDelay
      }
    })
  };

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [inView, controls]);

  return { 
    ref, 
    controls, 
    container: containerVariants,
    child: childVariants,
    getProps: () => ({ ref, variants: containerVariants, initial: "hidden", animate: controls })
  };
};