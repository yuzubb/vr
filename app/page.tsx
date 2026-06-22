'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FaceTracker, { type FaceTrackerHandle } from '@/components/FaceTracker';
import VRMViewer, { type VRMViewerHandle } from '@/components/VRMViewer';
import ConsentGate from '@/components/ConsentGate';
import type { FaceFrame } from '@/lib/faceToVRM';

const INTERVAL_MS = Number(process.env.NEXT_PUBLIC_CAPTURE_INTERVAL_MS) || 30000;
const MODEL_URL = process.env.NEXT_PUBLIC_VRM_MODEL_URL || '/models/avatar.vrm';

type SendState = { at: number; ok: boolean; msg: string } | null;

export default function Home() {
  const [consented, setConsented] = useState(false);
  const [sending, setSending] = useState(false);
  const [vrmStatus, setVrmStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lastSend, setLastSend] = useState<SendState>(null);
  const [countdown, setCountdown] = useState(Math.round(INTERVAL_MS / 1000));

  const frameRef = useRef<FaceFrame | null>(null);
  const faceRef = useRef<FaceTrackerHandle>(null);
  const vrmRef = useRef<VRMViewerHandle>(null);

  const onFrame = useCallback((f: FaceFrame) => {
    frameRef.current = f;
  }, []);
  const getFrame = useCallback(() => frameRef.current, []);

  const sendOnce = useCallback(async () => {
    const realFace = faceRef.current?.capture();
    const avatarFace = vrmRef.current?.capture();
    if (!realFace || !avatarFace) {
      setLastSend({ at: Date.now(), ok: false, msg: '画像をまだ取得できません' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realFace, avatarFace }),
      });
      const data = await res.json();
      setLastSend({
        at: Date.now(),
        ok: data.ok,
        msg: data.ok ? '送信しました' : data.error || '送信に失敗しました',
      });
    } catch (e) {
      setLastSend({ at: Date.now(), ok: false, msg: String(e) });
    } finally {
      setSending(false);
    }
  }, []);

  // 定期送信ループ
  useEffect(() => {
    if (!consented) return;
    setCountdown(Math.round(INTERVAL_MS / 1000));
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? Math.round(INTERVAL_MS / 1000) : c - 1));
    }, 1000);
    const sender = setInterval(sendOnce, INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(sender);
    };
  }, [consented, sendOnce]);

  if (!consented) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <ConsentGate
          onAccept={() => setConsented(true)}
          intervalSec={Math.round(INTERVAL_MS / 1000)}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">VRM 同期チェック</h1>
          <p className="text-sm text-muted">
            左の顔の動きに右のアバターが追従しているか確認します。
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">次の送信まで {countdown}s</span>
          <button
            onClick={sendOnce}
            disabled={sending}
            className="rounded-lg border border-edge bg-panel px-4 py-2 text-gray-200 transition hover:border-signal disabled:opacity-50"
          >
            {sending ? '送信中…' : '今すぐ送信'}
          </button>
          <button
            onClick={() => setConsented(false)}
            className="rounded-lg border border-edge bg-panel px-4 py-2 text-warn transition hover:border-warn"
          >
            停止
          </button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">実際の顔</h2>
            <span className="text-xs text-signal">MediaPipe</span>
          </div>
          <FaceTracker ref={faceRef} onFrame={onFrame} />
        </section>

        <section className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">アバター</h2>
            <span
              className={
                vrmStatus === 'ready'
                  ? 'text-xs text-signal'
                  : vrmStatus === 'error'
                  ? 'text-xs text-warn'
                  : 'text-xs text-muted'
              }
            >
              {vrmStatus === 'ready' ? 'VRM' : vrmStatus === 'error' ? 'モデル読込失敗' : '読込中…'}
            </span>
          </div>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-edge bg-ink">
            <VRMViewer ref={vrmRef} modelUrl={MODEL_URL} getFrame={getFrame} onStatus={setVrmStatus} />
          </div>
          {vrmStatus === 'error' && (
            <p className="mt-3 text-xs text-warn">
              public/models/avatar.vrm が見つかりません。VRoid Hub などで入手したVRMを置いてください。
            </p>
          )}
        </section>
      </div>

      <footer className="mt-5 flex items-center justify-between rounded-lg border border-edge bg-panel px-4 py-3 text-xs">
        <span className="text-muted">
          {Math.round(INTERVAL_MS / 1000)}秒ごとに2枚の静止画を Discord へ送信します。
        </span>
        {lastSend && (
          <span className={lastSend.ok ? 'text-signal' : 'text-warn'}>
            {new Date(lastSend.at).toLocaleTimeString('ja-JP')} — {lastSend.msg}
          </span>
        )}
      </footer>
    </main>
  );
}
