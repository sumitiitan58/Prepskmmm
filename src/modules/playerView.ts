import {
  FORMULA_SHEETS,
  LECTURE_CHAPTERS,
  LECTURE_COVER_PATH,
  LECTURE_TOTAL_DURATION_SECONDS,
} from '../constants';
import { dataStore } from '../services/firebaseService';
import { formatDuration } from '../utils/examLogic';
import { downloadFormulaSheetFile } from '../utils/qrGenerator';

export interface PlayerCallbacks {
  onShowToast: (message: string) => void;
}

const SPEED_RATES = [0.75, 1.0, 1.25, 1.5, 2.0];

export class PlayerModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: PlayerCallbacks;
  private activeTab: 'chapters' | 'formulas' | 'scratchpad' = 'chapters';
  private isPlaying = false;
  private currentTimeSeconds = 525;
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
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const saved = dataStore.getLectureProgress();
    this.currentTimeSeconds = saved.lastPositionSeconds ?? 525;
    this.rerender();
    this.drawLectureCanvasFrame();
  }

  public unmount(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isPlaying = false;
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
      (this.currentTimeSeconds / LECTURE_TOTAL_DURATION_SECONDS) * 100
    );
    const bufferedPct = Math.min(100, progressPct + 18);
    const mechanicsSheet = FORMULA_SHEETS[0];

    this.containerEl.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <!-- Lecture Title & Persistent Resume Status Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div class="space-y-1">
            <div class="text-xs text-zinc-400">
              <span>Physics Masterclass · Class 11</span>
              <span aria-hidden="true"> · </span>
              <span>Lecture 04</span>
              <span aria-hidden="true"> · </span>
              <span class="font-mono tabular-nums text-indigo-400" id="player-resume-badge">
                Auto-saved @ ${formatDuration(this.currentTimeSeconds)}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold text-zinc-100">
              Rigid Body Rotational Mechanics: IAOR, Rolling Motion & Angular Impulse
            </h1>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              data-action="toggle-lecture-complete"
              class="min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                progress.completed
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
              }"
            >
              ${progress.completed ? '✓ Lecture Completed' : 'Mark Lecture Complete'}
            </button>
          </div>
        </div>

        <!-- Custom Distraction-Free Video Player Stage -->
        <section aria-label="Custom Video Lecture Player" id="video-player-stage" class="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/90 shadow-xl">
          <!-- Visual Simulation Canvas + Backdrop -->
          <div class="relative aspect-video w-full bg-zinc-950 overflow-hidden">
            <img
              src="${LECTURE_COVER_PATH}"
              alt="Rotational Mechanics Lecture Visual"
              referrerpolicy="no-referrer"
              class="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
            />
            <canvas
              id="lecture-simulation-canvas"
              width="1280"
              height="720"
              class="relative z-10 w-full h-full block cursor-pointer"
              aria-label="Interactive Physics Lecture Stream"
            ></canvas>

            <!-- Touch-Friendly Overlay Transport Controls (Docked cleanly below physics diagram) -->
            <div class="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-5 pointer-events-none">
              <button
                type="button"
                data-action="seek-rewind"
                aria-label="Rewind 10 seconds"
                class="pointer-events-auto min-h-[46px] min-w-[46px] px-3.5 py-2 rounded-full bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-mono font-bold shadow-md transition-transform active:scale-95"
              >
                -10s
              </button>
              <button
                type="button"
                id="center-play-btn"
                data-action="toggle-play"
                aria-label="${this.isPlaying ? 'Pause Lecture' : 'Play Lecture'}"
                class="pointer-events-auto w-14 h-14 rounded-full bg-indigo-600/95 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
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
                class="pointer-events-auto min-h-[46px] min-w-[46px] px-3.5 py-2 rounded-full bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-700/80 text-zinc-100 text-xs font-mono font-bold shadow-md transition-transform active:scale-95"
              >
                +10s
              </button>
            </div>
          </div>

          <!-- Custom Touch-Friendly Player Control Bar -->
          <div class="bg-zinc-900/95 border-t border-zinc-800 px-4 py-3 space-y-2.5">
            <!-- Progress Scrubber with Buffered Bar -->
            <div class="space-y-1">
              <div class="relative flex items-center">
                <div class="w-full h-2 bg-zinc-950 rounded-full overflow-hidden pointer-events-none">
                  <div
                    id="player-buffered-bar"
                    class="h-full bg-zinc-700/60"
                    style="width: ${bufferedPct}%"
                  ></div>
                </div>
                <input
                  id="player-scrubber"
                  type="range"
                  min="0"
                  max="${LECTURE_TOTAL_DURATION_SECONDS}"
                  step="1"
                  value="${Math.floor(this.currentTimeSeconds)}"
                  aria-label="Seek lecture timeline position in seconds"
                  class="absolute inset-0 w-full h-2 opacity-90 accent-indigo-500 cursor-pointer"
                />
              </div>
              <div class="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-400">
                <span id="player-time-display">
                  ${formatDuration(this.currentTimeSeconds)} / ${formatDuration(LECTURE_TOTAL_DURATION_SECONDS)}
                </span>
                <span id="player-active-chapter-label" class="text-indigo-300 truncate max-w-xs sm:max-w-md">
                  Chapter: ${this.escapeHtml(activeChapter.title)}
                </span>
              </div>
            </div>

            <!-- Control Buttons Row -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="toggle-play"
                  aria-label="${this.isPlaying ? 'Pause' : 'Play'}"
                  class="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  ${this.isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  data-action="seek-rewind"
                  class="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-semibold transition-colors"
                >
                  -10s
                </button>
                <button
                  type="button"
                  data-action="seek-forward"
                  class="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-semibold transition-colors"
                >
                  +10s
                </button>

                <!-- Volume Control -->
                <div class="hidden sm:flex items-center gap-2 pl-2">
                  <button
                    type="button"
                    data-action="toggle-mute"
                    aria-label="${this.isMuted ? 'Unmute audio' : 'Mute audio'}"
                    class="min-h-[38px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-mono"
                  >
                    ${this.isMuted || this.volume === 0 ? 'Muted' : `Vol ${this.volume}%`}
                  </button>
                  <input
                    id="player-volume-slider"
                    type="range"
                    min="0"
                    max="100"
                    value="${this.isMuted ? 0 : this.volume}"
                    aria-label="Audio Volume"
                    class="w-20 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Variable Playback Speed Cycle Button -->
                <button
                  type="button"
                  data-action="cycle-speed"
                  aria-label="Cycle Playback Speed"
                  class="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-indigo-300 text-xs font-mono tabular-nums font-bold transition-colors whitespace-nowrap"
                >
                  Speed: ${currentSpeed}x
                </button>

                <!-- Fullscreen Toggle -->
                <button
                  type="button"
                  data-action="toggle-fullscreen"
                  aria-label="Toggle Fullscreen Player"
                  class="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Fullscreen
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Tabbed Educational Panels Beneath Player -->
        <section aria-label="Lecture Study Panels" class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
          <div role="tablist" aria-label="Educational Lecture Tabs" class="flex flex-wrap gap-2 pb-4 border-b border-zinc-800">
            <button
              type="button"
              role="tab"
              aria-selected="${this.activeTab === 'chapters'}"
              data-action="switch-panel-tab"
              data-tab="chapters"
              class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                this.activeTab === 'chapters'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }"
            >
              Timeline & Chapters (5)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.activeTab === 'formulas'}"
              data-action="switch-panel-tab"
              data-tab="formulas"
              class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                this.activeTab === 'formulas'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }"
            >
              Formula Recap & PDF
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.activeTab === 'scratchpad'}"
              data-action="switch-panel-tab"
              data-tab="scratchpad"
              class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                this.activeTab === 'scratchpad'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }"
            >
              Personal Scratchpad (Auto-Saved)
            </button>
          </div>

          <!-- TAB 1: Timeline & Chapters -->
          ${
            this.activeTab === 'chapters'
              ? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5" role="list" aria-label="Lecture Timestamp Chapters">
              ${LECTURE_CHAPTERS.map((ch) => {
                const isCurrent = activeChapter.id === ch.id;
                return `
                  <button
                    type="button"
                    role="listitem"
                    data-action="seek-chapter"
                    data-seconds="${ch.timestampSeconds}"
                    class="p-4 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 ${
                      isCurrent
                        ? 'bg-indigo-950/40 border-indigo-500/70'
                        : 'bg-zinc-950/80 hover:bg-zinc-800/60 border-zinc-800/80'
                    }"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-mono tabular-nums text-xs font-bold text-indigo-400">
                        ${ch.formattedTime}
                      </span>
                      <span class="text-[11px] font-medium ${
                        isCurrent ? 'text-emerald-400' : 'text-zinc-500'
                      }">
                        ${isCurrent ? 'Now Playing' : 'Jump to Timestamp →'}
                      </span>
                    </div>
                    <div class="text-sm font-bold text-zinc-100">
                      ${this.escapeHtml(ch.title)}
                    </div>
                    <p class="text-xs text-zinc-400 leading-relaxed">
                      ${this.escapeHtml(ch.summary)}
                    </p>
                    <div class="mt-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300">
                      ${this.escapeHtml(ch.keyEquation)}
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          `
              : ''
          }

          <!-- TAB 2: Formula Recap -->
          ${
            this.activeTab === 'formulas'
              ? `
            <div class="space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-zinc-100">High-Yield Rotational Dynamics Formula Sheet</h3>
                  <p class="text-xs text-zinc-400">Tap any formula to copy directly to your clipboard or download the complete sheet.</p>
                </div>
                <button
                  type="button"
                  data-action="download-lecture-pdf"
                  class="min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Download Formula PDF Sheet
                </button>
              </div>

              <div class="grid grid-cols-1 gap-3.5">
                ${mechanicsSheet.highYieldFormulas
                  .map(
                    (f, idx) => `
                  <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="space-y-1.5">
                      <div class="text-sm font-bold text-zinc-100">0${idx + 1}. ${this.escapeHtml(
                        f.label
                      )}</div>
                      <div class="font-mono text-sm text-indigo-300 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                        ${this.escapeHtml(f.equation)}
                      </div>
                      <p class="text-xs text-zinc-400">${this.escapeHtml(f.note)}</p>
                    </div>
                    <button
                      type="button"
                      data-action="copy-formula"
                      data-idx="${idx}"
                      data-eq="${this.escapeHtml(f.equation)}"
                      class="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      ${this.copiedFormulaIndex === idx ? '✓ Copied' : 'Copy Formula'}
                    </button>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <!-- TAB 3: Personal Scratchpad -->
          ${
            this.activeTab === 'scratchpad'
              ? `
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label for="lecture-scratchpad-textarea" class="text-sm font-bold text-zinc-100">
                  Personal Lecture Notes & Derivations Scratchpad
                </label>
                <span id="scratchpad-save-status" class="text-xs text-emerald-400 font-mono">
                  ✓ Auto-saved to LocalStorage & Cloud
                </span>
              </div>
              <textarea
                id="lecture-scratchpad-textarea"
                rows="8"
                placeholder="Write your derivation steps, PYQ shortcuts, and timestamps here..."
                class="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs sm:text-sm text-zinc-100 leading-relaxed focus:outline-none focus:border-indigo-500"
              >${this.escapeHtml(progress.notes)}</textarea>
            </div>
          `
              : ''
          }
        </section>
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

    const scrubber = this.containerEl.querySelector<HTMLInputElement>('#player-scrubber');
    scrubber?.addEventListener('input', () => {
      this.seekTo(Number(scrubber.value));
    });

    const volSlider = this.containerEl.querySelector<HTMLInputElement>(
      '#player-volume-slider'
    );
    volSlider?.addEventListener('input', () => {
      this.volume = Number(volSlider.value);
      this.isMuted = this.volume === 0;
      this.rerender();
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
            this.rerender();
            break;
          case 'cycle-speed':
            this.playbackRateIndex =
              (this.playbackRateIndex + 1) % SPEED_RATES.length;
            this.callbacks.onShowToast(
              `Playback speed set to ${SPEED_RATES[this.playbackRateIndex]}x`
            );
            this.rerender();
            break;
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
            const tab = el.dataset.tab as 'chapters' | 'formulas' | 'scratchpad';
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
    if (this.isPlaying) {
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
      Math.min(LECTURE_TOTAL_DURATION_SECONDS, targetSeconds)
    );
    void dataStore.saveLectureProgress({
      lastPositionSeconds: Math.floor(this.currentTimeSeconds),
    });
    this.rerender();
  }

  private startLoop(): void {
    const step = (now: number) => {
      if (!this.isPlaying) return;
      const dt = (now - this.lastTickMs) / 1000;
      this.lastTickMs = now;
      const speed = SPEED_RATES[this.playbackRateIndex];
      this.currentTimeSeconds = Math.min(
        LECTURE_TOTAL_DURATION_SECONDS,
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

      if (this.currentTimeSeconds >= LECTURE_TOTAL_DURATION_SECONDS) {
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
        LECTURE_TOTAL_DURATION_SECONDS
      )}`;
    }
    if (scrubber) {
      scrubber.value = String(Math.floor(this.currentTimeSeconds));
    }
    if (badge) {
      badge.textContent = `Auto-saved @ ${formatDuration(this.currentTimeSeconds)}`;
    }
    if (chLabel) {
      chLabel.textContent = `Chapter: ${ch.title}`;
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
    grad.addColorStop(0, 'rgba(9, 9, 11, 0.85)');
    grad.addColorStop(1, 'rgba(24, 24, 27, 0.90)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Coordinate grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
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
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.fillText(`PREPSKM MASTERCLASS · ${activeChapter.formattedTime}`, 56, 62);

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(activeChapter.title, 56, 110);

    ctx.fillStyle = '#818cf8';
    ctx.font = '600 26px "JetBrains Mono", monospace';
    ctx.fillText(`Key Relation: ${activeChapter.keyEquation}`, 56, 160);

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
