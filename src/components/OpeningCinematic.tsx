/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createProceduralEarthScene } from '../three/proceduralEarth';
import { buildLaunchRocketScene } from '../three/launchAnimation';
import { createNeonPinkNebulaTexture } from '../three/proceduralTextures';
import { sound } from '../utils/audio';
import { Language, TRANSLATIONS } from '../utils/translations';
import { Rocket, ArrowRight, Sparkles } from 'lucide-react';

interface OpeningCinematicProps {
  language: Language;
  onEnterGame: () => void;
}

export const OpeningCinematic: React.FC<OpeningCinematicProps> = ({
  language,
  onEnterGame,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const targetMousePos = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();

    // NASA Neon Pink & Magenta Deep Space Cosmic Nebula Background
    const nebulaTex = createNeonPinkNebulaTexture();
    scene.background = nebulaTex;

    // Background Skydome to envelop 360 view in neon pink space
    const skyGeo = new THREE.SphereGeometry(300, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: nebulaTex,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // Warm Sun Key Light & Atmospheric Rim Lighting
    const sun = new THREE.DirectionalLight(0xffedd5, 3.0);
    sun.position.set(18, 14, 16);
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0xf472b6, 0x0f0326, 0.9);
    scene.add(hemi);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3.5, 18);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // OrbitControls: allows natural drag to rotate freely, smoothly
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 50;
    controls.target.set(0, -1.0, 0);

    // 1. Procedural 3D Earth
    const earthBundle = createProceduralEarthScene(isSoftwareGl);
    earthBundle.group.position.set(0, -6.5, -6);
    earthBundle.group.scale.set(1.4, 1.4, 1.4);
    scene.add(earthBundle.group);

    // 2. Realistic Mongolian Flagship Rocket
    const rocketBundle = buildLaunchRocketScene();
    rocketBundle.group.position.set(0, -1.5, 3.5);
    rocketBundle.group.scale.set(0.65, 0.65, 0.65);
    scene.add(rocketBundle.group);

    // 3. Dense Realistic Stars
    const starCount = isSoftwareGl ? 500 : 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.75, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Cursor Movement Tracking: moving mouse effortlessly showcases the scene from all sides!
    const handlePointerMove = (e: PointerEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const normY = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      targetMousePos.current.set(normX, normY);
    };

    let isPointerDown = false;
    const handlePointerDown = () => { isPointerDown = true; };
    const handlePointerUp = () => { isPointerDown = false; };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      earthBundle.update(delta);
      rocketBundle.firePlume.scale.set(1, 1 + Math.sin(elapsed * 20) * 0.2, 1);

      // Silky-smooth cursor camera orbit: moving the cursor pivots the view from all sides
      const desiredCamX = targetMousePos.current.x * 12 + Math.sin(elapsed * 0.15) * 3;
      const desiredCamY = 3.5 + -targetMousePos.current.y * 6 + Math.cos(elapsed * 0.12) * 1.2;
      const desiredCamZ = 18 - Math.abs(targetMousePos.current.y) * 2;

      // Damp smoothly if user is not actively dragging with mouse button down
      if (!isPointerDown) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 2.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 2.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 2.5, delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      earthBundle.dispose();
      rocketBundle.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      nebulaTex.dispose();
      starGeo.dispose();
      starMat.dispose();
      sun.dispose();
      hemi.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas: Move cursor to look from all sides, or drag to rotate 360° */}
      <div 
        ref={canvasMountRef} 
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* Subtle Cinematic Vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/70 pointer-events-none" />

      {/* Top Right: Skip Button */}
      <div className="absolute top-6 right-6 z-30 pointer-events-auto">
        <button
          onClick={() => {
            sound.playClick();
            onEnterGame();
          }}
          className="px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-pink-300 border border-pink-500/30 text-xs font-mono flex items-center gap-2 transition-all backdrop-blur-md shadow-lg"
        >
          <span>{t.menu.skipIntro}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Clean, Clutter-Free Center Hero Title & Launch Button */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
        <div className="max-w-2xl space-y-4">
          {/* Mongolian Soyombo & Flag Emblem */}
          <div className="flex items-center justify-center gap-3 mb-1 animate-fade-in">
            <div className="w-10 h-6 rounded border border-amber-400/80 overflow-hidden flex shadow-[0_0_15px_rgba(251,191,36,0.5)]">
              <div className="w-1/3 bg-[#da291c] flex items-center justify-center text-[7px] text-yellow-300 font-bold">
                ☸
              </div>
              <div className="w-1/3 bg-[#0055b8]" />
              <div className="w-1/3 bg-[#da291c]" />
            </div>
            <span className="text-xs font-mono font-bold tracking-widest text-pink-400">
              MONGOLIA IN SPACE // CH-13 ORBITAL GUARDIAN
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-[0_0_40px_rgba(244,63,94,0.6)]">
            QUASAR
          </h1>
          <div className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-sky-300 tracking-wider font-mono">
            {language === 'mn' ? 'МОНГОЛЫН САНСРЫН ХАМГААЛАГЧ' : 'ORBITAL GUARDIAN SIMULATOR'}
          </div>

          <p className="text-xs sm:text-sm font-mono text-slate-300 max-w-lg mx-auto leading-relaxed pt-1">
            {t.tagline}
          </p>

          <div className="text-[11px] font-mono text-pink-300/80 pt-2 flex items-center justify-center gap-2">
            <span>✦</span>
            <span>{language === 'mn' ? 'Курсороо хөдөлгөж 3D орчныг тал талаас нь харна уу' : 'Move cursor or drag to view from all sides'}</span>
            <span>✦</span>
          </div>

          {/* Prominent, Glowing Enter Button */}
          <div className="pt-6 pointer-events-auto">
            <button
              onClick={() => {
                sound.playLockChime();
                onEnterGame();
              }}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-sky-500 hover:from-pink-400 hover:to-sky-400 text-slate-950 font-bold text-sm sm:text-base flex items-center gap-3 mx-auto shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all transform hover:scale-105 active:scale-95"
            >
              <Rocket className="w-5 h-5 text-slate-950" />
              <span>{language === 'mn' ? 'САНСРЫН ТӨВ РҮҮ ОРОХ' : 'ENTER MISSION CONTROL'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
