let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function getAnalyser(): AnalyserNode {
  if (!analyser) {
    const ctx = getAudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; // High resolution for smooth spectrum
    analyser.smoothingTimeConstant = 0.65; // Lower = more reactive to beats
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.connect(ctx.destination);
  }
  return analyser;
}

export function connectAudioElement(audio: HTMLAudioElement): void {
  if (connectedElement === audio) return;
  const ctx = getAudioContext();
  const an = getAnalyser();

  if (sourceNode) {
    try { sourceNode.disconnect(); } catch {}
  }

  sourceNode = ctx.createMediaElementSource(audio);
  sourceNode.connect(an);
  connectedElement = audio;
}

export function getFrequencyData(): Uint8Array {
  const an = getAnalyser();
  const data = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(data);
  return data;
}

export function resumeAudioContext(): void {
  if (audioContext?.state === 'suspended') {
    audioContext.resume();
  }
}
