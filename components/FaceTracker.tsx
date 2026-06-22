'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  FilesetResolver,
  FaceLandmarker,
  DrawingUtils,
} from '@mediapipe/tasks-vision';
import type { FaceFrame } from '@/lib/faceToVRM';

interface FaceTrackerProps {
  onFrame: (frame: FaceFrame) => void;
  onReady?: () => void;
}

export interface FaceTrackerHandle {
  // 同期確認用に、現在の表示（顔＋メッシュ）をPNG DataURLで取得
  capture: () => string | null;
}

const FaceTracker = forwardRef<FaceTrackerHandle, FaceTrackerProps>(
  function FaceTracker({ onFrame, onReady }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const rafRef = useRef<number>();
    const lastVideoTimeRef = useRef<number>(-1);

    useImperativeHandle(ref, () => ({
      capture: () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
    }));

    useEffect(() => {
      let stopped = false;

      const init = async () => {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        if (stopped) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        onReady?.();
        loop();
      };

      const loop = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const landmarker = landmarkerRef.current;
        if (!video || !canvas || !landmarker) return;

        if (video.currentTime !== lastVideoTimeRef.current && video.videoWidth) {
          lastVideoTimeRef.current = video.currentTime;

          if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const ctx = canvas.getContext('2d')!;
          // 鏡写しで描画（自撮りの自然な向き）
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();

          const result = landmarker.detectForVideo(video, performance.now());

          if (result.faceLandmarks?.length) {
            const draw = new DrawingUtils(ctx);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            for (const lm of result.faceLandmarks) {
              draw.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                color: 'rgba(74,222,128,0.25)',
                lineWidth: 1,
              });
              draw.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
                color: '#4ade80',
                lineWidth: 2,
              });
            }
            ctx.restore();

            onFrame({
              blendshapes: result.faceBlendshapes?.[0]?.categories,
              matrix: result.facialTransformationMatrixes?.[0]?.data
                ? Array.from(result.facialTransformationMatrixes[0].data)
                : undefined,
            });
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      init().catch((e) => console.error('FaceTracker init failed:', e));

      return () => {
        stopped = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        landmarkerRef.current?.close();
        const stream = videoRef.current?.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="relative">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg border border-edge bg-ink"
        />
      </div>
    );
  }
);

export default FaceTracker;
