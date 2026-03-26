import { useVisualizerSettings } from '@/hooks/useVisualizerSettings';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw, Sparkles, Waves, Palette } from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingRowProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display?: (v: number) => string;
  index: number;
}

function SettingRow({ label, description, value, min, max, step, onChange, display, index }: SettingRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="space-y-2"
    >
      <div className="flex justify-between items-baseline">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm font-mono text-primary tabular-nums">{display ? display(value) : value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </motion.div>
  );
}

const COLOR_PRESETS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
];

export default function Settings() {
  const { settings, update, reset } = useVisualizerSettings();

  return (
    <div className="flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-6 pb-3 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Visualizer customization</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground gap-1.5">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Color & Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 space-y-5"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Palette className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h2>
          </div>

          {/* Color presets */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <div>
                <p className="text-sm font-medium text-foreground">Bar Color</p>
                <p className="text-xs text-muted-foreground">Choose a color for the visualizer bars</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => update({ barColor: preset.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    settings.barColor === preset.value
                      ? 'border-primary scale-110 shadow-lg'
                      : 'border-border/50 hover:border-foreground/30'
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
              {/* Custom color picker */}
              <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-border/50 hover:border-foreground/30 cursor-pointer flex items-center justify-center overflow-hidden transition-all" title="Custom color">
                <span className="text-xs text-muted-foreground">+</span>
                <input
                  type="color"
                  value={settings.barColor}
                  onChange={e => update({ barColor: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <SettingRow index={0} label="Brightness" description="Brightness of the bars" value={settings.brightness} min={0.2} max={2} step={0.05} onChange={v => update({ brightness: v })} display={v => `${Math.round(v * 100)}%`} />
          <SettingRow index={1} label="Glow Intensity" description="How much the bars glow" value={settings.glowIntensity} min={0} max={1} step={0.05} onChange={v => update({ glowIntensity: v })} display={v => `${Math.round(v * 100)}%`} />
        </motion.div>

        {/* Spectrum Bars */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 space-y-5"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Spectrum Bars</h2>
          </div>

          <SettingRow index={2} label="Bar Count" description="Number of frequency bars" value={settings.barCount} min={8} max={128} step={4} onChange={v => update({ barCount: v })} />
          <SettingRow index={3} label="Bar Gap" description="Space between bars (px)" value={settings.barGap} min={0} max={10} step={0.5} onChange={v => update({ barGap: v })} display={v => `${v}px`} />
          <SettingRow index={4} label="Bar Height" description="Maximum bar height multiplier" value={settings.barHeightMultiplier} min={0.3} max={1} step={0.05} onChange={v => update({ barHeightMultiplier: v })} display={v => `${Math.round(v * 100)}%`} />
        </motion.div>

        {/* Responsiveness */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 space-y-5"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/10">
              <Waves className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Responsiveness</h2>
          </div>

          <SettingRow index={5} label="Sensitivity" description="How much the bars react to audio" value={settings.sensitivity} min={0.3} max={3} step={0.1} onChange={v => update({ sensitivity: v })} display={v => `${v.toFixed(1)}x`} />
          <SettingRow index={6} label="Attack Speed" description="How fast bars rise (higher = faster)" value={settings.smoothingAttack} min={0.1} max={1} step={0.05} onChange={v => update({ smoothingAttack: v })} display={v => v.toFixed(2)} />
          <SettingRow index={7} label="Decay Speed" description="How fast bars fall (higher = faster)" value={settings.smoothingDecay} min={0.02} max={0.5} step={0.01} onChange={v => update({ smoothingDecay: v })} display={v => v.toFixed(2)} />
        </motion.div>
      </div>
    </div>
  );
}
