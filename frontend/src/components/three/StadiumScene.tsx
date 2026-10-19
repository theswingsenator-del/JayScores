"use client";

import { Canvas } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";
import ContextGuard from "./ContextGuard";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Holographic overlay scene rendered on a transparent canvas above the
 * cinematic stadium video — the video provides the environment, the canvas
 * adds the floating glowing brand mark. */
export default function StadiumScene({ onContextLost }: { onContextLost?: () => void }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 9], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ContextGuard onLost={onContextLost} />
      <ambientLight intensity={0.4} />

      <Float speed={1.4} floatIntensity={0.6} rotationIntensity={0.2}>
        <Text
          position={[0, 1.2, 0]}
          fontSize={1.25}
          letterSpacing={0.08}
          color="#00e5ff"
          anchorX="center"
          anchorY="middle"
        >
          SJ SPORTS
          <meshStandardMaterial emissive="#00e5ff" emissiveIntensity={1.6} color="#00e5ff" />
        </Text>
      </Float>

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.35} mipmapBlur />
        <Vignette darkness={0.45} offset={0.25} />
      </EffectComposer>
    </Canvas>
  );
}
