import { useState, useEffect, useCallback } from 'react';

export interface VisualizerSettings {
  barCount: number;
  sensitivity: number;
  barHeightMultiplier: number;
  barGap: number;
  smoothingAttack: number;
  smoothingDecay: number;
  barColor: string;       // hex color
  brightness: number;     // 0.2 – 2.0
  glowIntensity: number;  // 0 – 1
}

const STORAGE_KEY = 'sonicwave_visualizer_settings';

const defaults: VisualizerSettings = {
  barCount: 48,
  sensitivity: 1,
  barHeightMultiplier: 0.92,
  barGap: 3,
  smoothingAttack: 0.6,
  smoothingDecay: 0.15,
  barColor: '#ffffff',
  brightness: 1,
  glowIntensity: 0.25,
};

function load(): VisualizerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

export function getVisualizerSettings(): VisualizerSettings {
  return load();
}

export function useVisualizerSettings() {
  const [settings, setSettings] = useState<VisualizerSettings>(load);

  const update = useCallback((partial: Partial<VisualizerSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings({ ...defaults });
  }, []);

  return { settings, update, reset, defaults };
}
