"use client";

import { useAnimation, Variants, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

export const useStaggerFadeIn = (count: number, delayStep = 0.1) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const controls = useAnimation();
  const inView = useInView(ref, { once: true, margin: "-50px" });

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: delayStep,
      },
    },
  };

  const child: Variants = {
    hidden: {
      opacity: 0,
      y: 30,
      filter: "blur(6px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.7, ease: "easeOut" },
    },
  };

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [inView, controls]);

  return { ref, controls, container, child };
};