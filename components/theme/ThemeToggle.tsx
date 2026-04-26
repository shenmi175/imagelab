"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? resolvedTheme : "day";
  const nextTheme = current === "night" ? "day" : "night";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full border border-border/70 bg-card/60 shadow-sm backdrop-blur"
      aria-label={nextTheme === "night" ? "切换到黑夜主题" : "切换到白天主题"}
      onClick={() => setTheme(nextTheme)}
    >
      {current === "night" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
