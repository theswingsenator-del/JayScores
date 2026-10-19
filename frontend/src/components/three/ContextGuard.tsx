"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/** Detects REAL WebGL context loss and notifies the parent so it can swap to
 * a 2D fallback.
 *
 * Registered via useEffect (with cleanup) so the listener from a disposed
 * React StrictMode double-mount never leaks onto the live canvas. As a second
 * safety net, a frame heartbeat confirms rendering actually stopped before
 * declaring the context dead. */
export default function ContextGuard({ onLost }: { onLost?: () => void }) {
  const gl = useThree((s) => s.gl);
  const lastFrame = useRef(Date.now());

  useFrame(() => {
    lastFrame.current = Date.now();
  });

  useEffect(() => {
    const el = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      setTimeout(() => {
        const stalled = Date.now() - lastFrame.current > 800;
        if (el.isConnected && stalled) onLost?.();
      }, 1200);
    };
    el.addEventListener("webglcontextlost", handler);
    return () => el.removeEventListener("webglcontextlost", handler);
  }, [gl, onLost]);

  return null;
}
