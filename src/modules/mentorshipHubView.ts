import { LECTURE_COVER_PATH, MENTOR_AVATAR_PATH } from '../constants';
import { dataStore } from '../services/firebaseService';
import type { MentorProfileItem, VideoRoadmapItem } from '../types';
import { formatDuration } from '../utils/examLogic';

export interface MentorshipHubCallbacks {
  onShowToast: (message: string) => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export class MentorshipHubModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: MentorshipHubCallbacks;
  private activeVideo: VideoRoadmapItem;
  private selectedVideoSection = 'ALL';
  private isPlaying = false;
  private currentTimeSec = 420;
  private totalDurationSec = 2060;
  private speedIdx = 1;

  // Timestamped Doubt Attachment State
  private pendingDoubtAttachmentDataUrl: string | null = null;
  private pendingDoubtAttachmentName = '';

  // Specific Mentor Selection & Jitsi Call State
  private activeMentorId = 'mentor_sumit_master';
  private activeJitsiModal: {
    mode: 'AUDIO' | 'VIDEO';
    roomName: string;
    mentor: MentorProfileItem;
  } | null = null;

  private animId: number | null = null;
  private lastTick = 0;

  constructor(callbacks: MentorshipHubCallbacks) {
    this.callbacks = callbacks;
    this.activeVideo = dataStore.getVideos()[0];
    if (this.activeVideo?.mentorId) {
      this.activeMentorId = this.activeVideo.mentorId;
    }
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const videos = dataStore.getVideos();
    if (!videos.some((v) => v.id === this.activeVideo.id)) {
      this.activeVideo = videos[0];
    }
    this.rerender();
    this.drawPrivacyStreamFrame();
  }

  public unmount(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.isPlaying = false;
  }

