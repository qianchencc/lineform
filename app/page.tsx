'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SpiralRenderer } from '../lib/spiral-renderer.js';

type Preset = 'hand' | 'butterfly' | 'leaf' | 'type' | 'orb' | 'custom';
type DrawingStyle = 'spiral' | 'wave' | 'dots' | 'dashes';
type Settings = { rows: number; amplitude: number; frequency: number; speed: number; stroke: number; color: string; contrast: number; invert: boolean; text: string; style: DrawingStyle; interaction: 'repel' | 'attract' | 'off'; pointerStrength: number };
type Frame = { time: number; duration: number; fps: number; playing: boolean; points: number; rows: number; mask: string };
type Engine = SpiralRenderer;
const INITIAL: Settings = { rows: 32, amplitude: 1, frequency: 1, speed: .65, stroke: 1.1, color: '#e8ed94', contrast: 1, invert: false, text: 'S', style: 'spiral', interaction: 'repel', pointerStrength: 1 };
const COLORS = [['#e8ed94', '浅柠黄'], ['#eeeee6', '纸白'], ['#9fc5e8', '雾蓝'], ['#efa778', '杏橙']];
const PRESETS: { id: Preset; label: string }[] = [{ id: 'hand', label: '手势' }, { id: 'butterfly', label: '蝴蝶' }, { id: 'leaf', label: '银杏' }, { id: 'orb', label: '球体' }, { id: 'type', label: '字形' }];
const NAMES: Record<Preset, string> = { hand: 'HAND', butterfly: 'BUTTERFLY', leaf: 'GINKGO', type: 'TYPOGRAPHY', orb: 'SPHERE', custom: 'YOUR IMAGE' };
const STYLES: { id: DrawingStyle; label: string; description: string }[] = [{ id: 'spiral', label: '螺旋', description: '连续椭圆线圈' }, { id: 'wave', label: '波纹', description: '流动的起伏曲线' }, { id: 'dots', label: '点阵', description: '呼吸的圆点' }, { id: 'dashes', label: '短线', description: '随风摆动的线段' }];

function PatternIcon({ style }: { style: DrawingStyle }) {
  return <svg viewBox="0 0 52 24" width="46" height="22" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
    {style === 'spiral' && <path d="M2 12h6c9 0 0-9 7-9s-1 18 6 18S20 3 27 3s-1 18 6 18-2-9 8-9h9"/>}
    {style === 'wave' && <><path d="M2 12C8 12 8 4 14 4S20 20 26 20 32 4 38 4 44 12 50 12"/><path d="M2 20C8 20 8 12 14 12S20 28 26 28" opacity=".3"/></>}
    {style === 'dots' && <g fill="currentColor" stroke="none">{[0,1,2,3,4].map(i => <g key={i}><circle cx={6 + i * 10} cy="7" r={i === 2 ? 2.8 : 1.8}/><circle cx={6 + i * 10} cy="17" r={i === 2 ? 2.8 : 1.8}/></g>)}</g>}
    {style === 'dashes' && <path d="m5 15 4-7m6 9 3-11m6 12 3-12m6 11 4-9m6 7 4-6"/>}
  </svg>;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 15v5h14v-5"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 16v4h16v-4"/></>,
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3"/></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8"/><path d="M4 4v6h6"/></>,
    arrow: <><path d="M5 19 19 5M6 5h13v13"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    info: <><circle cx="12" cy="12" r="8"/><path d="M12 11v6m0-10v1"/></>,
    fullscreen: <><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>;
}

