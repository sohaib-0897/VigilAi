'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { duration, ease } from '@/lib/motion';
import {
  TRAIL_LENGTH,
  crossesSegment,
  entities,
  entityDistance,
  inFrame,
  pointAlong,
  pointInPolygon,
  virtualLine,
  zonePolygon,
  type Point,
} from './scene-model';

// Optical-surface tokens from src/app/globals.css. WebGL cannot read CSS
// variables per frame, so they are mirrored here. Keep them in sync.
const COLOR = {
  foreground: '#ECEBE6',
  muted: '#9C9B94',
  signal: '#D2FF3A',
  track: '#4FD1EA',
} as const;

/** Ground footprint of the normalized frame in world units (4:3, like the viewport). */
const FRAME_W = 8;
const FRAME_D = 6;
const SENSOR = new THREE.Vector3(0, 4.4, 5.6);
const SCAN_PERIOD = 3.4;
const TRAIL_SAMPLE = 0.07;

const toWorld = ([u, v]: Point, y = 0) => new THREE.Vector3((u - 0.5) * FRAME_W, y, (v - 0.5) * FRAME_D);
const corners: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

function lineMaterial(color: string, opacity = 1) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function segments(points: THREE.Vector3[], material: THREE.Material) {
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material);
}

function loop(points: THREE.Vector3[], material: THREE.Material) {
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

type EntityRig = {
  group: THREE.Group;
  materials: THREE.Material[];
  trail: THREE.Line;
  trailPoints: THREE.Vector3[];
  lastSample: number;
  previous: Point | null;
};

/**
 * Builds the scene graph imperatively so every geometry and material is owned
 * here and released in `dispose()`. React only mounts the root.
 */
function buildScene() {
  const root = new THREE.Group();

  // Calibration grid on the ground plane: 10 × 10 cells of the normalized frame.
  const grid: THREE.Vector3[] = [];
  for (let i = 1; i < 10; i += 1) {
    grid.push(toWorld([i / 10, 0]), toWorld([i / 10, 1]), toWorld([0, i / 10]), toWorld([1, i / 10]));
  }
  root.add(segments(grid, lineMaterial(COLOR.foreground, 0.1)));
  root.add(loop(corners.map(c => toWorld(c)), lineMaterial(COLOR.foreground, 0.45)));

  // Camera frustum. Built relative to the sensor so the intro can scale it out from the lens.
  const frustum = new THREE.Group();
  frustum.position.copy(SENSOR);
  const rays = corners.flatMap(c => [new THREE.Vector3(), toWorld(c).sub(SENSOR)]);
  frustum.add(segments(rays, lineMaterial(COLOR.foreground, 0.35)));
  root.add(frustum);

  const housing = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.34, 0.8)),
    lineMaterial(COLOR.foreground, 0.9),
  );
  housing.position.copy(SENSOR);
  housing.lookAt(0, 0, 0);
  root.add(housing);

  // Scan plane sweeping from lens to ground: one shared position buffer, fill + outline.
  const scanPositions = new THREE.BufferAttribute(new Float32Array(12), 3);
  const scanFillGeometry = new THREE.BufferGeometry();
  scanFillGeometry.setAttribute('position', scanPositions);
  scanFillGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const scanFill = new THREE.Mesh(
    scanFillGeometry,
    new THREE.MeshBasicMaterial({ color: COLOR.foreground, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false }),
  );
  const scanEdgeGeometry = new THREE.BufferGeometry();
  scanEdgeGeometry.setAttribute('position', scanPositions);
  const scanEdge = new THREE.LineLoop(scanEdgeGeometry, lineMaterial(COLOR.foreground, 0.3));
  root.add(scanFill, scanEdge);

  // Zone polygon (convex, so a triangle fan is enough).
  const zoneGeometry = new THREE.BufferGeometry().setFromPoints(zonePolygon.map(p => toWorld(p, 0.004)));
  zoneGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const zoneMaterial = new THREE.MeshBasicMaterial({ color: COLOR.track, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  root.add(new THREE.Mesh(zoneGeometry, zoneMaterial));
  root.add(loop(zonePolygon.map(p => toWorld(p, 0.006)), lineMaterial(COLOR.track, 0.8)));

  // Virtual line plus a vertical curtain that flashes when a track crosses it.
  const lineMaterialRef = lineMaterial(COLOR.signal, 0.75);
  root.add(segments(virtualLine.map(p => toWorld(p, 0.01)), lineMaterialRef));
  const [la, lb] = virtualLine.map(p => toWorld(p));
  const curtainGeometry = new THREE.BufferGeometry().setFromPoints([la, lb, lb.clone().setY(1.1), la.clone().setY(1.1)]);
  curtainGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const curtainMaterial = new THREE.MeshBasicMaterial({ color: COLOR.signal, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  root.add(new THREE.Mesh(curtainGeometry, curtainMaterial));

  const rigs: EntityRig[] = entities.map(entity => {
    const [w, h, d] = entity.kind === 'person' ? [0.34, 0.95, 0.34] : [1.1, 0.55, 0.55];
    const box = new THREE.BoxGeometry(w, h, d);
    box.translate(0, h / 2, 0);
    const boxMaterial = lineMaterial(COLOR.track, 0);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: COLOR.track, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2).translate(0, 0.012, 0), markerMaterial);
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), boxMaterial), marker);
    box.dispose();
    root.add(group);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    trailGeometry.setDrawRange(0, 0);
    const trailMaterial = lineMaterial(COLOR.track, 0);
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    root.add(trail);

    return { group, materials: [boxMaterial, markerMaterial, trailMaterial], trail, trailPoints: [], lastSample: -Infinity, previous: null };
  });

  let flash = 0;

  function update(time: number, elapsed: number, delta: number) {
    // Intro: frustum acquires from the lens, then tracks fade in.
    const intro = ease('acquire', Math.min(1, elapsed / duration.cinematic));
    frustum.scale.setScalar(Math.max(0.001, intro));
    const reveal = Math.min(1, Math.max(0, (elapsed - duration.cinematic * 0.6) / duration.section));

    const f = 0.12 + 0.88 * ((time % SCAN_PERIOD) / SCAN_PERIOD);
    corners.forEach((corner, i) => {
      const v = SENSOR.clone().lerp(toWorld(corner), f);
      scanPositions.setXYZ(i, v.x, v.y, v.z);
    });
    scanPositions.needsUpdate = true;
    scanFill.visible = scanEdge.visible = intro >= 1;

    let occupied = 0;
    entities.forEach((entity, index) => {
      const rig = rigs[index];
      const distance = entityDistance(entity, time);
      const position = distance === null ? null : pointAlong(entity.path, distance);

      // Outside the frame the object is not observed, so its track ends and its history is dropped.
      if (!position || !inFrame(position)) {
        rig.group.visible = rig.trail.visible = false;
        rig.trailPoints.length = 0;
        rig.previous = null;
        return;
      }
      rig.group.visible = rig.trail.visible = true;
      const world = toWorld(position);
      rig.group.position.copy(world);

      const ahead = pointAlong(entity.path, (distance ?? 0) + 0.02);
      rig.group.rotation.y = Math.atan2(-(ahead[1] - position[1]) * FRAME_D, (ahead[0] - position[0]) * FRAME_W);

      if (rig.previous && crossesSegment(rig.previous, position, virtualLine)) flash = 1;
      rig.previous = position;
      if (pointInPolygon(position, zonePolygon)) occupied += 1;

      // Bounded trajectory history: fixed capacity, oldest sample dropped first.
      if (time - rig.lastSample >= TRAIL_SAMPLE || rig.trailPoints.length === 0) {
        rig.trailPoints.push(world.clone().setY(0.02));
        if (rig.trailPoints.length > TRAIL_LENGTH) rig.trailPoints.shift();
        rig.lastSample = time;
      }
      const attribute = rig.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      rig.trailPoints.forEach((p, i) => attribute.setXYZ(i, p.x, p.y, p.z));
      attribute.needsUpdate = true;
      rig.trail.geometry.setDrawRange(0, rig.trailPoints.length);

      const [box, marker, trail] = rig.materials as [THREE.LineBasicMaterial, THREE.MeshBasicMaterial, THREE.LineBasicMaterial];
      box.opacity = reveal;
      marker.opacity = reveal;
      trail.opacity = 0.55 * reveal;
    });

    zoneMaterial.opacity = THREE.MathUtils.damp(zoneMaterial.opacity, occupied > 0 ? 0.16 : 0.05, 6, delta);
    flash = Math.max(0, flash - delta / duration.section);
    curtainMaterial.opacity = 0.22 * flash;
    lineMaterialRef.opacity = 0.75 + 0.25 * flash;
  }

  function dispose() {
    root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose());
      }
    });
    root.clear();
  }

  return { root, update, dispose };
}

