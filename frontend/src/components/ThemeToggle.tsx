"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "antd";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-11 h-11" />; 
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      className="flex items-center justify-center w-11 h-11 rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="切换主题"
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}