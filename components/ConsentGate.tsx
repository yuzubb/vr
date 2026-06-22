'use client';

import { useState } from 'react';

interface ConsentGateProps {
  onAccept: () => void;
  intervalSec: number;
}

/**
 * カメラを起動する前に、何が起きるかをはっきり伝えて同意を取る画面。
 * 顔画像とアバター画像が一定間隔で Discord に送られることを隠さない。
 */
export default function ConsentGate({ onAccept, intervalSec }: ConsentGateProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-xl border border-edge bg-panel p-7">
        <h2 className="mb-1 text-lg font-semibold text-white">
          始める前に
        </h2>
        <p className="mb-5 text-sm text-muted">
          このツールはアバターが顔に正しく追従しているかを確認します。次のことが起きます。
        </p>

        <ul className="mb-6 space-y-3 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="text-signal">●</span>
            カメラ映像はあなたのブラウザ内だけで処理されます。映像そのものは送信しません。
          </li>
          <li className="flex gap-3">
            <span className="text-signal">●</span>
            {intervalSec}秒ごとに「あなたの顔」と「アバターの顔」の静止画を1枚ずつ撮影します。
          </li>
          <li className="flex gap-3">
            <span className="text-warn">●</span>
            撮影した2枚は、設定された Discord チャンネルに送信・保存されます。
          </li>
          <li className="flex gap-3">
            <span className="text-signal">●</span>
            停止ボタンを押せばいつでも撮影と送信を止められます。
          </li>
        </ul>

        <p className="mb-5 rounded-lg border border-edge bg-ink p-3 text-xs text-muted">
          自分以外の人が映る場所で使う場合は、その人にも上記を伝えて同意を得てください。
          送信先の Discord チャンネルに残った画像は、不要になったら削除してください。
        </p>

        <label className="mb-5 flex cursor-pointer items-start gap-3 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-signal"
          />
          上記を理解し、自分の顔の撮影と Discord への送信に同意します。
        </label>

        <button
          onClick={onAccept}
          disabled={!checked}
          className="w-full rounded-lg bg-signal py-3 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          カメラを起動して開始
        </button>
      </div>
    </div>
  );
}