function Slider({ label, value, min, max, step, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (n: number) => void }) {
  return <label className="slider-control"><span className="control-label">{label}<output>{step >= 1 ? value : value.toFixed(step === .1 ? 1 : 2)}{suffix}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ '--progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties}/></label>;
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Engine | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<{ url: string; element: HTMLImageElement } | null>(null);
  const uploadEpoch = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settings, setSettings] = useState<Settings>(INITIAL);
  const [preset, setPreset] = useState<Preset>('hand');
  const [frame, setFrame] = useState<Frame>({ time: 0, duration: 12, fps: 60, playing: true, points: 0, rows: 32, mask: 'hand' });
  const [sourceName, setSourceName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');

  function notify(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4200);
  }
  function releaseMedia() {
    const media = mediaRef.current;
    if (media) URL.revokeObjectURL(media.url);
    mediaRef.current = null;
  }
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new SpiralRenderer(canvasRef.current, { onFrame: (next: Frame) => setFrame(next) }) as Engine;
    renderer.current = engine;
    engine.update(INITIAL);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) engine.setPlaying(false);
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.code !== 'Space' || event.repeat || target.closest('input, textarea, button, select, [contenteditable="true"], dialog')) return;
      event.preventDefault();
      engine.setPlaying(!engine.getStats().playing);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      engine.destroy(); renderer.current = null; uploadEpoch.current++;
      releaseMedia(); window.removeEventListener('keydown', onKey);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings(current => ({ ...current, ...patch }));
    renderer.current?.update(patch);
  }
  function selectPreset(next: Preset) {
    if (next === 'custom') return;
    uploadEpoch.current++;
    update({ contrast: 1, invert: false });
    renderer.current?.setMask(next);
    releaseMedia(); setSourceName(''); setPreset(next);
  }
  function reset() {
    selectPreset('hand');
    setSettings(INITIAL); renderer.current?.update(INITIAL); renderer.current?.resetTime();
    notify('已恢复初始效果');
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('请选择图片文件，例如 PNG、JPG、WebP 或 SVG'); return; }
    const epoch = ++uploadEpoch.current;
    const url = URL.createObjectURL(file);
    const element = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('加载超时，请换一个文件试试')), 15000);
        const loaded = () => { clearTimeout(timeout); resolve(); };
        element.onerror = () => { clearTimeout(timeout); reject(new Error('浏览器无法读取这个文件，请尝试 PNG、JPG 或 WebP')); };
        element.onload = loaded;
        element.src = url;
      });
      if (epoch !== uploadEpoch.current || !renderer.current) { URL.revokeObjectURL(url); return; }
      renderer.current.setImage(element); releaseMedia(); mediaRef.current = { url, element };
      setPreset('custom'); setSourceName(file.name);
      notify('图片已载入，试着移动鼠标或切换绘制方式');
    } catch (error) {
      URL.revokeObjectURL(url);
      if (epoch === uploadEpoch.current) notify(error instanceof Error ? error.message : '文件载入失败');
    }
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function exportImage(format: 'png' | 'svg') {
    if (!renderer.current || exporting) return;
    setExporting(true);
    try {
      const blob = format === 'png' ? await renderer.current.exportPNG(2400) : new Blob([renderer.current.exportSVG(1600)], { type: 'image/svg+xml' });
      download(blob, `lineform-${settings.style}-${preset}-${Date.now()}.${format}`);
      notify(format === 'png' ? '已导出 2400 × 2400 PNG' : '已导出可编辑 SVG 图形');
    } catch { notify('导出未完成，请重试'); }
    finally { setExporting(false); }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen();
      else notify('当前浏览器不支持全屏');
    } catch { notify('当前浏览器无法进入全屏'); }
  }

  const patternLabel = STYLES.find(item => item.id === settings.style)?.label;
  const discrete = settings.style === 'dots' || settings.style === 'dashes';
  const pointerHint = settings.interaction === 'off' ? '自由流动 · 可开启鼠标感应' : settings.interaction === 'attract' ? '移动鼠标聚拢图形，移开后自动复位' : '移动鼠标推开图形，移开后自动复位';

  return <div className="app-shell">
    <header className="topbar">
      <a className="wordmark" href="#main" aria-label="线条成像工作台">
        <svg viewBox="0 0 42 28" width="42" height="28" fill="none" aria-hidden="true"><path d="M2 14h5c7 0 2-10 7-10s0 20 5 20S19 4 24 4s0 20 5 20-1-10 6-10h5" stroke="currentColor" strokeWidth="1.5"/></svg>
        <span>LINEFORM<span className="wordmark-light"> LAB</span></span>
      </a>
      <div className="header-actions"><span className="edition mono">INTERACTIVE STUDY / 002</span><button className="text-button help-button" onClick={() => helpRef.current?.showModal()}><Icon name="info"/>成像原理</button></div>
    </header>
    <main id="main">
      <section className="intro">
        <div><div className="eyebrow mono">A FORM THAT RESPONDS TO YOU</div><h1>线条成像<span className="title-period">.</span></h1><p>让图像随线条流动，让鼠标参与其中。</p></div>
        <button className="primary-button" onClick={() => exportImage('png')} disabled={exporting}><Icon name="download"/>{exporting ? '正在导出' : '导出图像'}<span className="button-format mono">PNG</span></button>
      </section>
      <div className="workspace">
        <section className="art-panel" aria-label="实时交互图像预览">
          <div className="art-topline"><span className="mono">{NAMES[preset]}<span className="faint"> / {patternLabel}</span></span><span className="live-state"><span className={frame.playing ? 'status-dot' : 'status-dot paused'}/>{frame.playing ? '实时绘制' : '流动已暂停'}</span></div>
          <div className={`canvas-stage ${dragging ? 'is-dragging' : ''}`} ref={stageRef}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={e => { if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
            onDrop={e => { e.preventDefault(); setDragging(false); importFile(e.dataTransfer.files[0]); }}>
            <canvas ref={canvasRef} aria-label="可随鼠标变形的实时图形"
              onPointerMove={e => renderer.current?.setPointer(e.clientX, e.clientY)}
              onPointerDown={e => renderer.current?.setPointer(e.clientX, e.clientY)}
              onPointerLeave={() => renderer.current?.clearPointer()}
              onPointerCancel={() => renderer.current?.clearPointer()}
              onPointerUp={e => { if (e.pointerType !== 'mouse') renderer.current?.clearPointer(); }}>
              你的浏览器需要支持 Canvas 才能查看动态效果。
            </canvas>
            <i className="corner corner-tl"/><i className="corner corner-tr"/><i className="corner corner-bl"/><i className="corner corner-br"/>
            <span className="stage-note mono">{settings.interaction === 'off' ? 'FREE FLOW' : 'MOVE YOUR CURSOR'}</span>
            <button className="icon-button fullscreen-button" title="全屏预览" aria-label="全屏预览" onClick={fullscreen}><Icon name="fullscreen"/></button>
            {dragging && <div className="drop-overlay"><Icon name="upload" size={32}/><span>放入你的图片</span></div>}
          </div>
          <div className="transport interactive-transport">
            <button className="flow-toggle" onClick={() => renderer.current?.setPlaying(!frame.playing)} aria-label={frame.playing ? '暂停自动流动' : '开启自动流动'} title="空格键切换自动流动"><Icon name={frame.playing ? 'pause' : 'play'} size={15}/><span>{frame.playing ? '暂停流动' : '继续流动'}</span></button>
            <span className="transport-divider"/>
            <span className="pointer-hint">{pointerHint}</span>
            <span className="live-tag mono">LIVE</span>
          </div>
        </section>
        <aside className="inspector" aria-label="效果参数">
          <div className="inspector-heading"><h2>创作参数</h2><button className="text-button reset-button" onClick={reset}><Icon name="reset" size={14}/>重置</button></div>
          <section className="control-section pattern-section">
            <div className="section-label">绘制方式</div>
            <div className="pattern-grid" role="group" aria-label="选择绘制方式">{STYLES.map(item => <button key={item.id} aria-label={item.label} aria-pressed={settings.style === item.id} className={settings.style === item.id ? 'selected' : ''} onClick={() => update({ style: item.id })} title={item.description}><PatternIcon style={item.id}/><span>{item.label}</span></button>)}</div>
          </section>
          <section className="control-section source-section">
            <div className="section-label">图像轮廓</div>
            <div className="preset-tabs image-presets" role="group" aria-label="选择图像">
              {PRESETS.map(item => <button key={item.id} className={preset === item.id ? 'selected' : ''} aria-pressed={preset === item.id} onClick={() => selectPreset(item.id)}>{item.label}</button>)}
              <button className={preset === 'custom' ? 'selected import-preset' : 'import-preset'} onClick={() => fileRef.current?.click()}><Icon name="upload" size={12}/>导入</button>
            </div>
            {preset === 'type' && <label className="type-control"><span>输入字形</span><input maxLength={3} value={settings.text} aria-label="字形内容，最多三个字" onChange={e => update({ text: e.target.value })} placeholder="S"/></label>}
            <input className="sr-only" ref={fileRef} type="file" accept="image/*" onChange={e => { importFile(e.target.files?.[0]); e.target.value = ''; }} tabIndex={-1}/>
            {preset === 'custom' ? <div className="custom-source"><span title={sourceName}>{sourceName}</span><button onClick={() => selectPreset('hand')} aria-label="移除上传素材"><Icon name="close" size={13}/></button></div> : <p className="field-note">支持自己的 Logo、文字、照片或剪影</p>}
            {preset === 'custom' && <div className="custom-adjust"><Slider label="明暗对比" value={settings.contrast} min={.2} max={3} step={.1} onChange={v => update({ contrast: v })}/><label className="check-control"><input type="checkbox" checked={settings.invert} onChange={e => update({ invert: e.target.checked })}/><span>反相成像</span></label></div>}
          </section>
          <section className="control-section pointer-section">
            <div className="section-label">鼠标感应</div>
            <div className="preset-tabs pointer-tabs" role="group" aria-label="鼠标感应方式">
              <button className={settings.interaction === 'repel' ? 'selected' : ''} aria-pressed={settings.interaction === 'repel'} onClick={() => update({ interaction: 'repel' })}>推开</button>
              <button className={settings.interaction === 'attract' ? 'selected' : ''} aria-pressed={settings.interaction === 'attract'} onClick={() => update({ interaction: 'attract' })}>吸引</button>
              <button className={settings.interaction === 'off' ? 'selected' : ''} aria-pressed={settings.interaction === 'off'} onClick={() => update({ interaction: 'off' })}>关闭</button>
            </div>
            {settings.interaction !== 'off' && <div className="pointer-strength"><Slider label="感应强度" value={settings.pointerStrength} min={0} max={2} step={.1} onChange={v => update({ pointerStrength: v })}/></div>}
          </section>
          <section className="control-section structure-section">
            <div className="section-label">形态参数</div>
            <div className="sliders">
              <Slider label="排列行数" value={settings.rows} min={16} max={64} step={1} onChange={v => update({ rows: v })}/>
              <Slider label={discrete ? '图元大小' : settings.style === 'wave' ? '起伏幅度' : '螺旋振幅'} value={settings.amplitude} min={0} max={1.6} step={.05} onChange={v => update({ amplitude: v })}/>
              <Slider label={discrete ? '图元密度' : '线条频率'} value={settings.frequency} min={.5} max={1.7} step={.05} onChange={v => update({ frequency: v })}/>
              <Slider label="笔触粗细" value={settings.stroke} min={.5} max={2.3} step={.1} onChange={v => update({ stroke: v })}/>
            </div>
          </section>
          <section className="control-section motion-section">
            <div className="section-label">流动与色彩</div><Slider label="流动速度" value={settings.speed} min={0} max={1.8} step={.05} suffix="×" onChange={v => update({ speed: v })}/>
            <div className="palette-row"><span>图形颜色</span><div className="palette" role="group" aria-label="图形颜色">{COLORS.map(([color, label]) => <button key={color} className={`swatch ${color === settings.color ? 'active' : ''}`} style={{ '--swatch': color } as CSSProperties} title={label} aria-label={label} aria-pressed={color === settings.color} onClick={() => update({ color })}/>)}</div></div>
          </section>
          <div className="export-row"><button className="secondary-button" onClick={() => exportImage('svg')} disabled={exporting}><span>导出矢量图形</span><span className="mono">SVG ↗</span></button><p className="field-note">图片仅在当前浏览器中处理</p></div>
        </aside>
      </div>
      <footer className="page-footer"><span className="footer-caption">同一张图像，不同的形态。</span><a href="https://xhslink.cn/o/17FlIYE0rch" target="_blank" rel="noreferrer">螺旋灵感 <span className="mono">SUPERWORLD</span><Icon name="arrow" size={13}/></a></footer>
    </main>
    <dialog ref={helpRef} className="help-dialog" aria-labelledby="help-title" onClick={e => { if (e.target === e.currentTarget) helpRef.current?.close(); }}>
      <div className="dialog-inner"><button className="icon-button dialog-close" onClick={() => helpRef.current?.close()} aria-label="关闭成像原理"><Icon name="close"/></button>
        <div className="eyebrow mono">IMAGE × FORM × INTERACTION</div><h2 id="help-title">同一张图，四种表达。</h2>
        <p className="dialog-lead">图像提供轮廓，线条和圆点将它画出来。时间带来自然流动，鼠标让局部形态发生变化。</p>
        <ol className="principles">
          <li><span className="mono">01</span><div><h3>选择图像</h3><p>使用内置轮廓，或导入自己的 Logo、文字、剪影、照片。透明底图像读取轮廓，普通照片读取明暗。</p></div></li>
          <li><span className="mono">02</span><div><h3>替换图元</h3><p>同一图像可切换成螺旋、波纹、点阵或短线。图像亮度控制起伏与大小。</p></div></li>
          <li><span className="mono">03</span><div><h3>让鼠标参与</h3><p>靠近时局部推开或聚拢，移开后柔和复位。暂停自动流动后，鼠标感应依然有效。</p></div></li>
        </ol>
        <div className="equations mono"><div>图像亮度 → 图元形态</div><div>鼠标距离 → 局部位移</div></div>
        <p className="equation-key">触屏可点按画布，页面仍可正常上下滚动。</p>
        <a className="reference-link" href="https://xhslink.cn/o/17FlIYE0rch" target="_blank" rel="noreferrer"><span>初始螺旋效果参考 SUPERWORLD 的 Houdini 教程</span><Icon name="arrow" size={16}/></a>
        <p className="dialog-footnote">全部效果均由网页实时绘制。</p>
      </div>
    </dialog>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
  </div>;
}
