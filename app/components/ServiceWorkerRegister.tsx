"use client";

import { useEffect } from "react";

/** Registers the service worker for PWA offline shell caching and network resilience. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for worker updates
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // New content available
                }
              };
            }
          };
        })
        .catch(() => {
          // Registration failed (e.g. private browsing or unsupported)
        });
    }
  }, []);

  return null;
}
