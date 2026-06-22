'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { applyFaceToVRM, type FaceFrame } from '@/lib/faceToVRM';

interface VRMViewerProps {
  modelUrl: string;
  getFrame: () => FaceFrame | null;
  onStatus?: (s: 'loading' | 'ready' | 'error') => void;
}

export interface VRMViewerHandle {
  capture: () => string | null;
}

const VRMViewer = forwardRef<VRMViewerHandle, VRMViewerProps>(
  function VRMViewer({ modelUrl, getFrame, onStatus }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    useImperativeHandle(ref, () => ({
      capture: () => {
        const r = rendererRef.current;
        if (!r) return null;
        // preserveDrawingBuffer:true なので描画内容をそのまま取り出せる
        return r.domElement.toDataURL('image/png');
      },
    }));

    useEffect(() => {
      const mount = mountRef.current!;
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
      camera.position.set(0, 1.35, 1.4);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const key = new THREE.DirectionalLight(0xffffff, 2.0);
      key.position.set(1, 2, 2);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));

      let vrm: VRM | null = null;
      let raf = 0;
      const clock = new THREE.Clock();

      onStatus?.('loading');
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.load(
        modelUrl,
        (gltf) => {
          vrm = gltf.userData.vrm as VRM;
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          // 正面（カメラ）を向かせる
          vrm.scene.rotation.y = Math.PI;
          scene.add(vrm.scene);
          // 頭〜胸あたりにカメラを合わせる
          const head = vrm.humanoid?.getNormalizedBoneNode('head');
          if (head) {
            const p = new THREE.Vector3();
            head.getWorldPosition(p);
            camera.position.set(0, p.y, 0.65);
            camera.lookAt(0, p.y, 0);
          }
          onStatus?.('ready');
        },
        undefined,
        (err) => {
          console.error('VRM load error:', err);
          onStatus?.('error');
        }
      );

      const animate = () => {
        raf = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        if (vrm) {
          const frame = getFrame();
          if (frame) applyFaceToVRM(vrm, frame);
          vrm.update(dt);
        }
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (vrm) VRMUtils.deepDispose(vrm.scene);
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelUrl]);

    return <div ref={mountRef} className="h-full w-full" />;
  }
);

export default VRMViewer;
