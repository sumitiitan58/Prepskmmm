import {
  INITIAL_CHAT_MESSAGES,
  LIVE_POLL_BANK,
  MENTOR_AVATAR_PATH,
} from '../constants';
import { dataStore } from '../services/firebaseService';
import type { ChatMessage } from '../types';
import { calculatePollPercentages } from '../utils/examLogic';

export interface LiveCallbacks {
  onShowToast: (message: string) => void;
}

type DrawingTool = 'pen' | 'highlighter' | 'line' | 'eraser';

const BOARD_COLORS = ['#f8fafc', '#818cf8', '#34d399', '#fbbf24', '#f87171'];

export class LiveClassroomModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: LiveCallbacks;

  private activeTool: DrawingTool = 'pen';
  private activeColor = BOARD_COLORS[1];
  private strokeWidth = 4;
  private isLiveMode = true;
  private isHandRaised = false;
  private filterDoubtsOnly = false;
  private chatMessages: ChatMessage[] = [...INITIAL_CHAT_MESSAGES];

  private activePollIndex = 0;
  private selectedPollOption: number | null = null;
  private pollVotesMap: Record<number, Record<string, number>> = {
    0: { ...LIVE_POLL_BANK[0].votes },
    1: { ...LIVE_POLL_BANK[1].votes },
    2: { ...LIVE_POLL_BANK[2].votes },
  };

  // PIP Draggable offset
  private pipOffset = { x: 16, y: 16 };
  private isPipExpanded = false;

  // Smartboard canvas persistence across state updates
  private savedCanvasDataUrl: string | null = null;

  constructor(callbacks: LiveCallbacks) {
    this.callbacks = callbacks;
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const savedSession = dataStore.getLiveSession();
    this.isLiveMode = savedSession.isLive;
    this.rerender();
  }

  public rerender(): void {
    if (!this.containerEl) return;

    // Save current smartboard bitmap before re-rendering DOM if canvas exists
    const existingCanvas = this.containerEl.querySelector<HTMLCanvasElement>(
      '#smartboard-canvas'
    );
    if (existingCanvas) {
      try {
        this.savedCanvasDataUrl = existingCanvas.toDataURL('image/png');
      } catch {
        // Ignore
      }
    }

    const currentPoll = LIVE_POLL_BANK[this.activePollIndex];
    const currentVotes = this.pollVotesMap[this.activePollIndex] ?? currentPoll.votes;
    const pollStats = calculatePollPercentages(currentPoll.options, currentVotes);

    const visibleMessages = this.filterDoubtsOnly
      ? this.chatMessages.filter((m) => m.isDoubt || m.role === 'mentor')
      : this.chatMessages;

    this.containerEl.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <!-- Classroom Top Header & Live / Scheduled Fallback Switch -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div class="space-y-1">
            <div class="text-xs text-zinc-400">
              <span class="${this.isLiveMode ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}">
                ${this.isLiveMode ? 'LIVE STREAMING NOW' : 'UPCOMING MASTERCLASS'}
              </span>
              <span aria-hidden="true"> · </span>
              <span>Mentor: Sumit (IIT Roorkee)</span>
              <span aria-hidden="true"> · </span>
              <span class="font-mono tabular-nums">214 Aspirants Connected</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold text-zinc-100">
              Rotational Mechanics Masterclass: IAOR, Rolling & Center of Percussion
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-action="toggle-live-fallback"
              class="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-colors whitespace-nowrap"
            >
              ${this.isLiveMode ? 'Preview Scheduled Countdown View' : 'Return to Active Live Stream'}
            </button>
          </div>
        </div>

        ${
          !this.isLiveMode
            ? `
          <!-- Inactive Fallback: Scheduled Masterclass Countdown Card -->
          <section aria-label="Upcoming Masterclass Countdown" class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 text-center max-w-3xl mx-auto space-y-6">
            <div class="space-y-2">
              <div class="text-xs text-indigo-400 font-medium">
                <span>Next Live Session Scheduled</span>
                <span aria-hidden="true"> · </span>
                <span>JEE Advanced & NEET High-Yield Series</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-bold text-zinc-100">
                Electrostatics & Gauss Law Cavity Problems
              </h2>
              <p class="text-sm text-zinc-400 max-w-xl mx-auto">
                No mentor is streaming at this moment. Review the syllabus weightage below or jump back into the interactive smartboard stage.
              </p>
            </div>

            <div class="grid grid-cols-4 gap-3 max-w-md mx-auto font-mono tabular-nums">
              <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-2xl font-bold text-zinc-100">00</div>
                <div class="text-[11px] text-zinc-400">Days</div>
              </div>
              <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-2xl font-bold text-indigo-400">02</div>
                <div class="text-[11px] text-zinc-400">Hours</div>
              </div>
              <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-2xl font-bold text-indigo-400">45</div>
                <div class="text-[11px] text-zinc-400">Mins</div>
              </div>
              <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-2xl font-bold text-indigo-400">18</div>
                <div class="text-[11px] text-zinc-400">Secs</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400">Syllabus Weightage</div>
                <div class="text-base font-mono font-bold text-zinc-100 mt-1">12% (3–4 Questions)</div>
              </div>
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400">Prerequisite Sheet</div>
                <div class="text-base font-bold text-indigo-400 mt-1">Class 12 · Electrodynamics</div>
              </div>
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400">Host Mentor</div>
                <div class="text-base font-bold text-zinc-100 mt-1">Sumit (IITR)</div>
              </div>
            </div>

            <button
              type="button"
              data-action="toggle-live-fallback"
              class="min-h-[44px] px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Launch Interactive Smartboard Stage Now
            </button>
          </section>
        `
            : `
          <!-- Responsive Portrait (Stacked) / Landscape (Split) Live Stage -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Left 8 Cols: Interactive HTML5 Canvas Smartboard + Reaction Bar -->
            <div class="lg:col-span-8 space-y-4">
              <!-- Smartboard Toolbar -->
              <div class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                <!-- Drawing Tools -->
                <div role="group" aria-label="Smartboard Drawing Tools" class="flex flex-wrap items-center gap-1.5">
                  ${(
                    [
                      { id: 'pen', label: 'Pen' },
                      { id: 'highlighter', label: 'Highlighter' },
                      { id: 'line', label: 'Line Tool' },
                      { id: 'eraser', label: 'Eraser' },
                    ] as const
                  )
                    .map(
                      (t) => `
                    <button
                      type="button"
                      data-action="select-tool"
                      data-tool="${t.id}"
                      aria-pressed="${this.activeTool === t.id}"
                      class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        this.activeTool === t.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-800'
                      }"
                    >
                      ${t.label}
                    </button>
                  `
                    )
                    .join('')}
                </div>

                <!-- 5-Color Palette & Stroke Width -->
                <div class="flex flex-wrap items-center gap-3">
                  <div role="group" aria-label="Stroke Color Palette" class="flex items-center gap-1.5">
                    ${BOARD_COLORS.map(
                      (hex) => `
                      <button
                        type="button"
                        data-action="select-color"
                        data-color="${hex}"
                        aria-label="Select color ${hex}"
                        class="w-7 h-7 rounded-full border-2 transition-transform ${
                          this.activeColor === hex
                            ? 'border-white scale-110'
                            : 'border-zinc-700'
                        }"
                        style="background-color: ${hex}"
                      ></button>
                    `
                    ).join('')}
                  </div>

                  <div class="flex items-center gap-2">
                    <label for="board-stroke-slider" class="text-[11px] font-mono text-zinc-400">
                      ${this.strokeWidth}px
                    </label>
                    <input
                      id="board-stroke-slider"
                      type="range"
                      min="2"
                      max="16"
                      value="${this.strokeWidth}"
                      aria-label="Smartboard brush width"
                      class="w-20 accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <!-- Board Utility Actions -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-action="clear-board"
                    class="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
                  >
                    Clear Board
                  </button>
                  <button
                    type="button"
                    data-action="download-snapshot"
                    class="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-colors whitespace-nowrap"
                  >
                    Download Board Snapshot
                  </button>
                </div>
              </div>

              <!-- Smartboard Canvas Container + Draggable Mentor PIP Camera + Floating Reactions -->
              <div id="smartboard-stage-wrapper" class="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-xl">
                <canvas
                  id="smartboard-canvas"
                  width="1100"
                  height="620"
                  data-testid="smartboard-canvas"
                  class="w-full aspect-[16/9] block touch-none cursor-crosshair"
                  aria-label="Interactive Classroom Smartboard Canvas"
                ></canvas>

                <!-- Floating Emoji Reaction Stream Container -->
                <div id="reaction-float-layer" class="pointer-events-none absolute inset-0 overflow-hidden z-20"></div>

                <!-- Draggable Picture-in-Picture (PIP) Mentor Face Camera Box -->
                <div
                  id="mentor-pip-box"
                  style="right: ${this.pipOffset.x}px; bottom: ${this.pipOffset.y}px;"
                  class="absolute z-30 ${
                    this.isPipExpanded ? 'w-64 sm:w-80' : 'w-44 sm:w-52'
                  } rounded-2xl overflow-hidden bg-zinc-900/95 border border-zinc-700 shadow-2xl select-none cursor-move"
                  aria-label="Mentor Camera Picture-in-Picture"
                >
                  <div class="relative aspect-[4/3] bg-zinc-950">
                    <img
                      src="${MENTOR_AVATAR_PATH}"
                      alt="Mentor Sumit Live Camera"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover pointer-events-none"
                    />
                    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 flex items-center justify-between">
                      <div>
                        <div class="text-[11px] font-bold text-white">Sumit (Host)</div>
                        <div class="text-[10px] text-emerald-300 font-mono">Audio Active</div>
                      </div>
                      <button
                        type="button"
                        data-action="toggle-pip-size"
                        aria-label="Toggle Mentor Camera Size"
                        class="px-2 py-1 rounded bg-zinc-900/90 text-[10px] font-semibold text-zinc-200 hover:text-white"
                      >
                        ${this.isPipExpanded ? 'Minimize' : 'Expand'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Real-Time Reaction & Raise Hand Bar -->
              <div class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2" role="group" aria-label="Send Live Classroom Emoji Reaction">
                  <span class="text-xs font-medium text-zinc-400 mr-1">React:</span>
                  ${['🔥', '💡', '👏', '❤️']
                    .map(
                      (emoji) => `
                    <button
                      type="button"
                      data-action="send-reaction"
                      data-emoji="${emoji}"
                      aria-label="Send ${emoji} reaction"
                      class="min-h-[42px] min-w-[46px] px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-base transition-transform active:scale-90"
                    >
                      ${emoji}
                    </button>
                  `
                    )
                    .join('')}
                </div>

                <button
                  type="button"
                  data-action="toggle-raise-hand"
                  aria-pressed="${this.isHandRaised}"
                  class="min-h-[42px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                    this.isHandRaised
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  }"
                >
                  ${
                    this.isHandRaised
                      ? '✋ Hand Raised (Queued for Audio Doubt #2)'
                      : '✋ Raise Hand for Audio Doubt'
                  }
                </button>
              </div>
            </div>

            <!-- Right 4 Cols: Real-Time Live Polls & Student Doubt Chat -->
            <div class="lg:col-span-4 space-y-5">
              <!-- Real-Time Live Poll Card -->
              <section aria-label="Real-Time Live Poll" class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                <div class="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                  <div>
                    <div class="text-xs text-indigo-400 font-medium">
                      <span>Real-Time Classroom Poll</span>
                      <span aria-hidden="true"> · </span>
                      <span class="font-mono tabular-nums">${pollStats.totalVotes} Votes</span>
                    </div>
                    <h2 class="text-base font-bold text-zinc-100">Live Concept Check #0${
                      this.activePollIndex + 1
                    }</h2>
                  </div>
                  <button
                    type="button"
                    data-action="next-poll"
                    class="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 whitespace-nowrap"
                  >
                    Next Poll →
                  </button>
                </div>

                <p class="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium">
                  ${this.escapeHtml(currentPoll.question)}
                </p>

                <div class="space-y-2" role="group" aria-label="Poll Options">
                  ${currentPoll.options
                    .map((opt, idx) => {
                      const pct = pollStats.percentages[idx];
                      const count = pollStats.counts[idx];
                      const isSelected = this.selectedPollOption === idx;
                      const isCorrect = idx === currentPoll.correctOptionIndex;

                      return `
                      <button
                        type="button"
                        data-action="vote-poll"
                        data-option="${idx}"
                        class="w-full p-3 rounded-xl border text-left relative overflow-hidden transition-colors ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 text-white'
                            : 'bg-zinc-950/90 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                        }"
                      >
                        <div
                          class="absolute inset-y-0 left-0 bg-indigo-500/15 pointer-events-none transition-all duration-300"
                          style="width: ${this.selectedPollOption !== null ? pct : 0}%"
                        ></div>
                        <div class="relative z-10 flex items-center justify-between gap-2 text-xs">
                          <span class="font-medium">${this.escapeHtml(opt)}</span>
                          ${
                            this.selectedPollOption !== null
                              ? `<span class="font-mono tabular-nums font-bold ${
                                  isCorrect ? 'text-emerald-400' : 'text-zinc-400'
                                }">${pct}% (${count})</span>`
                              : ''
                          }
                        </div>
                      </button>
                    `;
                    })
                    .join('')}
                </div>

                ${
                  this.selectedPollOption !== null
                    ? `
                  <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                    <span class="font-semibold text-emerald-400">Solution Insight:</span> ${this.escapeHtml(
                      currentPoll.explanation
                    )}
                  </div>
                `
                    : ''
                }
              </section>

              <!-- Live Student Chat & Doubt Feed -->
              <section aria-label="Live Classroom Chat" class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-[420px]">
                <div class="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                  <div>
                    <h2 class="text-base font-bold text-zinc-100">Live Student Chat</h2>
                    <div class="text-[11px] text-zinc-400">Low-latency doubt & concept feed</div>
                  </div>
                  <button
                    type="button"
                    data-action="toggle-doubt-filter"
                    aria-pressed="${this.filterDoubtsOnly}"
                    class="min-h-[36px] px-3 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                      this.filterDoubtsOnly
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }"
                  >
                    ${this.filterDoubtsOnly ? 'Showing Doubts' : 'Filter Doubts'}
                  </button>
                </div>

                <div id="live-chat-scroll" class="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                  ${visibleMessages
                    .map(
                      (m) => `
                    <div class="p-3 rounded-xl border ${
                      m.role === 'mentor'
                        ? 'bg-indigo-950/35 border-indigo-500/40'
                        : 'bg-zinc-950/80 border-zinc-800/80'
                    }">
                      <div class="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <span class="font-bold ${
                          m.role === 'mentor' ? 'text-indigo-300' : 'text-zinc-200'
                        }">
                          ${this.escapeHtml(m.sender)}
                        </span>
                        <span class="font-mono tabular-nums">${m.timestamp}</span>
                      </div>
                      <p class="mt-1 text-xs text-zinc-200 leading-relaxed">
                        ${this.escapeHtml(m.text)}
                      </p>
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <form id="live-chat-form" class="pt-3 border-t border-zinc-800 flex flex-col gap-2">
                  <div class="flex gap-2">
                    <label for="live-chat-input" class="sr-only">Type a doubt or comment</label>
                    <input
                      id="live-chat-input"
                      type="text"
                      required
                      maxlength="240"
                      placeholder="Ask a doubt (tag with ? for doubt filter)..."
                      class="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      class="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        `
        }
      </div>
    `;

    this.attachEvents();
    this.initSmartboardCanvas();
  }

  private attachEvents(): void {
    if (!this.containerEl) return;

    const strokeSlider = this.containerEl.querySelector<HTMLInputElement>(
      '#board-stroke-slider'
    );
    strokeSlider?.addEventListener('input', () => {
      this.strokeWidth = Number(strokeSlider.value);
      this.rerender();
    });

    const chatForm = this.containerEl.querySelector<HTMLFormElement>('#live-chat-form');
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = chatForm.querySelector<HTMLInputElement>('#live-chat-input');
      const text = input?.value.trim() ?? '';
      if (!text) return;

      const user = dataStore.getUser();
      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      this.chatMessages.push({
        id: `msg_${Date.now()}`,
        sender: user.name,
        role: 'student',
        text,
        isDoubt: text.includes('?') || text.toLowerCase().includes('doubt'),
        timestamp,
      });
      if (input) input.value = '';
      this.rerender();
      const scrollBox = this.containerEl?.querySelector('#live-chat-scroll');
      if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
    });

    // Draggable PIP Camera Box
    const pipBox = this.containerEl.querySelector<HTMLElement>('#mentor-pip-box');
    const stageWrapper = this.containerEl.querySelector<HTMLElement>(
      '#smartboard-stage-wrapper'
    );
    if (pipBox && stageWrapper) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let origRight = this.pipOffset.x;
      let origBottom = this.pipOffset.y;

      pipBox.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origRight = this.pipOffset.x;
        origBottom = this.pipOffset.y;
        pipBox.setPointerCapture(e.pointerId);
      });

      pipBox.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = startX - e.clientX;
        const dy = startY - e.clientY;
        this.pipOffset.x = Math.max(8, Math.min(260, origRight + dx));
        this.pipOffset.y = Math.max(8, Math.min(220, origBottom + dy));
        pipBox.style.right = `${this.pipOffset.x}px`;
        pipBox.style.bottom = `${this.pipOffset.y}px`;
      });

      pipBox.addEventListener('pointerup', () => {
        dragging = false;
      });
    }

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'toggle-live-fallback': {
            this.isLiveMode = !this.isLiveMode;
            const session = dataStore.getLiveSession();
            session.isLive = this.isLiveMode;
            await dataStore.saveLiveSession(session);
            this.rerender();
            break;
          }
          case 'select-tool': {
            const tool = el.dataset.tool as DrawingTool;
            if (tool) {
              this.activeTool = tool;
              this.rerender();
            }
            break;
          }
          case 'select-color': {
            const color = el.dataset.color;
            if (color) {
              this.activeColor = color;
              if (this.activeTool === 'eraser') this.activeTool = 'pen';
              this.rerender();
            }
            break;
          }
          case 'clear-board': {
            this.savedCanvasDataUrl = null;
            const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
              '#smartboard-canvas'
            );
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                this.drawSmartboardBackground(ctx, canvas.width, canvas.height, false);
                this.savedCanvasDataUrl = canvas.toDataURL('image/png');
              }
            }
            this.callbacks.onShowToast('Smartboard cleared');
            break;
          }
          case 'download-snapshot': {
            const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
              '#smartboard-canvas'
            );
            if (canvas) {
              const url = canvas.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = url;
              a.download = `prepskm_smartboard_snapshot_${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              this.callbacks.onShowToast('Downloaded Smartboard Snapshot PNG');
            }
            break;
          }
          case 'toggle-pip-size': {
            this.isPipExpanded = !this.isPipExpanded;
            this.rerender();
            break;
          }
          case 'send-reaction': {
            const emoji = el.dataset.emoji ?? '🔥';
            this.spawnFloatingEmoji(emoji);
            break;
          }
          case 'toggle-raise-hand': {
            this.isHandRaised = !this.isHandRaised;
            this.callbacks.onShowToast(
              this.isHandRaised
                ? 'Hand raised! Mentor Sumit notified of your audio doubt.'
                : 'Lowered hand'
            );
            this.rerender();
            break;
          }
          case 'vote-poll': {
            const optIdx = Number(el.dataset.option);
            if (!Number.isNaN(optIdx)) {
              const votesObj =
                this.pollVotesMap[this.activePollIndex] ??
                { ...LIVE_POLL_BANK[this.activePollIndex].votes };
              if (this.selectedPollOption === null) {
                votesObj[String(optIdx)] = (votesObj[String(optIdx)] ?? 0) + 1;
                this.pollVotesMap[this.activePollIndex] = votesObj;
              }
              this.selectedPollOption = optIdx;
              const session = dataStore.getLiveSession();
              session.activePoll = {
                question: LIVE_POLL_BANK[this.activePollIndex].question,
                options: [...LIVE_POLL_BANK[this.activePollIndex].options],
                votes: votesObj,
              };
              await dataStore.saveLiveSession(session);
              this.rerender();
            }
            break;
          }
          case 'next-poll': {
            this.activePollIndex = (this.activePollIndex + 1) % LIVE_POLL_BANK.length;
            this.selectedPollOption = null;
            this.rerender();
            break;
          }
          case 'toggle-doubt-filter': {
            this.filterDoubtsOnly = !this.filterDoubtsOnly;
            this.rerender();
            break;
          }
        }
      });
    });
  }

  private spawnFloatingEmoji(emoji: string): void {
    const layer = this.containerEl?.querySelector<HTMLElement>('#reaction-float-layer');
    if (!layer) return;
    const span = document.createElement('span');
    span.textContent = emoji;
    const randomLeft = 15 + Math.floor(Math.random() * 65);
    span.className = 'floating-reaction-emoji text-2xl sm:text-3xl select-none';
    span.style.left = `${randomLeft}%`;
    layer.appendChild(span);
    setTimeout(() => {
      span.remove();
    }, 1800);
  }

  private initSmartboardCanvas(): void {
    const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#smartboard-canvas'
    );
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.savedCanvasDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = this.savedCanvasDataUrl;
    } else {
      this.drawSmartboardBackground(ctx, canvas.width, canvas.height, true);
    }

    let drawing = false;
    let startPt = { x: 0, y: 0 };
    let snapshotBeforeLine: ImageData | null = null;

    const getCanvasPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      startPt = getCanvasPos(e);
      canvas.setPointerCapture(e.pointerId);

      if (this.activeTool === 'line') {
        snapshotBeforeLine = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else {
        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pt = getCanvasPos(e);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (this.activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = this.strokeWidth * 4;
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (this.activeTool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `${this.activeColor}44`;
        ctx.lineWidth = this.strokeWidth * 3;
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (this.activeTool === 'line' && snapshotBeforeLine) {
        ctx.putImageData(snapshotBeforeLine, 0, 0);
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    });

    const finishStroke = () => {
      if (!drawing) return;
      drawing = false;
      snapshotBeforeLine = null;
      try {
        this.savedCanvasDataUrl = canvas.toDataURL('image/png');
      } catch {
        // Ignore
      }
    };

    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);
  }

  private drawSmartboardBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    includeDerivation: boolean
  ): void {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    // Subtle smartboard grid
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (!includeDerivation) return;

    // Pre-populated Mentor Derivation on the Smartboard
    ctx.fillStyle = '#818cf8';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('LIVE BOARD · ROLLING MOTION & CENTER OF PERCUSSION', 44, 56);

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText('1. Torque about Instantaneous Point of Contact P:', 44, 108);
    ctx.fillStyle = '#34d399';
    ctx.fillText('   τ_P = (M·g·sin θ)·R = I_P · α = (I_cm + M·R²) · (a_cm / R)', 44, 145);

    ctx.fillStyle = '#f4f4f5';
    ctx.fillText('2. Translational Acceleration Down Rough Incline:', 44, 200);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('   a_cm = (g · sin θ) / [ 1 + I_cm / (M·R²) ]', 44, 238);

    // Free body diagram sketch on smartboard
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 320);
    ctx.lineTo(540, 520);
    ctx.lineTo(80, 520);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(280, 355, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f87171';
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillText('f_s (up incline)', 155, 420);
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText('Draw or annotate anywhere on this board with Pen / Highlighter!', 44, 580);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
