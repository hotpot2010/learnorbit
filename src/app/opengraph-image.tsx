import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Aitutorly - AI驱动的个性化学习平台';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '80px',
            margin: '40px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#1a202c',
              margin: '0 0 24px 0',
              textAlign: 'center',
            }}
          >
            Aitutorly
          </h1>
          <p
            style={{
              fontSize: '36px',
              color: '#4a5568',
              margin: '0',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: '1.4',
            }}
          >
            AI驱动的个性化学习平台
          </p>
          <p
            style={{
              fontSize: '24px',
              color: '#718096',
              margin: '24px 0 0 0',
              textAlign: 'center',
            }}
          >
            智能定制 • 高效学习 • 个性化体验
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
