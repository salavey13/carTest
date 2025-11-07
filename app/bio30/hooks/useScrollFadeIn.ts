"use client";

import { useAnimation, Variants, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

interface UseScrollFadeInOptions {
  delay?: number;
  duration?: number;
  blurAmount?: number;
  once?: boolean;
}

type Direction = "up" | "down" | "left" | "right" | "none";

export const useScrollFadeIn = (
  direction: Direction = "up",
  options: UseScrollFadeInOptions = {}
) => {
  const ref = useRef<HTMLElement>(null);
  const controls = useAnimation();
  const inView = useInView(ref, { 
    once: options.once ?? true, 
    margin: "-50px" 
  });

  const { delay = 0, duration = 0.8, blurAmount = 4 } = options;

  const motionProps = {
    [direction]: {
      up: { y: 40 },
      down: { y: -40 },
      left: { x: -40 },
      right: { x: 40 },
      none: {}
    }[direction]
  };

  const variants: Variants = {
    hidden: {
      opacity: 0,
      filter: `blur(${blurAmount}px)`,
      ...motionProps
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      x: 0,
      y: 0,
      transition: { duration, delay, ease: "easeOut" }
    }
  };

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [inView, controls]);

  return { 
    ref, 
    controls, 
    variants,
    getProps: () => ({ 
      ref, 
      variants, 
      initial: "hidden", 
      animate: controls 
    })
  };
};