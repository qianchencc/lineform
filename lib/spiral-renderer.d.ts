export interface SpiralSettings {
  rows: number; amplitude: number; frequency: number; speed: number;
  stroke: number; color: string; background: string;
  mask: 'hand' | 'butterfly' | 'leaf' | 'orb' | 'type' | 'custom'; contrast: number; invert: boolean;
  text: string; motion: boolean;
  style: 'spiral' | 'wave' | 'dots' | 'dashes';
  interaction: 'repel' | 'attract' | 'off'; pointerStrength: number;
}
export interface SpiralFrame {
  time: number; duration: number; fps: number; rows: number;
  points: number; playing: boolean; mask: string;
}
export class SpiralRenderer {
  constructor(canvas: HTMLCanvasElement, options?: { onFrame?: (frame: SpiralFrame) => void });
  settings: SpiralSettings;
  playing: boolean;
  update(patch?: Partial<SpiralSettings>): this;
  setPlaying(playing: boolean): this;
  setMask(name: 'hand' | 'butterfly' | 'leaf' | 'orb' | 'type'): this;
  setPointer(clientX: number, clientY: number): this;
  clearPointer(): this;
  setImage(source: HTMLImageElement | HTMLVideoElement): this;
  clearImage(): this;
  resetTime(): this;
  seek(seconds: number): this;
  getTime(): number;
  getStats(): SpiralFrame;
  renderOnce(): void;
  exportPNG(size?: number): Promise<Blob>;
  exportSVG(size?: number): string;
  destroy(): void;
}
