"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Text } from "@react-three/drei";
import ContextGuard from "./ContextGuard";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Prediction } from "@/lib/api";
import { makeHeatmapTexture, makePitchTexture } from "./pitchTexture";

function Pitch({ live }: { live: boolean }) {
  const tex = useMemo(() => makePitchTexture(), []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current && live) {
      mat.current.emissiveIntensity = 0.08 + 0.06 * Math.sin(clock.elapsedTime * 2.2);
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10.5, 6.6]} />
      <meshStandardMaterial
        ref={mat}
        map={tex}
        roughness={0.9}
        emissive="#00e5ff"
        emissiveIntensity={0}
      />
    </mesh>
  );
}

function Heatmap({ lh, la }: { lh: number; la: number }) {
  const tex = useMemo(() => makeHeatmapTexture(lh, la), [lh, la]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <planeGeometry args={[10.5, 6.6]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Glowing goal-expectancy bar rising from a pitch half. */
function XgBar({
  x, value, color, label,
}: {
  x: number; value: number; color: string; label: string;
}) {
  const target = Math.max(value * 0.9, 0.1);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = ref.current.scale;
    s.y += (target - s.y) * Math.min(dt * 3, 1); // ease toward target
    ref.current.position.y = s.y / 2;
  });
  return (
    <group position={[x, 0, -2.2]}>
      <mesh ref={ref} scale={[1, 0.1, 1]}>
        <boxGeometry args={[0.55, 1, 0.55]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Text position={[0, target + 0.45, 0]} fontSize={0.34} color={color} anchorX="center">
        {value.toFixed(2)} xG
      </Text>
      <Text position={[0, -0.02, 0.75]} fontSize={0.22} color="#8b93ad" anchorX="center" rotation={[-Math.PI / 2, 0, 0]}>
        {label}
      </Text>
    </group>
  );
}

/** W/D/L 3D bar trio at the back of the scene. */
function WdlBars({ p }: { p: Prediction }) {
  const bars = [
    { v: p.p_home_win, color: "#00e5ff", label: "HOME" },
    { v: p.p_draw, color: "#8b93ad", label: "DRAW" },
    { v: p.p_away_win, color: "#ff2ec4", label: "AWAY" },
  ];
  return (
    <group position={[0, 0, 2.6]}>
      {bars.map((b, i) => {
        const h = Math.max(b.v * 2.6, 0.08);
        return (
          <group key={b.label} position={[(i - 1) * 1.1, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.7, h, 0.45]} />
              <meshStandardMaterial
                color={b.color} emissive={b.color} emissiveIntensity={1.1}
                transparent opacity={0.85}
              />
            </mesh>
            <Text position={[0, h + 0.3, 0]} fontSize={0.3} color={b.color} anchorX="center">
              {(b.v * 100).toFixed(0)}%
            </Text>
            <Text position={[0, -0.02, 0.55]} fontSize={0.18} color="#8b93ad" anchorX="center" rotation={[-Math.PI / 2, 0, 0]}>
              {b.label}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

export default function MatchScene({
  prediction,
  homeName,
  awayName,
  live,
  onContextLost,
}: {
  prediction: Prediction;
  homeName: string;
  awayName: string;
  live: boolean;
  onContextLost?: () => void;
}) {
  const p = prediction;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 6.4, 8.8], fov: 45 }}
    >
      <ContextGuard onLost={onContextLost} />
      <color attach="background" args={["#05070f"]} />
      <fog attach="fog" args={["#05070f", 12, 28]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 9, 4]} intensity={0.8} color="#cfe8ff" />
      <pointLight position={[0, 6, 0]} intensity={6} color="#dff2ff" distance={18} decay={2} />

      <Pitch live={live} />
      <Heatmap lh={p.pred_home_goals} la={p.pred_away_goals} />
      <XgBar x={-3.4} value={p.pred_home_goals} color="#00e5ff" label={homeName} />
      <XgBar x={3.4} value={p.pred_away_goals} color="#ff2ec4" label={awayName} />
      <WdlBars p={p} />

      <Float speed={1.6} floatIntensity={0.4} rotationIntensity={0.1}>
        <Text
          position={[0, 3.1, 0]}
          fontSize={1.3}
          letterSpacing={0.06}
          color="#ffffff"
          anchorX="center"
        >
          {p.likely_scoreline.replace("-", " – ")}
          <meshStandardMaterial emissive="#00e5ff" emissiveIntensity={0.9} color="#eaffff" />
        </Text>
      </Float>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate
        autoRotateSpeed={0.5}
      />
      <hemisphereLight args={["#1a2f55", "#050810", 0.6]} />
      <EffectComposer>
        <Bloom intensity={1.0} luminanceThreshold={0.3} mipmapBlur />
        <Vignette darkness={0.5} offset={0.25} />
      </EffectComposer>
    </Canvas>
  );
}
