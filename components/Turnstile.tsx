"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileReady?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    window.__turnstileReady = () => resolve();
    const existing = document.querySelector("script[data-turnstile-script]");
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileReady";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.onerror = () => reject(new Error("人机验证加载失败"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function Turnstile({ action, onToken }: { action: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/public-config", { credentials: "include" })
      .then((response) => response.json())
      .then((config: { turnstileSiteKey?: string }) => {
        if (active && config.turnstileSiteKey) setSiteKey(config.turnstileSiteKey);
      })
      .catch(() => {
        if (active) setLoadError("人机验证配置读取失败");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let active = true;
    loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken("")
        });
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "人机验证加载失败");
      });

    return () => {
      active = false;
      onToken("");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onToken, siteKey]);

  if (!siteKey && !loadError) return null;

  return (
    <div>
      <div ref={containerRef} />
      {loadError ? <p style={{ color: "#9b2c1f", margin: "0.5rem 0 0" }}>{loadError}</p> : null}
    </div>
  );
}
