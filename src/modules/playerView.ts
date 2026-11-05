import {
  FORMULA_SHEETS,
  LECTURE_CHAPTERS,
  LECTURE_COVER_PATH,
  LECTURE_TOTAL_DURATION_SECONDS,
  MENTOR_AVATAR_PATH,
} from '../constants';
import { dataStore } from '../services/firebaseService';
import type { VideoRoadmapItem } from '../types';
import { formatDuration } from '../utils/examLogic';
import { downloadFormulaSheetFile } from '../utils/qrGenerator';

export interface PlayerCallbacks {
  onShowToast: (message: string) => void;
}

const SPEED_RATES = [0.75, 1.0, 1.25, 1.5, 2.0];

export class PlayerModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: PlayerCallbacks;
  private activeVideo: VideoRoadmapItem;
  private activeTab: 'chapters' | 'doubts' | 'formulas' | 'scratchpad' = 'chapters';
  private isPlaying = true;
  private isLandscapeMode = true;
  private currentTimeSeconds = 525;
  private totalDurationSeconds = LECTURE_TOTAL_DURATION_SECONDS;
  private playbackRateIndex = 1; // 1.0x default
  private volume = 85;
  private isMuted = false;
  private animFrameId: number | null = null;
  private lastTickMs = 0;
  private lastAutoSaveMs = 0;
  private copiedFormulaIndex: number | null = null;

  constructor(callbacks: PlayerCallbacks) {
    this.callbacks = callbacks;
    const saved = dataStore.getLectureProgress();
    this.currentTimeSeconds = saved.lastPositionSeconds || 525;
    this.activeVideo = dataStore.getVideoById();
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const params = new URLSearchParams(window.location.search);
    const vidParam = params.get('videoId');
    this.activeVideo = dataStore.getVideoById(vidParam);
    const modeParam = params.get('mode');
    this.isLandscapeMode = modeParam !== 'vertical';
    const saved = dataStore.getLectureProgress();
    this.currentTimeSeconds = saved.lastPositionSeconds ?? 525;
    this.rerender();
    this.drawLectureCanvasFrame();
    if (this.isPlaying) {
      this.lastTickMs = performance.now();
      this.startLoop();
    }
  }

  public unmount(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isPlaying = false;
  }

  private hasRealVideoFile(vid: VideoRoadmapItem): boolean {
    if (!vid.videoUrl) return false;
    if (vid.videoUrl.startsWith('blob:')) {
      return (
        typeof window !== 'undefined' &&
        vid.videoUrl.startsWith(`blob:${window.location.origin}`)
      );
    }
    return (
      vid.videoUrl.startsWith('data:video/') ||
      vid.videoUrl.endsWith('.mp4') ||
      vid.videoUrl.endsWith('.webm')
    );
  }

  private getActiveChapter() {
    let active = LECTURE_CHAPTERS[0];
    for (const ch of LECTURE_CHAPTERS) {
      if (this.currentTimeSeconds >= ch.timestampSeconds) {
        active = ch;
      }
    }
    return active;
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const progress = dataStore.getLectureProgress();
    const activeChapter = this.getActiveChapter();
    const currentSpeed = SPEED_RATES[this.playbackRateIndex];
    const progressPct = Math.min(
      100,
      (this.currentTimeSeconds / this.totalDurationSeconds) * 100
    );
    const bufferedPct = Math.min(100, progressPct + 18);
    const mechanicsSheet = FORMULA_SHEETS[0];
    const allVideos = dataStore.getVideos();
    const suggestedVideos = allVideos.filter((v) => v.id !== this.activeVideo.id);
    const videoDoubts = dataStore.getVideoDoubts(this.activeVideo.id);
    const isRealVideo = this.hasRealVideoFile(this.activeVideo);

    this.containerEl.innerHTML = `
      <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-5" data-testid="dedicated-youtube-player-page">
        <!-- Top Navigation & Orientation Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 shadow-2xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <a
              href="/mentorship.html"
              class="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-extrabold text-slate-800 shrink-0 inline-flex items-center gap-1"
            >
              <span>← Back to Lectures</span>
            </a>
            <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#4F46E5] text-[11px] font-extrabold truncate">
              📁 ${this.escapeHtml(this.activeVideo.section || 'Physics Masterclass')}
            </span>
            <span class="hidden md:inline text-xs font-mono-tabular text-slate-500" id="player-resume-badge">
              Auto-saved @ ${formatDuration(this.currentTimeSeconds)}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              data-action="toggle-landscape-fullscreen"
              data-testid="toggle-landscape-mode-btn"
              class="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-xs font-extrabold transition-colors"
            >
              📱 ${this.isLandscapeMode ? 'Exit Landscape Mode' : 'Rotate Horizontal Fullscreen'}
            </button>
            <button
              type="button"
              data-action="toggle-lecture-complete"
              class="min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 ${
                progress.completed
                  ? 'bg-emerald-50 border-emerald-300 text-[#10B981]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
              }"
            >
              ${progress.completed ? '✓ Completed' : 'Mark Complete'}
            </button>
          </div>
        </div>

        <!-- YOUTUBE-STYLE RESPONSIVE GRID: Left/Top Video Player + Details (8 cols) | Right/Bottom Suggested Videos Queue (4 cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 8 Cols: Sticky Mobile/Desktop Video Stage + Metadata + Interactive Tabs -->
          <div class="lg:col-span-8 space-y-4">
            <!-- Custom Distraction-Free Video Player Stage -->
            <section
              aria-label="Custom Video Lecture Player"
              id="video-player-stage"
              class="${
                this.isLandscapeMode
                  ? 'fixed inset-0 z-50 bg-black flex flex-col justify-center'
                  : 'relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl'
              }"
            >
              <!-- Visual Simulation Canvas or HTML5 Video -->
              <div class="relative aspect-video w-full bg-slate-950 overflow-hidden">
                ${
                  isRealVideo
                    ? `
                  <video
                    id="player-real-video-el"
                    src="${this.activeVideo.videoUrl}"
                    poster="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                    playsinline
                    class="w-full h-full object-contain bg-black cursor-pointer"
                  ></video>
                `
                    : `
                  <img
                    src="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                    alt="${this.escapeHtml(this.activeVideo.title)}"
                    referrerpolicy="no-referrer"
                    class="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                  />
                  <canvas
                    id="lecture-simulation-canvas"
                    width="1280"
                    height="720"
                    class="relative z-10 w-full h-full block cursor-pointer"
                    aria-label="Interactive Physics Lecture Stream"
                  ></canvas>
                `
                }

                <!-- Live Playing Status Pill & Top-Left Back Link in Fullscreen Horizontal Mode -->
                <div class="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <a
                    href="/mentorship.html"
                    class="px-3 py-1.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-[11px] font-extrabold text-white inline-flex items-center gap-1 shadow-md"
                  >
                    <span>← Back</span>
                  </a>
                  <div class="pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-[10px] font-mono-tabular text-white">
                    <span class="w-2 h-2 rounded-full ${this.isPlaying ? 'bg-[#10B981] animate-ping' : 'bg-amber-400'}"></span>
                    <span>${this.isPlaying ? 'FULLSCREEN HORIZONTAL STREAM' : 'PAUSED — TAP TO PLAY'}</span>
                  </div>
                </div>

                <!-- Top-Right Crop / Orientation Toggle Sign (Switch Between Horizontal Fullscreen & Vertical YouTube Mode with Suggested Videos Below) -->
                <div class="absolute top-3 right-3 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    data-action="toggle-landscape-fullscreen"
                    data-testid="player-crop-vertical-toggle-btn"
                    title="Crop / Orientation Toggle: Switch between Horizontal Full-Screen and Vertical YouTube View with Suggested Videos below"
                    class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-500 text-white border border-indigo-300/40 text-xs font-extrabold shadow-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2"/>
                    </svg>
                    <span>${this.isLandscapeMode ? '🔄 Vertical & Suggested Videos' : '⛶ Horizontal Fullscreen'}</span>
                  </button>
                </div>

                <!-- Touch-Friendly Overlay Transport Controls -->
                <div class="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-4 pointer-events-none">
                  <button
                    type="button"
                    data-action="seek-rewind"
                    aria-label="Rewind 10 seconds"
                    class="pointer-events-auto min-h-[42px] min-w-[42px] px-3 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 text-white text-xs font-mono font-bold shadow-md transition-transform active:scale-95"
                  >
                    -10s
                  </button>
                  <button
                    type="button"
                    id="center-play-btn"
                    data-action="toggle-play"
                    data-testid="player-center-play-btn"
                    aria-label="${this.isPlaying ? 'Pause Lecture' : 'Play Lecture'}"
                    class="pointer-events-auto w-14 h-14 rounded-full bg-[#4F46E5] hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                  >
                    ${
                      this.isPlaying
                        ? `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>`
                        : `<svg class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`
                    }
                  </button>
                  <button
                    type="button"
                    data-action="seek-forward"
                    aria-label="Forward 10 seconds"
                    class="pointer-events-auto min-h-[42px] min-w-[42px] px-3.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 text-white text-xs font-mono font-bold shadow-md transition-transform active:scale-95"
                  >
                    +10s
                  </button>
                </div>
              </div>

              <!-- Custom Touch-Friendly Player Control Bar -->
              <div class="bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-2.5 text-white">
                <div class="space-y-1">
                  <div class="relative flex items-center">
                    <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden pointer-events-none">
                      <div
                        id="player-buffered-bar"
                        class="h-full bg-indigo-500/40"
                        style="width: ${bufferedPct}%"
                      ></div>
                    </div>
                    <input
                      id="player-scrubber"
                      type="range"
                      min="0"
                      max="${this.totalDurationSeconds}"
                      step="1"
                      value="${Math.floor(this.currentTimeSeconds)}"
                      aria-label="Seek lecture timeline position in seconds"
                      class="absolute inset-0 w-full h-2 opacity-90 accent-[#4F46E5] cursor-pointer"
                    />
                  </div>
                  <div class="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-300">
                    <span id="player-time-display">
                      ${formatDuration(this.currentTimeSeconds)} / ${formatDuration(this.totalDurationSeconds)}
                    </span>
                    <span id="player-active-chapter-label" class="text-indigo-300 truncate max-w-xs sm:max-w-md">
                      ${this.escapeHtml(activeChapter.title)}
                    </span>
                  </div>
                </div>

                <!-- Control Buttons Row -->
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      data-action="toggle-play"
                      aria-label="${this.isPlaying ? 'Pause' : 'Play'}"
                      class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      ${this.isPlaying ? '❚❚ Pause' : '▶ Play'}
                    </button>
                    <button
                      type="button"
                      data-action="toggle-mute"
                      class="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 text-xs font-mono"
                    >
                      ${this.isMuted || this.volume === 0 ? '🔇 Muted' : `🔊 ${this.volume}%`}
                    </button>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      data-action="cycle-speed"
                      class="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 text-xs font-mono tabular-nums font-bold"
                    >
                      ${currentSpeed}x
                    </button>
                    <button
                      type="button"
                      data-action="toggle-landscape-fullscreen"
                      class="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      ${this.isLandscapeMode ? 'Exit Landscape' : '⇄ Landscape'}
                    </button>
                    <button
                      type="button"
                      data-action="toggle-fullscreen"
                      class="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      ⛶ Fullscreen
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- YouTube-Style Video Title, Channel/Mentor Card & Quick Actions -->
            <section class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] text-[11px] font-extrabold">
                    ${this.escapeHtml(this.activeVideo.section || 'Physics Masterclass')}
                  </span>
                  <span class="text-xs text-slate-500 font-semibold">
                    ${this.escapeHtml(this.activeVideo.topicTag)}
                  </span>
                </div>
                <h1 class="text-base sm:text-xl font-extrabold text-slate-900">
                  ${this.escapeHtml(this.activeVideo.title)}
                </h1>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-3">
                  <img
                    src="${this.activeVideo.mentorAvatar || MENTOR_AVATAR_PATH}"
                    alt="${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}"
                    referrerpolicy="no-referrer"
                    class="w-10 h-10 rounded-full object-cover border border-indigo-200"
                  />
                  <div>
                    <div class="text-xs sm:text-sm font-extrabold text-slate-900">
                      ${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}
                    </div>
                    <div class="text-[11px] text-slate-500">
                      ${this.escapeHtml(this.activeVideo.mentorRole || 'Master Admin & Lead Physics Mentor')}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <a
                    href="/mentorship.html"
                    class="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>💬 1:1 Chat / Call Mentor</span>
                  </a>
                </div>
              </div>

              <p class="text-xs text-slate-600 leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                ${this.escapeHtml(this.activeVideo.description)}
              </p>
            </section>

            <!-- Tabbed Educational Panels Beneath Player -->
            <section aria-label="Lecture Study Panels" class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div role="tablist" aria-label="Educational Lecture Tabs" class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-slate-100">
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTab === 'chapters'}"
                  data-action="switch-panel-tab"
                  data-tab="chapters"
                  class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors shrink-0 ${
                    this.activeTab === 'chapters'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
                  }"
                >
                  Chapters (${LECTURE_CHAPTERS.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTab === 'doubts'}"
                  data-action="switch-panel-tab"
                  data-tab="doubts"
                  class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors shrink-0 ${
                    this.activeTab === 'doubts'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
                  }"
                >
                  Timestamped Doubts (${videoDoubts.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTab === 'formulas'}"
                  data-action="switch-panel-tab"
                  data-tab="formulas"
                  class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors shrink-0 ${
                    this.activeTab === 'formulas'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
                  }"
                >
                  Formula Sheet
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTab === 'scratchpad'}"
                  data-action="switch-panel-tab"
                  data-tab="scratchpad"
                  class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors shrink-0 ${
                    this.activeTab === 'scratchpad'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
                  }"
                >
                  Scratchpad
                </button>
              </div>

              ${
                this.activeTab === 'chapters'
                  ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3" role="list">
                  ${LECTURE_CHAPTERS.map((ch) => {
                    const isCurrent = activeChapter.id === ch.id;
                    return `
                      <button
                        type="button"
                        role="listitem"
                        data-action="seek-chapter"
                        data-seconds="${ch.timestampSeconds}"
                        class="p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 ${
                          isCurrent
                            ? 'bg-indigo-50/70 border-[#4F46E5]'
                            : 'bg-[#F8FAFC] hover:bg-white border-[#E2E8F0]'
                        }"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-mono tabular-nums text-xs font-extrabold text-[#4F46E5]">
                            ${ch.formattedTime}
                          </span>
                          <span class="text-[11px] font-bold ${
                            isCurrent ? 'text-[#10B981]' : 'text-slate-400'
                          }">
                            ${isCurrent ? '● Playing' : 'Jump →'}
                          </span>
                        </div>
                        <div class="text-xs sm:text-sm font-extrabold text-slate-900">
                          ${this.escapeHtml(ch.title)}
                        </div>
                        <div class="px-2 py-1 rounded bg-white border border-slate-200 font-mono text-[11px] text-indigo-900">
                          ${this.escapeHtml(ch.keyEquation)}
                        </div>
                      </button>
                    `;
                  }).join('')}
                </div>
              `
                  : this.activeTab === 'doubts'
                    ? `
                <div class="space-y-3">
                  <form id="player-doubt-form" class="flex flex-col sm:flex-row gap-2">
                    <input
                      id="player-doubt-input"
                      type="text"
                      required
                      placeholder="Ask a doubt at ${formatDuration(this.currentTimeSeconds)}..."
                      class="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900"
                    />
                    <button
                      type="submit"
                      class="min-h-[40px] px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-xs font-extrabold"
                    >
                      + Post Doubt @ ${formatDuration(this.currentTimeSeconds)}
                    </button>
                  </form>
                  <div class="space-y-2">
                    ${videoDoubts
                      .map(
                        (d) => `
                      <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-xs">
                        <div class="flex items-center justify-between">
                          <button
                            type="button"
                            data-action="seek-chapter"
                            data-seconds="${d.timestampSec}"
                            class="px-2 py-0.5 rounded bg-indigo-100 text-[#4F46E5] font-mono font-bold"
                          >
                            ▶ ${this.escapeHtml(d.timestampFormatted)}
                          </button>
                          <span class="text-[11px] font-bold text-slate-700">${this.escapeHtml(d.studentName)}</span>
                        </div>
                        <p class="text-slate-800">${this.escapeHtml(d.doubtText)}</p>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                    : this.activeTab === 'formulas'
                      ? `
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-extrabold text-slate-900">High-Yield Formula Sheet</h3>
                    <button
                      type="button"
                      data-action="download-lecture-pdf"
                      class="min-h-[36px] px-3.5 py-1.5 bg-[#4F46E5] text-white text-xs font-bold rounded-xl"
                    >
                      ⬇ Download PDF
                    </button>
                  </div>
                  <div class="space-y-2.5">
                    ${mechanicsSheet.highYieldFormulas
                      .map(
                        (f, idx) => `
                      <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="space-y-1">
                          <div class="text-xs font-extrabold text-slate-900">${this.escapeHtml(f.label)}</div>
                          <div class="font-mono text-xs text-[#4F46E5] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                            ${this.escapeHtml(f.equation)}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-action="copy-formula"
                          data-idx="${idx}"
                          data-eq="${this.escapeHtml(f.equation)}"
                          class="min-h-[34px] px-3 py-1 rounded-xl bg-white border border-[#E2E8F0] text-slate-700 text-xs font-bold shrink-0"
                        >
                          ${this.copiedFormulaIndex === idx ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                      : `
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="lecture-scratchpad-textarea" class="text-xs font-extrabold text-slate-900">
                      Personal Lecture Notes Scratchpad
                    </label>
                    <span id="scratchpad-save-status" class="text-[11px] text-[#10B981] font-mono">
                      ✓ Auto-saved
                    </span>
                  </div>
                  <textarea
                    id="lecture-scratchpad-textarea"
                    rows="6"
                    placeholder="Write your derivation steps, PYQ shortcuts, and timestamps here..."
                    class="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs text-slate-900 focus:outline-none focus:border-[#4F46E5]"
                  >${this.escapeHtml(progress.notes)}</textarea>
                </div>
              `
              }
            </section>
          </div>

          <!-- Right 4 Cols (And Underneath Video on Vertical Mobile!): YouTube-Style Suggested Videos Queue -->
          <aside
            aria-label="Suggested Video Lectures"
            data-testid="suggested-videos-list"
            class="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4"
          >
            <div class="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  Up Next · YouTube Queue Style
                </span>
                <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
                  Suggested Video Lectures (${suggestedVideos.length})
                </h2>
              </div>
              <span class="px-2 py-0.5 rounded bg-emerald-50 text-[#10B981] text-[10px] font-extrabold">
                Autoplay Ready
              </span>
            </div>

            <div class="space-y-3">
              ${suggestedVideos
                .map(
                  (vid) => `
                <button
                  type="button"
                  data-action="switch-suggested-video"
                  data-video-id="${vid.id}"
                  data-testid="suggested-video-card"
                  class="w-full text-left p-2.5 rounded-2xl bg-[#F8FAFC] hover:bg-indigo-50/50 border border-[#E2E8F0] hover:border-indigo-200 transition-all flex gap-3 items-start group cursor-pointer"
                >
                  <div class="relative w-32 sm:w-36 aspect-video rounded-xl bg-slate-900 overflow-hidden shrink-0">
                    <img
                      src="${vid.thumbnailUrl || LECTURE_COVER_PATH}"
                      alt="${this.escapeHtml(vid.title)}"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform"
                    />
                    <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-white font-mono-tabular text-[10px] font-bold">
                      ${vid.duration}
                    </span>
                  </div>
                  <div class="min-w-0 flex-1 space-y-1">
                    <span class="inline-block px-1.5 py-0.2 rounded bg-indigo-100 text-[#4F46E5] text-[9px] font-extrabold">
                      ${this.escapeHtml(vid.section || 'Masterclass')}
                    </span>
                    <h3 class="text-xs font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#4F46E5]">
                      ${this.escapeHtml(vid.title)}
                    </h3>
                    <div class="text-[11px] font-semibold text-slate-500 truncate">
                      ${this.escapeHtml(vid.mentorName || 'Sumit Kumar')}
                    </div>
                  </div>
                </button>
              `
                )
                .join('')}
            </div>
          </aside>
        </div>
      </div>
    `;

    this.attachEvents();
    this.drawLectureCanvasFrame();
  }

  private attachEvents(): void {
    if (!this.containerEl) return;

    const canvas = this.containerEl.querySelector<HTMLCanvasElement>(
      '#lecture-simulation-canvas'
    );
    canvas?.addEventListener('click', () => {
      this.togglePlay();
    });

    const realVideoEl =
      this.containerEl.querySelector<HTMLVideoElement>('#player-real-video-el');
    realVideoEl?.addEventListener('click', () => {
      this.togglePlay();
    });
    realVideoEl?.addEventListener('timeupdate', () => {
      this.currentTimeSeconds = realVideoEl.currentTime;
      this.updateLiveTimeDom();
    });

    const scrubber = this.containerEl.querySelector<HTMLInputElement>('#player-scrubber');
    scrubber?.addEventListener('input', () => {
      this.seekTo(Number(scrubber.value));
    });

    const scratchpad = this.containerEl.querySelector<HTMLTextAreaElement>(
      '#lecture-scratchpad-textarea'
    );
    scratchpad?.addEventListener('input', () => {
      const val = scratchpad.value;
      void dataStore.saveLectureProgress({ notes: val });
      const statusEl = this.containerEl?.querySelector('#scratchpad-save-status');
      if (statusEl) {
        statusEl.textContent = '✓ Saved just now';
      }
    });

    const doubtForm = this.containerEl.querySelector<HTMLFormElement>(
      '#player-doubt-form'
    );
    doubtForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = doubtForm.querySelector<HTMLInputElement>('#player-doubt-input');
      const text = input?.value.trim() ?? '';
      if (!text) return;
      const formatted = formatDuration(this.currentTimeSeconds);
      await dataStore.addVideoDoubt({
        videoId: this.activeVideo.id,
        videoTitle: this.activeVideo.title,
        timestampSec: this.currentTimeSeconds,
        timestampFormatted: formatted,
        doubtText: text,
        mentorId: this.activeVideo.mentorId || 'mentor_sumit_master',
        mentorName: this.activeVideo.mentorName || 'Sumit Kumar',
      });
      if (input) input.value = '';
      this.callbacks.onShowToast(`Doubt posted at ${formatted}`);
      this.rerender();
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'toggle-play':
            this.togglePlay();
            break;
          case 'seek-rewind':
            this.seekTo(this.currentTimeSeconds - 10);
            break;
          case 'seek-forward':
            this.seekTo(this.currentTimeSeconds + 10);
            break;
          case 'toggle-mute':
            this.isMuted = !this.isMuted;
            if (realVideoEl) realVideoEl.muted = this.isMuted;
            this.rerender();
            break;
          case 'cycle-speed':
            this.playbackRateIndex =
              (this.playbackRateIndex + 1) % SPEED_RATES.length;
            if (realVideoEl) {
              realVideoEl.playbackRate = SPEED_RATES[this.playbackRateIndex];
            }
            this.callbacks.onShowToast(
              `Playback speed set to ${SPEED_RATES[this.playbackRateIndex]}x`
            );
            this.rerender();
            break;
          case 'toggle-landscape-fullscreen': {
            this.isLandscapeMode = !this.isLandscapeMode;
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('mode', this.isLandscapeMode ? 'horizontal' : 'vertical');
            window.history.replaceState({}, '', nextUrl.toString());
            try {
              const orientation = screen.orientation as ScreenOrientation & {
                lock?: (mode: string) => Promise<void>;
                unlock?: () => void;
              };
              if (this.isLandscapeMode && orientation?.lock) {
                await orientation.lock('landscape').catch(() => {});
              } else if (!this.isLandscapeMode && orientation?.unlock) {
                orientation.unlock();
              }
            } catch {
              // Ignore orientation lock restriction on desktop
            }
            this.callbacks.onShowToast(
              this.isLandscapeMode
                ? 'Switched to Full-Screen Horizontal Landscape Mode'
                : 'Switched to Vertical YouTube Mode — Suggested Videos shown underneath!'
            );
            this.rerender();
            break;
          }
          case 'toggle-fullscreen': {
            const stage = this.containerEl?.querySelector('#video-player-stage');
            if (stage) {
              if (!document.fullscreenElement && stage.requestFullscreen) {
                await stage.requestFullscreen().catch(() => {});
              } else if (document.fullscreenElement && document.exitFullscreen) {
                await document.exitFullscreen().catch(() => {});
              }
            }
            break;
          }
          case 'switch-suggested-video': {
            const vidId = el.dataset.videoId;
            if (vidId) {
              this.activeVideo = dataStore.getVideoById(vidId);
              this.currentTimeSeconds = 0;
              this.isPlaying = true;
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.set('videoId', this.activeVideo.id);
              window.history.pushState({}, '', nextUrl.toString());
              this.lastTickMs = performance.now();
              this.startLoop();
              this.callbacks.onShowToast(`Now Playing: ${this.activeVideo.title}`);
              this.rerender();
            }
            break;
          }
          case 'toggle-lecture-complete': {
            const curr = dataStore.getLectureProgress();
            await dataStore.saveLectureProgress({ completed: !curr.completed });
            this.callbacks.onShowToast(
              !curr.completed
                ? 'Lecture marked complete!'
                : 'Lecture marked in-progress'
            );
            this.rerender();
            break;
          }
          case 'switch-panel-tab': {
            const tab = el.dataset.tab as
              | 'chapters'
              | 'doubts'
              | 'formulas'
              | 'scratchpad';
            if (tab) {
              this.activeTab = tab;
              this.rerender();
            }
            break;
          }
          case 'seek-chapter': {
            const sec = Number(el.dataset.seconds ?? 0);
            this.seekTo(sec);
            this.callbacks.onShowToast(`Jumped to ${formatDuration(sec)}`);
            break;
          }
          case 'copy-formula': {
            const idx = Number(el.dataset.idx);
            const eq = el.dataset.eq ?? '';
            try {
              await navigator.clipboard.writeText(eq);
            } catch {
              // Ignore clipboard permission in headless browsers
            }
            this.copiedFormulaIndex = idx;
            this.callbacks.onShowToast(`Copied formula: ${eq}`);
            this.rerender();
            break;
          }
          case 'download-lecture-pdf': {
            downloadFormulaSheetFile(FORMULA_SHEETS[0]);
            this.callbacks.onShowToast('Downloaded Rotational Mechanics Formula Sheet');
            break;
          }
        }
      });
    });
  }

  private togglePlay(): void {
    this.isPlaying = !this.isPlaying;
    const realVideoEl =
      this.containerEl?.querySelector<HTMLVideoElement>('#player-real-video-el');
    if (realVideoEl) {
      if (this.isPlaying) {
        void realVideoEl.play().catch(() => {});
      } else {
        realVideoEl.pause();
      }
    } else if (this.isPlaying) {
      this.lastTickMs = performance.now();
      this.startLoop();
    } else if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      void dataStore.saveLectureProgress({
        lastPositionSeconds: Math.floor(this.currentTimeSeconds),
      });
    }
    this.rerender();
  }

  private seekTo(targetSeconds: number): void {
    this.currentTimeSeconds = Math.max(
      0,
      Math.min(this.totalDurationSeconds, targetSeconds)
    );
    const realVideoEl =
      this.containerEl?.querySelector<HTMLVideoElement>('#player-real-video-el');
    if (realVideoEl) {
      realVideoEl.currentTime = this.currentTimeSeconds;
    }
    void dataStore.saveLectureProgress({
      lastPositionSeconds: Math.floor(this.currentTimeSeconds),
    });
    this.rerender();
  }

  private startLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    const step = (now: number) => {
      if (!this.isPlaying) return;
      const dt = (now - this.lastTickMs) / 1000;
      this.lastTickMs = now;
      const speed = SPEED_RATES[this.playbackRateIndex];
      this.currentTimeSeconds = Math.min(
        this.totalDurationSeconds,
        this.currentTimeSeconds + dt * speed
      );

      if (now - this.lastAutoSaveMs >= 5000) {
        this.lastAutoSaveMs = now;
        void dataStore.saveLectureProgress({
          lastPositionSeconds: Math.floor(this.currentTimeSeconds),
        });
      }

      this.updateLiveTimeDom();
      this.drawLectureCanvasFrame();

      if (this.currentTimeSeconds >= this.totalDurationSeconds) {
        this.isPlaying = false;
        this.rerender();
        return;
      }
      this.animFrameId = requestAnimationFrame(step);
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  private updateLiveTimeDom(): void {
    if (!this.containerEl) return;
    const timeEl = this.containerEl.querySelector('#player-time-display');
    const scrubber = this.containerEl.querySelector<HTMLInputElement>('#player-scrubber');
    const badge = this.containerEl.querySelector('#player-resume-badge');
    const chLabel = this.containerEl.querySelector('#player-active-chapter-label');
    const ch = this.getActiveChapter();

    if (timeEl) {
      timeEl.textContent = `${formatDuration(this.currentTimeSeconds)} / ${formatDuration(
        this.totalDurationSeconds
      )}`;
    }
    if (scrubber) {
      scrubber.value = String(Math.floor(this.currentTimeSeconds));
    }
    if (badge) {
      badge.textContent = `Auto-saved @ ${formatDuration(this.currentTimeSeconds)}`;
    }
    if (chLabel) {
      chLabel.textContent = ch.title;
    }
  }

  private drawLectureCanvasFrame(): void {
    const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#lecture-simulation-canvas'
    );
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle dark blackboard gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(9, 9, 11, 0.88)');
    grad.addColorStop(1, 'rgba(30, 27, 75, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Coordinate grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const activeChapter = this.getActiveChapter();

    // Header HUD inside lecture canvas
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(
      `PREPSKM.IN · ${(this.activeVideo.section || 'MASTERCLASS').toUpperCase()} · ${formatDuration(
        this.currentTimeSeconds
      )}`,
      56,
      62
    );

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.activeVideo.title.slice(0, 54), 56, 110);

    ctx.fillStyle = '#818cf8';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText(`Active Concept: ${activeChapter.keyEquation}`, 56, 156);

    // Animated Inclined Plane + Rolling Rigid Cylinder diagram
    const baseLeftX = 140;
    const baseTopY = 235;
    const baseRightX = 780;
    const baseBottomY = 530;

    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseTopY);
    ctx.lineTo(baseRightX, baseBottomY);
    ctx.lineTo(baseLeftX, baseBottomY);
    ctx.closePath();
    ctx.stroke();

    // Rolling progress along incline
    const cycle = (this.currentTimeSeconds % 12) / 12;
    const cx = baseLeftX + 85 + cycle * 440;
    const cy = baseTopY + 38 + cycle * 200 - 50;
    const radius = 50;
    const angle = this.currentTimeSeconds * 3.2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.28)';
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spokes to visualize rotation
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, radius);
    ctx.stroke();
    ctx.restore();

    // Velocity vector v_cm
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 95, cy + 44);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText('v_cm = R·ω (Pure Rolling)', cx + 25, cy - 58);

    // Instantaneous Axis of Rotation callout box on right
    ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
    ctx.lineWidth = 2;
    ctx.fillRect(820, 220, 390, 210);
    ctx.strokeRect(820, 220, 390, 210);

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Shape Factor β = I_cm / (M·R²)', 845, 260);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText('• Solid Sphere : β = 2/5 = 0.40', 845, 302);
    ctx.fillText('• Solid Disc   : β = 1/2 = 0.50', 845, 338);
    ctx.fillText('• Hollow Shell : β = 2/3 = 0.67', 845, 374);
    ctx.fillText('• Thin Ring    : β = 1/1 = 1.00', 845, 410);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
