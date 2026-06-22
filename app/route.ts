import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 顔とアバターのスクショ（PNG DataURL）を受け取り、Discord に送る。
 * Webhook URL はサーバー側の環境変数だけで扱い、ブラウザには出さない。
 */
export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: 'DISCORD_WEBHOOK_URL is not set' },
      { status: 500 }
    );
  }

  let body: { realFace?: string; avatarFace?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const { realFace, avatarFace, note } = body;
  if (!realFace || !avatarFace) {
    return NextResponse.json(
      { ok: false, error: 'realFace and avatarFace are required' },
      { status: 400 }
    );
  }

  const dataUrlToBlob = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] ?? '';
    const buf = Buffer.from(base64, 'base64');
    return new Blob([buf], { type: 'image/png' });
  };

  const embed = {
    title: '同期チェック',
    description: note?.slice(0, 400) || 'アバターが顔に追従しているかの定期確認です。',
    color: 0x4ade80,
    fields: [
      { name: '左', value: '実際の顔（メッシュ付き）', inline: true },
      { name: '右', value: 'VRMアバター', inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  const form = new FormData();
  form.append('payload_json', JSON.stringify({ embeds: [embed] }));
  form.append('files[0]', dataUrlToBlob(realFace), 'real_face.png');
  form.append('files[1]', dataUrlToBlob(avatarFace), 'avatar_face.png');

  try {
    const res = await fetch(webhookUrl, { method: 'POST', body: form });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: `Discord responded ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 502 }
    );
  }
}
