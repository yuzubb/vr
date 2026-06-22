import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/**
 * MediaPipe FaceLandmarker の出力を VRM の表情・頭の向きへ反映する。
 *
 * - blendshapes: ARKit互換52種（jawOpen, eyeBlinkLeft ... ）
 * - matrix: 4x4 の顔変換行列（頭の回転と位置）
 */

export interface FaceFrame {
  blendshapes?: { categoryName: string; score: number }[];
  matrix?: number[]; // 16要素（列優先）
}

// ブレンドシェイプ名 → スコアの辞書に変換
function toMap(shapes?: { categoryName: string; score: number }[]) {
  const m: Record<string, number> = {};
  if (!shapes) return m;
  for (const s of shapes) m[s.categoryName] = s.score;
  return m;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 値の急変を抑える簡易ローパス
function smooth(prev: number, next: number, factor = 0.4) {
  return prev + (next - prev) * factor;
}

const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

const state = {
  blink: 0,
  jaw: 0,
  smile: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
};

export function applyFaceToVRM(vrm: VRM, frame: FaceFrame) {
  const b = toMap(frame.blendshapes);

  // --- 表情 ---
  const blinkRaw = (
    (b['eyeBlinkLeft'] ?? 0) + (b['eyeBlinkRight'] ?? 0)
  ) / 2;
  const jawRaw = b['jawOpen'] ?? 0;
  const smileRaw = (
    (b['mouthSmileLeft'] ?? 0) + (b['mouthSmileRight'] ?? 0)
  ) / 2;

  state.blink = smooth(state.blink, clamp01(blinkRaw));
  state.jaw = smooth(state.jaw, clamp01(jawRaw));
  state.smile = smooth(state.smile, clamp01(smileRaw));

  const em = vrm.expressionManager;
  if (em) {
    em.setValue('blink', state.blink);
    em.setValue('aa', state.jaw);        // 口の開き → 「あ」
    em.setValue('happy', state.smile);   // 笑顔
  }

  // --- 頭の向き ---
  if (frame.matrix && frame.matrix.length === 16) {
    _mat.fromArray(frame.matrix);
    _mat.decompose(_pos, _quat, _scale);
    _euler.setFromQuaternion(_quat, 'YXZ');

    // MediaPipe はミラー（自撮り）座標なので yaw/roll を反転して鏡写しに合わせる
    state.yaw = smooth(state.yaw, -_euler.y);
    state.pitch = smooth(state.pitch, _euler.x);
    state.roll = smooth(state.roll, -_euler.z);

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    if (head) {
      head.rotation.set(state.pitch, state.yaw, state.roll);
    }
  }
}
