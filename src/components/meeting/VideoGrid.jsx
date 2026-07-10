import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { useLiveKit } from '../../hooks/useMeeting';

export default function AudioVisualizer() {
  const { participants } = useLiveKit();
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 64;
      const barWidth = canvas.width / barCount - 2;
      const isActive = participants.some((p) => p.isSpeaking);

      for (let i = 0; i < barCount; i++) {
        let height;
        if (isActive) {
          height = Math.sin(Date.now() / 300 + i * 0.5) * 0.3 + 0.5;
          height += Math.random() * 0.3;
          height = Math.max(0.1, Math.min(1, height));
        } else {
          height = 0.05 + Math.random() * 0.1;
        }
        const h = height * canvas.height * 0.6;
        const x = i * (barWidth + 2) + 1;
        const y = (canvas.height - h) / 2;

        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        if (isActive) {
          gradient.addColorStop(0, '#60a5fa');
          gradient.addColorStop(1, '#3b82f6');
        } else {
          gradient.addColorStop(0, '#4b5563');
          gradient.addColorStop(1, '#374151');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, [3, 3, 0, 0]);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [participants]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        width: '100%',
        maxWidth: 600,
        mx: 'auto',
      }}
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        style={{ width: '100%', height: '100%' }}
      />
    </Box>
  );
}

export function EmptyAudioState() {
  return (
    <Box
      sx={{
        display: 'flex',
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 600,
        mx: 'auto',
      }}
    >
      <Box sx={{ textAlign: 'center', opacity: 0.4 }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </Box>
    </Box>
  );
}