function Scene({ running, onFirstFrame }: { running: boolean; onFirstFrame: () => void }) {
  const scene = useMemo(buildScene, []);
  const clock = useRef({ time: 0, elapsed: 0, reported: false });

  useEffect(() => () => scene.dispose(), [scene]);

  useFrame((_, rawDelta) => {
    // Clamp so a long pause or a background tab does not jump the simulation.
    const delta = Math.min(rawDelta, 1 / 20);
    const state = clock.current;
    if (running) {
      state.time += delta;
      state.elapsed += delta;
    }
    scene.update(state.time, state.elapsed, delta);
    if (!state.reported) {
      state.reported = true;
      onFirstFrame();
    }
  });

  return <primitive object={scene.root} dispose={null} />;
}

export type HeroSceneProps = {
  /** False when paused, offscreen or the tab is hidden: the render loop stops entirely. */
  running: boolean;
  onReady: () => void;
};

export default function HeroScene({ running, onReady }: HeroSceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.75]}
      frameloop={running ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [7.6, 7.8, 11.2], fov: 34, near: 0.1, far: 60 }}
      onCreated={({ camera }) => camera.lookAt(0.6, 0.9, 1.0)}
    >
      <Scene running={running} onFirstFrame={onReady} />
    </Canvas>
  );
}
