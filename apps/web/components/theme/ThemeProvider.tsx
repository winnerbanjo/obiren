"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} });

export const THEME_STORAGE_KEY = "obiren-theme";

/**
 * Inline script that applies the persisted theme before first paint. Light
 * is the Obiren default; dark is the opt-in. Injected from the root layout.
 */
export function ThemeInitScript() {
  const code = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var c=document.documentElement.classList;if(t==="dark"){c.add("dark");c.remove("light");}else{c.remove("dark");c.add("light");}}catch(e){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light");}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      const root = document.documentElement;
      if (next === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
      }
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
