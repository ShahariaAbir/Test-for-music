import { useRef, useEffect, useCallback } from 'react';
import { getFrequencyData } from '@/lib/audioEngine';
import { getVisualizerSettings } from '@/hooks/useVisualizerSettings';

interface VisualizerProps {
  isPlaying: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 255,
    parseInt(h.substring(2, 4), 16) || 255,
    parseInt(h.substring(4, 6), 16) || 255,
  ];
}

export default function Visualizer({ isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const prevDataRef = useRef<Float32Array | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastTimeRef = useRef<number>(0);
  const gradientCacheRef = useRef<{ key: string; gradient: CanvasGradient } | null>(null);

  // Cache settings to avoid localStorage reads every frame
  const settingsRef = useRef<ReturnType<typeof getVisualizerSettings>>(getVisualizerSettings());

  useEffect(() => {
    const id = setInterval(() => { settingsRef.current = getVisualizerSettings(); }, 2000);
    return () => clearInterval(id);
  }, []);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dt = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 16.67, 3) : 1;
    lastTimeRef.current = timestamp;

    const { barCount, sensitivity, barHeightMultiplier, barGap, smoothingAttack, smoothingDecay, barColor, brightness, glowIntensity } = settingsRef.current;

    const [r, g, b] = hexToRgb(barColor);
    // Apply brightness: clamp to 255
    const br = Math.min(Math.round(r * brightness), 255);
    const bg_ = Math.min(Math.round(g * brightness), 255);
    const bb = Math.min(Math.round(b * brightness), 255);

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (sizeRef.current.w !== w || sizeRef.current.h !== h) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      sizeRef.current = { w, h };
      gradientCacheRef.current = null;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rawData = getFrequencyData();

    if (!prevDataRef.current || prevDataRef.current.length !== barCount) {
      prevDataRef.current = new Float32Array(barCount);
    }

    const barWidth = Math.max((w - barGap * (barCount - 1)) / barCount, 1);
    const radius = Math.min(barWidth / 2, 3);

    ctx.clearRect(0, 0, w, h);

    const attackFactor = 1 - Math.pow(1 - Math.min(smoothingAttack * 1.5, 0.95), dt);
    const decayFactor = 1 - Math.pow(1 - smoothingDecay * 0.8, dt);
    const dataLen = rawData.length - 1;

    ctx.shadowBlur = 0;

    for (let i = 0; i < barCount; i++) {
      const freqRatio = Math.pow(i / barCount, 1.15);
      const freqIdx = freqRatio * dataLen;
      const idxLow = freqIdx | 0;
      const idxHigh = Math.min(idxLow + 1, dataLen);
      const frac = freqIdx - idxLow;
      const interpolated = rawData[idxLow] + (rawData[idxHigh] - rawData[idxLow]) * frac;

      const bassBoost = i < barCount * 0.2 ? 1.3 : 1.0;
      const raw = Math.min((interpolated / 255) * sensitivity * bassBoost, 1);

      const prev = prevDataRef.current[i];
      const smoothed = raw > prev
        ? prev + (raw - prev) * attackFactor
        : prev + (raw - prev) * decayFactor;
      prevDataRef.current[i] = smoothed;

      const barHeight = Math.max(smoothed * h * barHeightMultiplier, 2);
      const x = i * (barWidth + barGap);
      const y = h - barHeight;

      const alpha = 0.35 + smoothed * 0.65;
      ctx.fillStyle = `rgba(${br},${bg_},${bb},${alpha})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();
    }

    // Glow pass
    if (glowIntensity > 0) {
      ctx.save();
      ctx.filter = 'blur(5px)';
      ctx.globalAlpha = glowIntensity;
      ctx.drawImage(canvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
