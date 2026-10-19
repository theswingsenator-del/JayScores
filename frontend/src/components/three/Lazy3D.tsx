"use client";

import { ComponentProps, ComponentType, useEffect, useState } from "react";

/** Probe WebGL support ONCE per session and release the probe context right
 * away — leaked probe contexts can evict the real scene's context on some
 * GPUs/drivers. */
let webglProbe: boolean | null = null;
function probeWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    webglProbe = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

/** Lazy-load a 3D scene; render nothing (caller shows 2D fallback) when WebGL
 * is unavailable or the screen is small/low-end. */
export function use3DCapable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 768) return; // phones get rich 2D instead
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setOk(probeWebGL());
  }, []);
  return ok;
}

/* Manual import-on-mount, NO Suspense/next-dynamic: both of those wrap the
 * canvas in a loading-fallback swap that reliably killed the WebGL context
 * (Context Lost) in Next 16 + R3F. Importing in an effect and rendering the
 * component directly keeps the chunk code-split without any wrapper remount. */
function makeLazyScene<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  return function LazyScene(props: P) {
    const [Comp, setComp] = useState<ComponentType<P> | null>(null);
    useEffect(() => {
      let mounted = true;
      load().then((m) => mounted && setComp(() => m.default));
      return () => {
        mounted = false;
      };
    }, []);
    if (!Comp) return <SceneLoader />;
    return <Comp {...props} />;
  };
}

export const LazyStadium = makeLazyScene<
  ComponentProps<typeof import("./StadiumScene").default>
>(() => import("./StadiumScene"));

export const LazyMatchScene = makeLazyScene<
  ComponentProps<typeof import("./MatchScene").default>
>(() => import("./MatchScene"));

function SceneLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="display animate-pulse text-xl tracking-widest text-dim">
        LOADING 3D…
      </div>
    </div>
  );
}
