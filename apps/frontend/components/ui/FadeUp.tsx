"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export default function FadeUp({
  children,
  delay = 0,
  className,
}: FadeUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      
      viewport={{
        once: true,    
        amount: 0.2,   
      }}
      transition={{
        duration: 0.8, 
        ease: "easeOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