  private hasRealVideoSource(vid: VideoRoadmapItem): boolean {
    if (!vid.videoUrl) return false;
    return (
      vid.videoUrl.startsWith('data:video/') ||
      vid.videoUrl.startsWith('blob:') ||
      vid.videoUrl.endsWith('.mp4') ||
      vid.videoUrl.endsWith('.webm')
    );
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const allVideos = dataStore.getVideos();
    const mentors = dataStore.getMentors();
    const activeMentor =
      mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

    const videoSections = [
      'ALL',
      ...Array.from(
        new Set(allVideos.map((v) => v.section || 'Strategy Roadmaps'))
      ),
    ];

    const filteredVideos = allVideos.filter((v) => {
      if (this.selectedVideoSection === 'ALL') return true;
      return (v.section || 'Strategy Roadmaps') === this.selectedVideoSection;
    });

    const sessions = dataStore.getMentorshipSessions();
    const mySession =
      sessions.find(
        (s) => s.mentorId === activeMentor.id && s.studentId === user.uid
      ) ??
      sessions.find((s) => s.mentorId === activeMentor.id) ??
      sessions[0];

    const videoDoubts = dataStore.getVideoDoubts(this.activeVideo.id);
    const speed = SPEED_OPTIONS[this.speedIdx];
    const isRealVideo = this.hasRealVideoSource(this.activeVideo);

    this.containerEl.innerHTML = `
      <div class="space-y-6">
        <!-- Top Page Header with Mentor Selector & Instant Jitsi Video/Audio Call -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
              HD Media Player · Timestamped Doubts · Multi-Mentor Jitsi Video Calls
            </span>
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
              Video Lectures & 1:1 Specific Mentor Connect
            </h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-action="start-jitsi-call"
              data-call-type="AUDIO"
              data-mentor-id="${activeMentor.id}"
              class="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#10B981] text-xs font-extrabold transition-colors"
            >
              📞 Jitsi Audio Call (${this.escapeHtml(activeMentor.name.split(' ')[0])})
            </button>
            <button
              type="button"
              data-action="start-jitsi-call"
              data-call-type="VIDEO"
              data-mentor-id="${activeMentor.id}"
              data-testid="launch-jitsi-video-btn"
              class="min-h-[42px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-colors"
            >
              🎥 Live Jitsi Video Call (${this.escapeHtml(activeMentor.name.split(' ')[0])})
            </button>
          </div>
        </section>

        <!-- Main Grid: Enhanced Media Player + Doubt Attacher + Video Playlist (7 cols) & Multi-Mentor 1:1 Connect (5 cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 7 Cols: Media Player + Timestamped Doubt Attacher + Section Playlist -->
          <div class="lg:col-span-7 space-y-6">
            <!-- Enhanced Media Player Card -->
            <section
              aria-label="Enhanced Lecture Media Player"
              id="privacy-player-wrapper"
              class="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm select-none"
            >
              <!-- Uploading Mentor Attribution Header Bar -->
              <div class="px-4 py-3 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/70 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <img
                    src="${this.activeVideo.mentorAvatar || MENTOR_AVATAR_PATH}"
                    alt="${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}"
                    referrerpolicy="no-referrer"
                    class="w-9 h-9 rounded-full object-cover border border-indigo-200"
                  />
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-extrabold text-slate-900">
                        Uploaded by: ${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}
                      </span>
                      <span class="px-2 py-0.5 rounded-full bg-indigo-100 text-[#4F46E5] text-[10px] font-bold">
                        ${this.escapeHtml(this.activeVideo.section || 'Strategy Roadmaps')}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-500">
                      ${this.escapeHtml(this.activeVideo.mentorRole || 'Master Admin & Lead Physics Mentor')}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-action="connect-video-mentor"
                  data-mentor-id="${this.activeVideo.mentorId || 'mentor_sumit_master'}"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                >
                  💬 Talk to ${this.escapeHtml((this.activeVideo.mentorName || 'Sumit').split(' ')[0])} →
                </button>
              </div>

              <!-- Video Viewport Stage -->
              <div
                id="privacy-video-stage"
                class="relative aspect-video bg-slate-950 overflow-hidden"
              >
                ${
                  isRealVideo
                    ? `
                  <video
                    id="real-html5-video-player"
                    src="${this.activeVideo.videoUrl}"
                    poster="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                    playsinline
                    class="w-full h-full object-contain bg-black"
                  ></video>
                `
                    : `
                  <img
                    src="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                    alt="${this.escapeHtml(this.activeVideo.title)}"
                    referrerpolicy="no-referrer"
                    class="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                  />
                  <canvas
                    id="privacy-video-canvas"
                    width="1280"
                    height="720"
                    class="relative z-10 w-full h-full block cursor-pointer"
                  ></canvas>
                `
                }

                <!-- Dynamic Floating Student Watermark Overlay -->
                <div
                  aria-label="Dynamic Student Watermark"
                  class="privacy-watermark absolute bottom-16 right-4 z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-[10px] font-mono-tabular text-white/75"
                >
                  prepskm.in Protected · ${this.escapeHtml(user.name)} (${this.escapeHtml(user.email)})
                </div>

                <!-- Right-Click Disabled Shield Badge -->
                <div class="absolute top-3 right-3 z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-400/30 text-[10px] font-mono-tabular text-indigo-200">
                  🔒 ${isRealVideo ? 'Uploaded Video File' : 'DRM Stream'} · By ${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}
                </div>

                <!-- Bottom Docked Transport Controls -->
                <div class="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-3 pointer-events-none">
                  <button
                    type="button"
                    data-action="vid-rewind"
                    class="pointer-events-auto min-h-[38px] px-3 py-1 rounded-full bg-slate-900/90 text-white text-xs font-mono-tabular font-bold border border-slate-700"
                  >
                    -10s
                  </button>
                  <button
                    type="button"
                    data-action="vid-toggle-play"
                    aria-label="${this.isPlaying ? 'Pause Video' : 'Play Video'}"
                    class="pointer-events-auto w-12 h-12 rounded-full bg-[#4F46E5] hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg"
                  >
                    ${this.isPlaying ? '❚❚' : '▶'}
                  </button>
                  <button
                    type="button"
                    data-action="vid-forward"
                    class="pointer-events-auto min-h-[38px] px-3 py-1 rounded-full bg-slate-900/90 text-white text-xs font-mono-tabular font-bold border border-slate-700"
                  >
                    +10s
                  </button>
                </div>
              </div>

              <!-- Custom Control Scrubber Bar & Lecture Metadata -->
              <div class="p-4 bg-white border-t border-[#E2E8F0] space-y-3">
                <input
                  id="privacy-scrubber"
                  type="range"
                  min="0"
                  max="${this.totalDurationSec}"
                  value="${Math.floor(this.currentTimeSec)}"
                  aria-label="Seek video timeline"
                  class="w-full accent-[#4F46E5] cursor-pointer"
                />
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="space-y-0.5">
                    <span class="text-[11px] font-bold text-[#4F46E5]">
                      ${this.escapeHtml(this.activeVideo.topicTag)}
                    </span>
                    <h2 class="text-base font-extrabold text-slate-900">
                      ${this.escapeHtml(this.activeVideo.title)}
                    </h2>
                  </div>
                  <div class="flex items-center gap-2">
                    <span id="privacy-time-label" class="text-xs font-mono-tabular text-slate-600 font-bold">
                      ${formatDuration(this.currentTimeSec)} / ${this.activeVideo.duration}
                    </span>
                    <button
                      type="button"
                      data-action="vid-cycle-speed"
                      class="min-h-[34px] px-3 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono-tabular font-bold text-[#4F46E5]"
                    >
                      ${speed}x
                    </button>
                    <button
                      type="button"
                      data-action="vid-fullscreen"
                      class="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-700"
                    >
                      ⛶
                    </button>
                  </div>
                </div>
                <p class="text-xs text-slate-600">
                  ${this.escapeHtml(this.activeVideo.description)}
                </p>
              </div>

              <!-- ATTACH DOUBT AT CURRENT TIMESTAMP (With Optional Screenshot/File) -->
              <div class="p-4 bg-gradient-to-r from-indigo-50/50 via-[#F8FAFC] to-emerald-50/40 border-t border-[#E2E8F0] space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md bg-[#4F46E5] text-white font-mono-tabular text-[11px] font-bold">
                      @ ${formatDuration(this.currentTimeSec)}
                    </span>
                    <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                      Attach Doubt to This Lecture (Sent to ${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')})
                    </h3>
                  </div>
                  <span class="text-[11px] font-mono-tabular text-slate-500">
                    ${videoDoubts.length} Doubts Attached
                  </span>
                </div>

                <form id="video-doubt-form" class="space-y-2.5">
                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      id="video-doubt-input"
                      type="text"
                      required
                      placeholder="Ask your doubt at ${formatDuration(this.currentTimeSec)} (e.g., Why does friction act upward here?)..."
                      class="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5]"
                    />
                    <label
                      for="video-doubt-file"
                      class="min-h-[40px] px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs font-bold text-slate-700 cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>📎 ${this.pendingDoubtAttachmentName ? 'Attached ✓' : 'Attach Note/Img'}</span>
                    </label>
                    <input
                      id="video-doubt-file"
                      type="file"
                      accept="image/*"
                      class="hidden"
                    />
                    <button
                      type="submit"
                      data-testid="attach-video-doubt-btn"
                      class="min-h-[40px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-2xs shrink-0"
                    >
                      + Attach Doubt
                    </button>
                  </div>
                </form>

                <!-- Timestamped Doubts Thread for This Video -->
                <div class="space-y-2 max-h-44 overflow-y-auto pt-1" data-testid="video-doubts-list">
                  ${videoDoubts
                    .map(
                      (d) => `
                    <div class="p-2.5 rounded-xl bg-white border border-[#E2E8F0] space-y-1.5 text-xs">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            data-action="seek-to-doubt"
                            data-sec="${d.timestampSec}"
                            class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-mono-tabular text-[11px] font-extrabold hover:bg-indigo-100"
                          >
                            ▶ ${this.escapeHtml(d.timestampFormatted)}
                          </button>
                          <span class="font-bold text-slate-900">${this.escapeHtml(d.studentName)}</span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono-tabular">${this.escapeHtml(d.createdAt)}</span>
                      </div>
                      <p class="text-slate-700 leading-snug">${this.escapeHtml(d.doubtText)}</p>
                      ${
                        d.attachmentDataUrl
                          ? `<img src="${d.attachmentDataUrl}" alt="Doubt attachment" class="max-h-24 rounded-lg border border-slate-200 mt-1" />`
                          : ''
                      }
                      ${
                        d.mentorReply
                          ? `
                        <div class="p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950">
                          <strong class="text-[#10B981]">${this.escapeHtml(d.mentorName || 'Mentor')} Reply:</strong> ${this.escapeHtml(d.mentorReply)}
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </section>

            <!-- Video Lectures & Section Playlist Cards (Showing Mentor Name on Each Card) -->
            <section aria-label="Mentor Video Roadmaps" class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="text-base font-extrabold text-slate-900">Video Lectures by Section & Mentor</h2>
                  <p class="text-xs text-slate-500">Every video displays its uploading Mentor and section.</p>
                </div>
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  ${videoSections
                    .map(
                      (sec) => `
                    <button
                      type="button"
                      data-action="filter-video-section"
                      data-section="${this.escapeHtml(sec)}"
                      class="min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                        this.selectedVideoSection === sec
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-[#F8FAFC] border border-[#E2E8F0] text-slate-600 hover:bg-slate-100'
                      }"
                    >
                      ${sec === 'ALL' ? 'All Sections' : this.escapeHtml(sec)}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                ${filteredVideos
                  .map((v) => {
                    const isSelected = v.id === this.activeVideo.id;
                    return `
                    <div
                      class="rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#4F46E5] ring-2 ring-indigo-500/20 bg-indigo-50/30'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white'
                      }"
                    >
                      <button
                        type="button"
                        data-action="select-video"
                        data-video-id="${v.id}"
                        class="text-left w-full"
                      >
                        <div class="relative h-28 w-full bg-slate-900 overflow-hidden">
                          <img
                            src="${v.thumbnailUrl || LECTURE_COVER_PATH}"
                            alt="${this.escapeHtml(v.title)}"
                            referrerpolicy="no-referrer"
                            class="w-full h-full object-cover opacity-85"
                          />
                          <span class="absolute top-2 left-2 px-2 py-0.5 rounded bg-indigo-600/95 text-white text-[10px] font-bold">
                            ${this.escapeHtml(v.section || 'Strategy Roadmaps')}
                          </span>
                          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-mono-tabular">
                            ${v.duration}
                          </span>
                        </div>
                        <div class="p-3 space-y-1">
                          <div class="text-xs font-extrabold text-slate-900 line-clamp-2">
                            ${this.escapeHtml(v.title)}
                          </div>
                          <div class="flex items-center gap-1.5 pt-1">
                            <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
                            <span class="text-[11px] font-bold text-slate-700 truncate">
                              By ${this.escapeHtml(v.mentorName || 'Sumit Kumar')}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div class="px-3 pb-3 pt-1 flex items-center justify-between border-t border-slate-100">
                        <span class="text-[10px] text-slate-500 truncate">${this.escapeHtml(v.topicTag)}</span>
                        <button
                          type="button"
                          data-action="connect-video-mentor"
                          data-mentor-id="${v.mentorId || 'mentor_sumit_master'}"
                          class="text-[11px] font-extrabold text-[#4F46E5] hover:underline shrink-0"
                        >
                          Ask Mentor →
                        </button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </section>
          </div>

          <!-- Right 5 Cols: Multi-Mentor 1:1 Connect (Select Specific Mentor + Chat + Jitsi Video Call) -->
          <div class="lg:col-span-5 space-y-6">
            <section
              aria-label="1:1 Mentorship Connect"
              class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col h-[680px]"
            >
              <!-- Specific Mentor Selector Strip -->
              <div class="pb-3 border-b border-slate-100 space-y-2">
                <div class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  Select Specific Mentor to Chat or Video Call (${mentors.length} Available)
                </div>
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="mentor-selector-strip">
                  ${mentors
                    .map((m) => {
                      const isCurrent = m.id === activeMentor.id;
                      return `
                      <button
                        type="button"
                        data-action="select-mentor"
                        data-mentor-id="${m.id}"
                        class="px-3 py-2 rounded-xl border text-left flex items-center gap-2 shrink-0 transition-all ${
                          isCurrent
                            ? 'bg-indigo-50 border-[#4F46E5] ring-2 ring-indigo-500/15'
                            : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-100'
                        }"
                      >
                        <img
                          src="${m.avatarUrl}"
                          alt="${this.escapeHtml(m.name)}"
                          referrerpolicy="no-referrer"
                          class="w-7 h-7 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div class="text-xs font-extrabold text-slate-900 leading-none">${this.escapeHtml(m.name)}</div>
                          <div class="text-[10px] font-semibold text-[#10B981] mt-0.5">${this.escapeHtml(m.subjectSpecialty)}</div>
                        </div>
                      </button>
                    `;
                    })
                    .join('')}
                </div>
              </div>

              <!-- Active Mentor Header -->
              <div class="flex items-center justify-between py-3 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <img
                    src="${activeMentor.avatarUrl}"
                    alt="${this.escapeHtml(activeMentor.name)}"
                    referrerpolicy="no-referrer"
                    class="w-11 h-11 rounded-full object-cover border border-[#E2E8F0]"
                  />
                  <div>
                    <div class="flex items-center gap-2">
                      <h2 class="text-sm font-extrabold text-slate-900">${this.escapeHtml(activeMentor.name)}</h2>
                      <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
                    </div>
                    <p class="text-[11px] text-slate-500">
                      ${this.escapeHtml(activeMentor.role)} · ${this.escapeHtml(activeMentor.qualification)}
                    </p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-[#10B981] text-[10px] font-bold">
                  ${mySession?.status || 'ACTIVE'}
                </span>
              </div>

              <!-- 3-Mode Quick Request Strip (Chat, Jitsi Audio, Jitsi Video) -->
              <div class="grid grid-cols-3 gap-2 py-3 border-b border-slate-100">
                <button
                  type="button"
                  data-action="request-call"
                  data-call-type="CHAT"
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-indigo-50 text-[#4F46E5] text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  💬 1:1 Chat
                </button>
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="AUDIO"
                  data-mentor-id="${activeMentor.id}"
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50 text-[#10B981] text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  🎙️ Jitsi Audio
                </button>
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="VIDEO"
                  data-mentor-id="${activeMentor.id}"
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                >
                  📹 Jitsi Video
                </button>
              </div>

              <!-- Real-time Chat Thread with Selected Mentor -->
              <div id="mentorship-chat-scroll" class="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                ${(mySession?.messages ?? [])
                  .map((m) => {
                    const isStudent = m.senderRole === 'student';
                    return `
                    <div class="flex flex-col ${isStudent ? 'items-end' : 'items-start'}">
                      <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        isStudent
                          ? 'bg-[#4F46E5] text-white rounded-br-xs'
                          : 'bg-[#F8FAFC] border border-[#E2E8F0] text-slate-800 rounded-bl-xs'
                      }">
                        <div class="font-bold text-[10px] mb-1 ${
                          isStudent ? 'text-indigo-200' : 'text-[#4F46E5]'
                        }">
                          ${this.escapeHtml(m.senderName)} · ${m.timestamp}
                        </div>
                        <div>${this.escapeHtml(m.text)}</div>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>

              <!-- Send Message Form -->
              <form id="mentorship-chat-form" class="pt-3 border-t border-slate-100 flex items-center gap-2">
                <input
                  id="mentorship-chat-input"
                  type="text"
                  required
                  placeholder="Message ${this.escapeHtml(activeMentor.name)} directly..."
                  aria-label="Message to Mentor"
                  class="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5]"
                />
                <button
                  type="submit"
                  class="min-h-[42px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold transition-colors shrink-0"
                >
                  Send
                </button>
              </form>
            </section>
          </div>
        </div>

        <!-- Embedded Jitsi Meet Live Video/Audio Call Modal -->
        ${this.renderJitsiCallModal()}
      </div>
    `;

    this.bindEvents();
  }

  private renderJitsiCallModal(): string {
    if (!this.activeJitsiModal) return '';
    const { mode, roomName, mentor } = this.activeJitsiModal;
    const user = dataStore.getUser();
    const jitsiUrl = `https://meet.jit.si/${encodeURIComponent(
      roomName
    )}#userInfo.displayName="${encodeURIComponent(
      user.name
    )}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=${
      mode === 'AUDIO' ? 'true' : 'false'
    }`;

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jitsi Meet 1:1 Live Call Room"
        data-testid="jitsi-call-modal"
        class="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
          <!-- Top Call Bar -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping"></span>
              <div>
                <div class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Jitsi Meet Live ${mode} Room · Connected with ${this.escapeHtml(mentor.name)}
                </div>
                <div class="text-[11px] font-mono-tabular text-slate-300">
                  Room ID: ${this.escapeHtml(roomName)}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <a
                href="https://meet.jit.si/${encodeURIComponent(roomName)}"
                target="_blank"
                rel="noopener noreferrer"
                class="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <span>Open Full Jitsi Tab ↗</span>
              </a>
              <button
                type="button"
                data-action="close-call-modal"
                class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold"
              >
                End / Close Call ✕
              </button>
            </div>
          </div>

          <!-- Embedded Jitsi Meet Iframe -->
          <div class="relative bg-slate-950 w-full h-[460px] sm:h-[520px]">
            <iframe
              src="${jitsiUrl}"
              title="Jitsi Meet 1:1 Mentorship Video Call"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              class="w-full h-full border-0"
            ></iframe>
          </div>

          <div class="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Mentor <strong>${this.escapeHtml(mentor.name)}</strong> receives this exact Jitsi room (<code class="font-mono text-[#4F46E5]">${this.escapeHtml(roomName)}</code>) in the Admin Mentorship Desk.
            </span>
            <span class="font-mono-tabular text-[#10B981] font-bold">End-to-End Encrypted Jitsi WebRTC</span>
          </div>
        </div>
      </div>
    `;
  }

  private drawPrivacyStreamFrame(): void {
    const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#privacy-video-canvas'
    );
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
    grad.addColorStop(1, 'rgba(30, 27, 75, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

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

    ctx.fillStyle = '#a5b4fc';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(
      `MENTOR: ${(this.activeVideo.mentorName || 'SUMIT KUMAR').toUpperCase()} · ${(
        this.activeVideo.section || 'ROADMAP'
      ).toUpperCase()}`,
      64,
      90
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.activeVideo.title.slice(0, 56), 64, 145);

    const blocks = [
      {
        label: 'Block 1: High-Weightage Mechanics & Electrodynamics',
        pct: '42% Marks',
        color: '#4F46E5',
      },
      {
        label: 'Block 2: Electrochemistry, GOC & Named Carbonyls',
        pct: '33% Marks',
        color: '#10B981',
      },
      {
        label: 'Block 3: Definite Calculus, Vectors & 3D Loci',
        pct: '25% Marks',
        color: '#F59E0B',
      },
    ];

    blocks.forEach((b, idx) => {
      const y = 220 + idx * 115;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.fillRect(64, y, 1140, 88);
      ctx.strokeRect(64, y, 1140, 88);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(b.label, 92, y + 52);

      ctx.fillStyle = b.color;
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillText(b.pct, 1020, y + 52);
    });
  }

  private startPlaybackLoop(): void {
    const step = (now: number) => {
      if (!this.isPlaying) return;
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;
      const speed = SPEED_OPTIONS[this.speedIdx];
      this.currentTimeSec = Math.min(
        this.totalDurationSec,
        this.currentTimeSec + dt * speed
      );

      const timeEl = this.containerEl?.querySelector('#privacy-time-label');
      const scrub =
        this.containerEl?.querySelector<HTMLInputElement>('#privacy-scrubber');
      if (timeEl) {
        timeEl.textContent = `${formatDuration(this.currentTimeSec)} / ${
          this.activeVideo.duration
        }`;
      }
      if (scrub) {
        scrub.value = String(Math.floor(this.currentTimeSec));
      }

      this.animId = requestAnimationFrame(step);
    };
    this.animId = requestAnimationFrame(step);
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    const playerWrapper = this.containerEl.querySelector('#privacy-player-wrapper');
    playerWrapper?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.callbacks.onShowToast(
        'Right-click & direct video downloads are disabled on prepskm.in'
      );
    });

    const realVideoEl =
      this.containerEl.querySelector<HTMLVideoElement>('#real-html5-video-player');
    realVideoEl?.addEventListener('loadedmetadata', () => {
      if (realVideoEl.duration && Number.isFinite(realVideoEl.duration)) {
        this.totalDurationSec = Math.max(10, Math.round(realVideoEl.duration));
      }
    });
    realVideoEl?.addEventListener('timeupdate', () => {
      this.currentTimeSec = realVideoEl.currentTime;
      const timeEl = this.containerEl?.querySelector('#privacy-time-label');
      const scrub =
        this.containerEl?.querySelector<HTMLInputElement>('#privacy-scrubber');
      if (timeEl) {
        timeEl.textContent = `${formatDuration(this.currentTimeSec)} / ${
          this.activeVideo.duration
        }`;
      }
      if (scrub) {
        scrub.value = String(Math.floor(this.currentTimeSec));
      }
    });

    const scrubber =
      this.containerEl.querySelector<HTMLInputElement>('#privacy-scrubber');
    scrubber?.addEventListener('input', () => {
      this.currentTimeSec = Number(scrubber.value);
      if (realVideoEl) {
        realVideoEl.currentTime = this.currentTimeSec;
      }
      this.rerender();
      this.drawPrivacyStreamFrame();
    });

    // Doubt Attachment File Input
    const doubtFileInput =
      this.containerEl.querySelector<HTMLInputElement>('#video-doubt-file');
    doubtFileInput?.addEventListener('change', () => {
      const file = doubtFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.pendingDoubtAttachmentDataUrl = reader.result;
          this.pendingDoubtAttachmentName = file.name;
          this.callbacks.onShowToast(`Attached "${file.name}" to your doubt`);
          this.rerender();
          this.drawPrivacyStreamFrame();
        }
      };
      reader.readAsDataURL(file);
    });

    // Submit Timestamped Video Doubt
    const doubtForm =
      this.containerEl.querySelector<HTMLFormElement>('#video-doubt-form');
    doubtForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input =
        doubtForm.querySelector<HTMLInputElement>('#video-doubt-input');
      const text = input?.value.trim() ?? '';
      if (!text) return;

      const formattedTime = formatDuration(this.currentTimeSec);
      await dataStore.addVideoDoubt({
        videoId: this.activeVideo.id,
        videoTitle: this.activeVideo.title,
        timestampSec: this.currentTimeSec,
        timestampFormatted: formattedTime,
        doubtText: text,
        attachmentDataUrl: this.pendingDoubtAttachmentDataUrl ?? undefined,
        mentorId: this.activeVideo.mentorId || 'mentor_sumit_master',
        mentorName: this.activeVideo.mentorName || 'Sumit Kumar',
      });

      this.pendingDoubtAttachmentDataUrl = null;
      this.pendingDoubtAttachmentName = '';
      if (input) input.value = '';
      this.callbacks.onShowToast(
        `Doubt attached at ${formattedTime} & notified ${
          this.activeVideo.mentorName || 'Sumit Kumar'
        }!`
      );
      this.rerender();
      this.drawPrivacyStreamFrame();
    });

    // 1:1 Mentor Chat Form
    const chatForm = this.containerEl.querySelector<HTMLFormElement>(
      '#mentorship-chat-form'
    );
    chatForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = chatForm.querySelector<HTMLInputElement>(
        '#mentorship-chat-input'
      );
      const text = input?.value.trim() ?? '';
      if (!text) return;

      const mentors = dataStore.getMentors();
      const activeMentor =
        mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];
      const sessions = dataStore.getMentorshipSessions();
      let mySession = sessions.find((s) => s.mentorId === activeMentor.id);

      if (!mySession) {
        mySession = await dataStore.createMentorshipRequest({
          requestType: 'CHAT',
          initialMessage: text,
          mentorId: activeMentor.id,
          mentorName: activeMentor.name,
        });
      } else {
        await dataStore.sendMentorshipMessage(mySession.id, text, 'student');
      }

      if (input) input.value = '';
      this.callbacks.onShowToast(`Message sent to ${activeMentor.name}`);
      this.rerender();
      this.drawPrivacyStreamFrame();
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'vid-toggle-play': {
            this.isPlaying = !this.isPlaying;
            if (realVideoEl) {
              if (this.isPlaying) {
                void realVideoEl.play().catch(() => {});
              } else {
                realVideoEl.pause();
              }
            } else if (this.isPlaying) {
              this.lastTick = performance.now();
              this.startPlaybackLoop();
            } else if (this.animId !== null) {
              cancelAnimationFrame(this.animId);
              this.animId = null;
            }
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'vid-rewind': {
            this.currentTimeSec = Math.max(0, this.currentTimeSec - 10);
            if (realVideoEl) realVideoEl.currentTime = this.currentTimeSec;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'vid-forward': {
            this.currentTimeSec = Math.min(
              this.totalDurationSec,
              this.currentTimeSec + 10
            );
            if (realVideoEl) realVideoEl.currentTime = this.currentTimeSec;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'vid-cycle-speed': {
            this.speedIdx = (this.speedIdx + 1) % SPEED_OPTIONS.length;
            if (realVideoEl) {
              realVideoEl.playbackRate = SPEED_OPTIONS[this.speedIdx];
            }
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'vid-fullscreen': {
            const stage = this.containerEl?.querySelector('#privacy-video-stage');
            if (stage && stage.requestFullscreen) {
              void stage.requestFullscreen().catch(() => {});
            }
            break;
          }
          case 'seek-to-doubt': {
            const sec = Number(el.dataset.sec || 0);
            this.currentTimeSec = sec;
            if (realVideoEl) realVideoEl.currentTime = sec;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'filter-video-section': {
            this.selectedVideoSection = el.dataset.section || 'ALL';
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'select-video': {
            const vidId = el.dataset.videoId;
            const found = dataStore.getVideos().find((v) => v.id === vidId);
            if (found) {
              this.activeVideo = found;
              if (found.mentorId) {
                this.activeMentorId = found.mentorId;
              }
              this.currentTimeSec = 0;
              this.isPlaying = false;
              this.rerender();
              this.drawPrivacyStreamFrame();
            }
            break;
          }
          case 'select-mentor':
          case 'connect-video-mentor': {
            const mId = el.dataset.mentorId;
            if (mId) {
              this.activeMentorId = mId;
              const mentorObj = dataStore
                .getMentors()
                .find((m) => m.id === mId);
              if (mentorObj) {
                this.callbacks.onShowToast(
                  `Connected 1:1 Mentorship Desk to ${mentorObj.name} (${mentorObj.subjectSpecialty})`
                );
              }
              this.rerender();
              this.drawPrivacyStreamFrame();
            }
            break;
          }
          case 'request-call': {
            const callType =
              (el.dataset.callType as 'CHAT' | 'AUDIO' | 'VIDEO') || 'CHAT';
            const mentors = dataStore.getMentors();
            const mentor =
              mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];
            await dataStore.createMentorshipRequest({
              requestType: callType,
              initialMessage: `Student requested a 1:1 ${callType} session with ${mentor.name}.`,
              mentorId: mentor.id,
              mentorName: mentor.name,
            });
            this.callbacks.onShowToast(
              `1:1 ${callType} request sent to ${mentor.name}`
            );
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'start-jitsi-call': {
            const callType =
              (el.dataset.callType as 'AUDIO' | 'VIDEO') || 'VIDEO';
            const mId = el.dataset.mentorId || this.activeMentorId;
            const mentors = dataStore.getMentors();
            const mentor = mentors.find((m) => m.id === mId) ?? mentors[0];
            this.activeMentorId = mentor.id;

            const session = await dataStore.createMentorshipRequest({
              requestType: callType,
              initialMessage: `Joined Live Jitsi ${callType} Call with ${mentor.name}.`,
              mentorId: mentor.id,
              mentorName: mentor.name,
            });

            this.activeJitsiModal = {
              mode: callType,
              roomName:
                session.jitsiRoom ||
                `${mentor.jitsiRoomPrefix}_student_live`,
              mentor,
            };
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'close-call-modal': {
            this.activeJitsiModal = null;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
        }
      });
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
