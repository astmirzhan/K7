import { ImageResponse } from 'next/og';

export const alt = 'K7 — Your goal is a quest. Don’t play it alone.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share card: sky, ground band, the K7 title with a hard ink shadow and three coins.
export default function OpengraphImage() {
  const ink = '#2e1b5b';
  const coin = (left: number, top: number) => (
    <div
      style={{
        position: 'absolute', left, top, width: 56, height: 56, borderRadius: 28,
        background: '#ffc803', border: `6px solid ${ink}`, display: 'flex',
      }}
    />
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#8fa4e7 0%,#9fb4e4 55%,#e0fab2 100%)', position: 'relative' }}>
        {coin(150, 140)}
        {coin(1000, 200)}
        {coin(1040, 400)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, paddingBottom: 90 }}>
          <div style={{ fontSize: 220, fontWeight: 900, color: '#fff', textShadow: `10px 10px 0 ${ink}`, lineHeight: 1 }}>K7</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#fff', textShadow: `5px 5px 0 ${ink}`, marginTop: 10 }}>network sidequesting</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: ink, marginTop: 24 }}>Your goal is a quest. Don’t play it alone.</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 8, background: ink, display: 'flex' }} />
          <div style={{ height: 24, background: '#a6d86a', display: 'flex' }} />
          <div style={{ height: 6, background: ink, display: 'flex' }} />
          <div style={{ flex: 1, background: '#2f6b45', display: 'flex' }} />
        </div>
      </div>
    ),
    size,
  );
}
