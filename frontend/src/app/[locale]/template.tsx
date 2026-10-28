"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAccessibilityPreferences } from "@/lib/accessibility/useAccessibilityPreferences";

export default function Template({ children }: { children: React.ReactNode }) {
  const systemReducedMotion = useReducedMotion();
  const { preferences } = useAccessibilityPreferences();
  const reducedMotion = systemReducedMotion || preferences.reduceMotion;
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3, ease: "easeOut" }}
      className="sf-page-transition flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}
