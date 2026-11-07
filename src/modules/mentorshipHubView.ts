import { LECTURE_COVER_PATH, MENTOR_AVATAR_PATH } from '../constants';
import { analyzeMentorChatDoubtOrFileWithAI } from '../services/aiAssistantService';
import { dataStore, resolveStoredMediaBlobUrl } from '../services/firebaseService';
import type { MentorProfileItem, VideoRoadmapItem } from '../types';
import { formatDuration, isolateOptionLettersOnly } from '../utils/examLogic';
import {
  computeLectureOfflineCacheStatus,
  getLastOfflineCacheTimestamp,
  getOfflineCachedMaterialRecord,
  getStoredCachedMaterialIds,
  preDownloadMaterialsForOffline,
  selectLectureCompanionMaterials,
  type OfflineCachedMaterialRecord,
} from '../utils/lectureOfflineCache';

export interface MentorshipHubCallbacks {
  onShowToast: (message: string) => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export class MentorshipHubModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: MentorshipHubCallbacks;
  private activeMentorshipSection: 'videos' | 'chat' = 'videos';
  private activeVideo: VideoRoadmapItem;
  private resolvedVideoBlobUrl = '';
  private selectedVideoSection = 'ALL';
  private isPlaying = true;
  private isYoutubeFullScreenMode = false;
  private isMobileLandscapeLocked = false;
  private currentTimeSec = 120;
  private totalDurationSec = 2060;
  private speedIdx = 1;

  // Timestamped Doubt Attachment State
  private pendingDoubtAttachmentDataUrl: string | null = null;
  private pendingDoubtAttachmentName = '';

  // Specific Mentor Selection, Chat Image Attachment & Jitsi Call State
  private activeMentorId = 'mentor_sumit_master';
  private pendingChatImageDataUrl: string | null = null;
  private pendingChatImageName = '';
  private isChatAiLoading = false;
  private lastChatAiAnalysisSummary: {
    reply: string;
    extractedOptionLetters: string[];
  } | null = null;
  private activeJitsiModal: {
    mode: 'AUDIO' | 'VIDEO';
    roomName: string;
    mentor: MentorProfileItem;
  } | null = null;

  // Service Worker Offline Study Material Reader State
  private activeOfflineReaderRecord: OfflineCachedMaterialRecord | null = null;

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

    const params = new URLSearchParams(window.location.search);
    if (params.get('section') === 'chat') {
      this.activeMentorshipSection = 'chat';
    }

    void this.syncActiveVideoUrlAndRender();
    if (this.isPlaying) {
      this.lastTick = performance.now();
      this.startPlaybackLoop();
    }
  }

  private async syncActiveVideoUrlAndRender(): Promise<void> {
    if (this.activeVideo?.videoUrl) {
      this.resolvedVideoBlobUrl = await resolveStoredMediaBlobUrl(
        this.activeVideo.videoUrl
      );
    } else {
      this.resolvedVideoBlobUrl = '';
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
    const candidate = this.resolvedVideoBlobUrl || vid.videoUrl || '';
    if (!candidate) return false;
    if (candidate.startsWith('blob:')) {
      return (
        Boolean(this.resolvedVideoBlobUrl) &&
        typeof window !== 'undefined' &&
        candidate.startsWith(`blob:${window.location.origin}`)
      );
    }
    return (
      candidate.startsWith('data:video/') ||
      (candidate.startsWith('/uploaded-media/') && Boolean(this.resolvedVideoBlobUrl)) ||
      candidate.endsWith('.mp4') ||
      candidate.endsWith('.webm')
    );
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const isAdminOrMentor = dataStore.isAuthorizedAdminOrMentor();
    const allVideos = dataStore.getVideos();
    const mentors = dataStore.getMentors();
    const activeMentor =
      mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];
    const isMentorOnline = activeMentor.isOnline !== false;

    const videoSections = [
      'ALL',
      ...Array.from(
        new Set([
          'Strategy Roadmaps',
          'Physics Concept Capsules',
          'Organic & Inorganic Tricks',
          'Calculus & Coordinate Geometry',
          'PYQ Video Solutions',
          ...allVideos.map((v) => v.section || 'Strategy Roadmaps'),
        ])
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
    const effectiveVideoSrc =
      this.resolvedVideoBlobUrl || this.activeVideo.videoUrl || '';
    const companionMaterials = selectLectureCompanionMaterials(
      dataStore.getMaterials(),
      this.activeVideo
    );
    const cachedMaterialIds = getStoredCachedMaterialIds();
    const offlineStatus = computeLectureOfflineCacheStatus({
      swSupported:
        typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      swActive: true,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      cachedMaterialIds,
      availableMaterials: companionMaterials,
      lastSyncedAt: getLastOfflineCacheTimestamp(),
    });

    if (this.isYoutubeFullScreenMode) {
      this.containerEl.innerHTML = this.renderYoutubeFullScreenPlayer(
        allVideos,
        videoDoubts,
        user.name,
        user.email,
        speed,
        effectiveVideoSrc
      );
      this.bindEvents();
      this.drawPrivacyStreamFrame();
      return;
    }

    this.containerEl.innerHTML = `
      <div class="space-y-5">
        <!-- SLIM TOP MENTORSHIP BAR WITH 2 DEDICATED SECTIONS: VIDEO LECTURES vs 1:1 MENTORS & CHAT -->
        <section
          aria-label="Top 1:1 Mentorship Live Bar"
          data-testid="top-mentorship-bar"
          class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl px-4 py-3 shadow-2xs space-y-3"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Mentorship &amp; Lectures
              </span>
              <span
                data-testid="mentor-online-badge"
                class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1.5 ${
                  isMentorOnline
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }"
              >
                <span class="w-2 h-2 rounded-full ${
                  isMentorOnline ? 'bg-[#10B981] animate-pulse' : 'bg-amber-500'
                }"></span>
                ${this.escapeHtml(activeMentor.name)}: ${
                  isMentorOnline ? 'Active Now' : 'Offline'
                }
              </span>
              <h1 class="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                Video Lectures &amp; 1:1 Mentor Connect
              </h1>
            </div>

            <!-- 2 Dedicated Section Tabs: 1) Video Lectures | 2) 1:1 Mentors, Chat & Appointments -->
            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex items-center p-1 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1]">
                <button
                  type="button"
                  data-action="switch-mentorship-section"
                  data-section="videos"
                  data-testid="mentorship-tab-videos"
                  class="min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    this.activeMentorshipSection === 'videos'
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }"
                >
                  🎬 Video Lectures (${allVideos.length})
                </button>
                <button
                  type="button"
                  data-action="switch-mentorship-section"
                  data-section="chat"
                  data-testid="mentorship-tab-chat"
                  class="min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    this.activeMentorshipSection === 'chat'
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }"
                >
                  💬 1:1 Mentors, Chat &amp; Appointments (${mentors.length})
                </button>
              </div>

              ${
                isAdminOrMentor
                  ? `
                <button
                  type="button"
                  data-action="toggle-mentor-online"
                  data-mentor-id="${activeMentor.id}"
                  data-testid="toggle-mentor-online-btn"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-extrabold transition-colors"
                >
                  ⚡ Set ${this.escapeHtml(activeMentor.name.split(' ')[0])} ${
                    isMentorOnline ? 'Offline' : 'Active'
                  }
                </button>
              `
                  : ''
              }
              <button
                type="button"
                data-action="open-youtube-player"
                data-testid="open-youtube-player-btn"
                class="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-extrabold transition-colors"
              >
                📺 Theatre Mode
              </button>
              <button
                type="button"
                data-action="start-jitsi-call"
                data-call-type="AUDIO"
                data-mentor-id="${activeMentor.id}"
                data-testid="top-voice-call-btn"
                ${
                  !isMentorOnline
                    ? 'disabled title="Voice Call is only available when Mentor is Active"'
                    : ''
                }
                class="min-h-[34px] px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-colors ${
                  isMentorOnline
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-[#10B981] cursor-pointer'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-65'
                }"
              >
                📞 Voice Call
              </button>
              <button
                type="button"
                data-action="start-jitsi-call"
                data-call-type="VIDEO"
                data-mentor-id="${activeMentor.id}"
                data-testid="launch-jitsi-video-btn"
                ${
                  !isMentorOnline
                    ? 'disabled title="Video Call is only available when Mentor is Active"'
                    : ''
                }
                class="min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-2xs transition-colors ${
                  isMentorOnline
                    ? 'bg-[#4F46E5] hover:bg-indigo-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-65'
                }"
              >
                🎥 Video Call
              </button>
            </div>
          </div>
        </section>

        ${
          this.activeMentorshipSection === 'videos'
            ? this.renderVideosSection({
                user,
                filteredVideos,
                videoSections,
                videoDoubts,
                speed,
                isRealVideo,
                effectiveVideoSrc,
                companionMaterials,
                cachedMaterialIds,
                offlineStatus,
              })
            : this.renderMentorsAndChatSection({
                mentors,
                activeMentor,
                isMentorOnline,
                mySession,
              })
        }

        <!-- Embedded Jitsi Meet Live Video/Audio Call Modal -->
        ${this.renderJitsiCallModal()}
      </div>
    `;

    this.bindEvents();
  }

  private renderVideosSection(params: {
    user: ReturnType<typeof dataStore.getUser>;
    filteredVideos: VideoRoadmapItem[];
    videoSections: string[];
    videoDoubts: ReturnType<typeof dataStore.getVideoDoubts>;
    speed: number;
    isRealVideo: boolean;
    effectiveVideoSrc: string;
    companionMaterials: ReturnType<typeof selectLectureCompanionMaterials>;
    cachedMaterialIds: string[];
    offlineStatus: ReturnType<typeof computeLectureOfflineCacheStatus>;
  }): string {
    const {
      user,
      filteredVideos,
      videoSections,
      videoDoubts,
      speed,
      isRealVideo,
      effectiveVideoSrc,
      companionMaterials,
      cachedMaterialIds,
      offlineStatus,
    } = params;

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" data-testid="mentorship-videos-section">
        <!-- Left 8 Cols: Active Playing Lecture Player + Doubt Attacher + Service Worker Offline Cache -->
        <div class="lg:col-span-8 space-y-6">
          <section
            aria-label="Enhanced Lecture Media Player"
            id="privacy-player-wrapper"
            class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl overflow-hidden shadow-sm select-none"
          >
            <!-- Uploading Mentor Attribution Header Bar -->
            <div class="px-4 py-3 bg-[#FAF6EE] border-b border-[#E8DFD1] flex flex-wrap items-center justify-between gap-2">
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
                      Uploaded by: ${this.escapeHtml(
                        this.activeVideo.mentorName || 'Sumit Kumar'
                      )}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-indigo-100 text-[#4F46E5] text-[10px] font-bold">
                      ${this.escapeHtml(
                        this.activeVideo.section || 'Strategy Roadmaps'
                      )}
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500">
                    ${this.escapeHtml(
                      this.activeVideo.mentorRole ||
                        'Master Admin & Lead Physics Mentor'
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-action="connect-video-mentor"
                data-mentor-id="${
                  this.activeVideo.mentorId || 'mentor_sumit_master'
                }"
                class="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
              >
                💬 Chat / Book Appointment with ${this.escapeHtml(
                  (this.activeVideo.mentorName || 'Sumit').split(' ')[0]
                )} →
              </button>
            </div>

            <!-- Video Viewport Stage (Real HTML5 Video for Uploaded Videos OR Active Interactive Chalkboard Stream) -->
            <div
              id="privacy-video-stage"
              class="relative aspect-video bg-slate-950 overflow-hidden"
            >
              ${
                isRealVideo
                  ? `
                <video
                  id="real-html5-video-player"
                  data-testid="real-html5-video-player"
                  src="${effectiveVideoSrc}"
                  poster="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                  controls
                  autoplay
                  playsinline
                  class="w-full h-full object-contain bg-black"
                ></video>
              `
                  : `
                <img
                  src="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
                  alt="${this.escapeHtml(this.activeVideo.title)}"
                  referrerpolicy="no-referrer"
                  class="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
                    this.isPlaying ? 'opacity-0' : 'opacity-30'
                  }"
                />
                <canvas
                  id="privacy-video-canvas"
                  data-testid="interactive-lecture-canvas"
                  width="1280"
                  height="720"
                  data-action="vid-toggle-play"
                  class="relative z-10 w-full h-full block cursor-pointer"
                ></canvas>
              `
              }

              <!-- Dynamic Floating Student Watermark Overlay -->
              <div
                aria-label="Dynamic Student Watermark"
                class="privacy-watermark absolute bottom-16 right-4 z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-[10px] font-mono-tabular text-white/75"
              >
                prepskm.in Protected · ${this.escapeHtml(user.name)} (${this.escapeHtml(
                  user.email || 'Student'
                )})
              </div>

              <!-- Live Playback Badge -->
              <div class="absolute top-3 right-3 z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-indigo-950/85 border border-indigo-400/30 text-[10px] font-mono-tabular text-indigo-200 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${
                  this.isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }"></span>
                ${
                  isRealVideo
                    ? 'Playing Uploaded Video File'
                    : this.isPlaying
                      ? 'LIVE LECTURE STREAM PLAYING'
                      : 'PAUSED'
                }
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
                  data-testid="lecture-play-toggle-btn"
                  aria-label="${this.isPlaying ? 'Pause Video' : 'Play Video'}"
                  class="pointer-events-auto w-12 h-12 rounded-full bg-[#4F46E5] hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg font-bold"
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
            <div class="p-4 bg-[#FFFDF9] border-t border-[#E8DFD1] space-y-3">
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
                    ${formatDuration(this.currentTimeSec)} / ${
                      this.activeVideo.duration
                    }
                  </span>
                  <button
                    type="button"
                    data-action="vid-cycle-speed"
                    class="min-h-[34px] px-3 py-1 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-mono-tabular font-bold text-[#4F46E5]"
                  >
                    ${speed}x
                  </button>
                  <button
                    type="button"
                    data-action="vid-fullscreen"
                    class="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-bold text-slate-700"
                  >
                    ⛶
                  </button>
                </div>
              </div>
              <p class="text-xs text-slate-600">
                ${this.escapeHtml(this.activeVideo.description)}
              </p>
            </div>

            <!-- ATTACH DOUBT AT CURRENT TIMESTAMP -->
            <div class="p-4 bg-[#FAF6EE] border-t border-[#E8DFD1] space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md bg-[#4F46E5] text-white font-mono-tabular text-[11px] font-bold">
                    @ ${formatDuration(this.currentTimeSec)}
                  </span>
                  <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                    Attach Doubt to This Lecture (Sent to ${this.escapeHtml(
                      this.activeVideo.mentorName || 'Sumit Kumar'
                    )})
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
                    placeholder="Ask your doubt at ${formatDuration(
                      this.currentTimeSec
                    )} (e.g., Why does friction act upward here?)..."
                    class="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5]"
                  />
                  <label
                    for="video-doubt-file"
                    class="min-h-[40px] px-3 py-2 rounded-xl bg-[#FFFDF9] hover:bg-amber-50 border border-[#E8DFD1] text-xs font-bold text-slate-700 cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <span>📎 ${
                      this.pendingDoubtAttachmentName
                        ? 'Attached ✓'
                        : 'Attach Note/Img'
                    }</span>
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

              <div class="space-y-2 max-h-44 overflow-y-auto pt-1" data-testid="video-doubts-list">
                ${videoDoubts
                  .map(
                    (d) => `
                  <div class="p-2.5 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] space-y-1.5 text-xs">
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
                        <span class="font-bold text-slate-900">${this.escapeHtml(
                          d.studentName
                        )}</span>
                      </div>
                      <span class="text-[10px] text-slate-400 font-mono-tabular">${this.escapeHtml(
                        d.createdAt
                      )}</span>
                    </div>
                    <p class="text-slate-700 leading-snug">${this.escapeHtml(
                      d.doubtText
                    )}</p>
                    ${
                      d.attachmentDataUrl
                        ? `<img src="${d.attachmentDataUrl}" alt="Doubt attachment" class="max-h-24 rounded-lg border border-slate-200 mt-1" />`
                        : ''
                    }
                    ${
                      d.mentorReply
                        ? `
                      <div class="p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950">
                        <strong class="text-[#10B981]">${this.escapeHtml(
                          d.mentorName || 'Mentor'
                        )} Reply:</strong> ${this.escapeHtml(d.mentorReply)}
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

            <!-- SERVICE WORKER OFFLINE STUDY MATERIALS CACHE FOR THIS LECTURE -->
            <div
              data-testid="lecture-offline-cache-panel"
              class="p-4 bg-[#FAF6EE] border-t border-[#E8DFD1] space-y-3"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div class="space-y-0.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      offlineStatus.isOnline
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }">
                      ${
                        offlineStatus.isOnline
                          ? '⚡ Service Worker Offline Cache Active'
                          : '📡 Offline Mode — Serving from Cache'
                      }
                    </span>
                    <span class="text-xs font-extrabold text-slate-900">
                      ${offlineStatus.cachedCount}/${
                        offlineStatus.totalAvailableCount
                      } Companion Study Materials Cached (${
                        offlineStatus.coveragePercent
                      }%)
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-600">
                    Pre-downloaded PDFs, formula sheets &amp; chapter notes remain accessible inside this Lecture Player during intermittent internet connectivity.
                  </p>
                </div>

                <button
                  type="button"
                  data-action="predownload-lecture-materials"
                  data-testid="predownload-offline-materials-btn"
                  class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs shrink-0 transition-colors"
                >
                  📥 Pre-Download All (${companionMaterials.length}) for Offline
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                ${companionMaterials
                  .map((mat) => {
                    const isCached = cachedMaterialIds.includes(mat.id);
                    return `
                      <div class="p-2.5 rounded-xl bg-[#FFFDF9] border ${
                        isCached ? 'border-emerald-300' : 'border-[#E8DFD1]'
                      } flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              isCached
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }">
                              ${isCached ? '✓ Cached Offline' : 'Online'}
                            </span>
                            <span class="text-[10px] font-bold text-[#4F46E5] truncate">${this.escapeHtml(
                              mat.section
                            )}</span>
                          </div>
                          <div class="text-xs font-extrabold text-slate-900 truncate mt-0.5">${this.escapeHtml(
                            mat.title
                          )}</div>
                          <div class="text-[10px] font-mono-tabular text-slate-500">${
                            mat.pagesCount
                          } pages · ${this.escapeHtml(
                            mat.cohortTag || mat.classId
                          )}</div>
                        </div>
                        <button
                          type="button"
                          data-action="open-offline-material-reader"
                          data-material-id="${this.escapeHtml(mat.id)}"
                          class="min-h-[32px] px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-[11px] font-extrabold shrink-0"
                        >
                          📖 Open Offline
                        </button>
                      </div>
                    `;
                  })
                  .join('')}
              </div>

              ${
                this.activeOfflineReaderRecord
                  ? `
                <div
                  data-testid="lecture-offline-material-reader"
                  class="p-3.5 rounded-xl bg-[#FFFDF9] border-2 border-emerald-400 space-y-2 shadow-sm"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      ✓ Served from Service Worker Cache (prepskm-lecture-materials-v1)
                    </span>
                    <button
                      type="button"
                      data-action="close-offline-material-reader"
                      class="text-xs font-bold text-slate-600 hover:text-slate-900"
                    >
                      Close ✕
                    </button>
                  </div>
                  <h4 class="text-xs sm:text-sm font-extrabold text-slate-900">${this.escapeHtml(
                    this.activeOfflineReaderRecord.title
                  )}</h4>
                  <ul class="list-disc pl-4 space-y-1 text-xs text-slate-700">
                    ${this.activeOfflineReaderRecord.offlineSummaryPoints
                      .map((pt) => `<li>${this.escapeHtml(pt)}</li>`)
                      .join('')}
                  </ul>
                </div>
              `
                  : ''
              }
            </div>
          </section>
        </div>

        <!-- Right 4 Cols: Section-Wise Video Playlist -->
        <div class="lg:col-span-4 space-y-4">
          <section
            aria-label="Mentor Video Roadmaps"
            class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
                  Video Lectures Playlist
                </h2>
                <span class="text-[11px] font-mono-tabular font-bold text-[#4F46E5]">
                  ${filteredVideos.length} Lectures
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                ${videoSections
                  .map(
                    (sec) => `
                  <button
                    type="button"
                    data-action="filter-video-section"
                    data-section="${this.escapeHtml(sec)}"
                    class="min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      this.selectedVideoSection === sec
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-[#FAF6EE] border border-[#E8DFD1] text-slate-600 hover:bg-amber-50'
                    }"
                  >
                    ${sec === 'ALL' ? 'All' : this.escapeHtml(sec)}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              ${filteredVideos
                .map((v) => {
                  const isSelected = v.id === this.activeVideo.id;
                  return `
                  <div
                    class="rounded-xl border overflow-hidden transition-all ${
                      isSelected
                        ? 'border-[#4F46E5] ring-2 ring-indigo-500/20 bg-indigo-50/30'
                        : 'border-[#E8DFD1] bg-[#FAF6EE] hover:bg-[#FFFDF9]'
                    }"
                  >
                    <button
                      type="button"
                      data-action="select-video"
                      data-video-id="${v.id}"
                      class="text-left w-full flex gap-3 p-2.5 items-center"
                    >
                      <div class="relative w-28 h-18 rounded-lg bg-slate-900 overflow-hidden shrink-0">
                        <img
                          src="${v.thumbnailUrl || LECTURE_COVER_PATH}"
                          alt="${this.escapeHtml(v.title)}"
                          referrerpolicy="no-referrer"
                          class="w-full h-full object-cover opacity-90"
                        />
                        <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[9px] font-mono-tabular">
                          ${v.duration}
                        </span>
                      </div>
                      <div class="min-w-0 flex-1 space-y-1">
                        <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-[#4F46E5] text-[9px] font-extrabold">
                          ${this.escapeHtml(v.section || 'Strategy Roadmaps')}
                        </span>
                        <div class="text-xs font-extrabold text-slate-900 line-clamp-2">
                          ${this.escapeHtml(v.title)}
                        </div>
                        <div class="text-[10px] font-bold text-slate-600 truncate">
                          By ${this.escapeHtml(v.mentorName || 'Sumit Kumar')}
                        </div>
                      </div>
                    </button>
                    <div class="px-3 pb-2 pt-1 flex items-center justify-between border-t border-[#E8DFD1]/60">
                      <span class="text-[10px] text-slate-500 truncate">${this.escapeHtml(
                        v.topicTag
                      )}</span>
                      <button
                        type="button"
                        data-action="connect-video-mentor"
                        data-mentor-id="${v.mentorId || 'mentor_sumit_master'}"
                        class="text-[11px] font-extrabold text-[#4F46E5] hover:underline shrink-0"
                      >
                        Chat with Mentor →
                      </button>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  private renderMentorsAndChatSection(params: {
    mentors: MentorProfileItem[];
    activeMentor: MentorProfileItem;
    isMentorOnline: boolean;
    mySession: ReturnType<typeof dataStore.getMentorshipSessions>[number] | undefined;
  }): string {
    const { mentors, activeMentor, isMentorOnline, mySession } = params;
    const appointments = mySession?.appointments ?? [];

    return `
      <div class="space-y-6" data-testid="mentorship-chat-section">
        <!-- FULL-IMAGE MENTOR GALLERY: Click Any Mentor Card to Open Chat, Book Appointment, or Send Images -->
        <section
          aria-label="Select Mentor with Full Portrait Image"
          class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                1:1 Mentorship Faculty Directory (${mentors.length} Mentors)
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Click Any Mentor Below to Chat, Send Question Images &amp; Book 1:1 Appointments
              </h2>
            </div>
            <span class="text-xs font-semibold text-slate-500">
              Selected: <strong class="text-[#4F46E5]">${this.escapeHtml(
                activeMentor.name
              )}</strong>
            </span>
          </div>

          <div
            data-testid="mentor-selector-strip"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            ${mentors
              .map((m) => {
                const isCurrent = m.id === activeMentor.id;
                const online = m.isOnline !== false;
                return `
                  <button
                    type="button"
                    data-action="select-mentor"
                    data-mentor-id="${m.id}"
                    data-testid="mentor-card-${m.id}"
                    class="rounded-2xl border overflow-hidden text-left transition-all flex flex-col justify-between group ${
                      isCurrent
                        ? 'border-[#4F46E5] ring-2 ring-indigo-500/25 bg-indigo-50/30 shadow-sm'
                        : 'border-[#E8DFD1] bg-[#FAF6EE] hover:bg-[#FFFDF9] hover:border-indigo-300'
                    }"
                  >
                    <div class="relative h-48 w-full bg-slate-900 overflow-hidden">
                      <img
                        src="${m.avatarUrl || MENTOR_AVATAR_PATH}"
                        alt="${this.escapeHtml(m.name)}"
                        referrerpolicy="no-referrer"
                        class="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                      <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        online
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }">
                        ${online ? '● Active for Calls & Chat' : '● Chat & Appointments'}
                      </span>
                      ${
                        isCurrent
                          ? `
                        <span class="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#4F46E5] text-white text-[10px] font-extrabold">
                          Selected ✓
                        </span>
                      `
                          : ''
                      }
                    </div>
                    <div class="p-3.5 space-y-1.5 w-full">
                      <div class="flex items-center justify-between gap-2">
                        <h3 class="text-sm font-extrabold text-slate-900">
                          ${this.escapeHtml(m.name)}
                        </h3>
                        <span class="px-2 py-0.5 rounded bg-emerald-50 text-[#10B981] text-[10px] font-extrabold">
                          ${this.escapeHtml(m.subjectSpecialty)}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 font-semibold">
                        ${this.escapeHtml(m.role)} · ${this.escapeHtml(
                          m.qualification
                        )}
                      </p>
                      <div class="pt-2 border-t border-[#E8DFD1]/70 flex items-center justify-between text-[11px] font-extrabold text-[#4F46E5]">
                        <span>💬 Chat &amp; Send Image</span>
                        <span>📅 Book Appointment →</span>
                      </div>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- SELECTED MENTOR 1:1 WORKSPACE: Chat + Send Image (7 Cols) & Book 1:1 Appointment (5 Cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 7 Cols: Real-time 1:1 Chat with Image Attachment -->
          <section
            aria-label="1:1 Mentorship Chat with Image Sharing"
            class="lg:col-span-7 bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col h-[560px]"
          >
            <!-- Active Mentor Header -->
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8DFD1]">
              <div class="flex items-center gap-3">
                <img
                  src="${activeMentor.avatarUrl || MENTOR_AVATAR_PATH}"
                  alt="${this.escapeHtml(activeMentor.name)}"
                  referrerpolicy="no-referrer"
                  class="w-12 h-12 rounded-xl object-cover border border-[#E8DFD1]"
                />
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
                      ${this.escapeHtml(activeMentor.name)}
                    </h2>
                    <span class="w-2.5 h-2.5 rounded-full ${
                      isMentorOnline ? 'bg-[#10B981]' : 'bg-amber-500'
                    }"></span>
                  </div>
                  <p class="text-xs text-slate-500">
                    ${this.escapeHtml(activeMentor.role)} · ${this.escapeHtml(
                      activeMentor.qualification
                    )}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="AUDIO"
                  data-mentor-id="${activeMentor.id}"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#10B981] text-xs font-extrabold"
                >
                  🎙️ Voice Call
                </button>
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="VIDEO"
                  data-mentor-id="${activeMentor.id}"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  📹 Video Call
                </button>
              </div>
            </div>

            <!-- Chat Messages Thread -->
            <div
              id="mentorship-chat-scroll"
              data-testid="mentorship-chat-messages"
              class="flex-1 overflow-y-auto py-4 space-y-3 pr-1"
            >
              ${(mySession?.messages ?? [])
                .map((m) => {
                  const isStudent = m.senderRole === 'student';
                  return `
                  <div class="flex flex-col ${
                    isStudent ? 'items-end' : 'items-start'
                  }">
                    <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      isStudent
                        ? 'bg-[#4F46E5] text-white rounded-br-xs'
                        : 'bg-[#FAF6EE] border border-[#E8DFD1] text-slate-800 rounded-bl-xs'
                    }">
                      <div class="font-bold text-[10px] mb-1 ${
                        isStudent ? 'text-indigo-200' : 'text-[#4F46E5]'
                      }">
                        ${this.escapeHtml(m.senderName)} · ${m.timestamp}
                      </div>
                      ${
                        m.appointmentSlot
                          ? `
                        <div class="mb-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-300/40 text-[11px] font-extrabold">
                          📅 Appointment Slot: ${this.escapeHtml(
                            m.appointmentSlot
                          )}
                        </div>
                      `
                          : ''
                      }
                      <div>${this.escapeHtml(m.text)}</div>
                      ${
                        m.imageDataUrl
                          ? `
                        <img
                          src="${m.imageDataUrl}"
                          alt="Chat attachment"
                          class="mt-2 max-h-44 rounded-xl border border-white/20 object-contain bg-white"
                        />
                      `
                          : ''
                      }
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>

            <!-- Embedded AI Doubt & File Analysis Assistant Bar -->
            <div
              data-testid="embedded-chat-ai-assistant"
              class="p-3 rounded-2xl bg-gradient-to-r from-[#FDF2F8] via-[#FAF5FF] to-[#F0FDFA] border border-[#F5D0FE] space-y-2 mb-2"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <span class="px-2.5 py-0.5 rounded-full bg-white border border-pink-200 text-[10px] font-extrabold text-[#DB2777] uppercase tracking-wider">
                    🤖 Embedded AI Mentor Assistant
                  </span>
                  <span class="text-[11px] font-bold text-[#1E1B4B]">
                    Instant Doubt Resolution &amp; Cropped File Option-Letter Analysis
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-action="trigger-chat-ai-doubt"
                    data-testid="chat-ai-doubt-btn"
                    class="min-h-[34px] px-3 py-1 rounded-xl bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:opacity-95 text-white text-[11px] font-extrabold shadow-xs transition-all cursor-pointer"
                  >
                    ${this.isChatAiLoading ? '⏳ AI Solving...' : '✨ AI Instant Doubt Reply'}
                  </button>
                  <button
                    type="button"
                    data-action="trigger-chat-ai-file-analysis"
                    data-testid="chat-ai-file-analyze-btn"
                    class="min-h-[34px] px-3 py-1 rounded-xl bg-white hover:bg-pink-50 border border-[#F3E8FF] text-[#7C3AED] text-[11px] font-extrabold shadow-2xs transition-all cursor-pointer"
                  >
                    🔍 AI Analyze File &amp; Isolate Options
                  </button>
                </div>
              </div>
              ${
                this.lastChatAiAnalysisSummary
                  ? `
                <div
                  data-testid="chat-ai-analysis-output"
                  class="p-2.5 rounded-xl bg-white/95 border border-pink-200 text-xs text-[#1E1B4B] space-y-1.5"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-extrabold text-[#DB2777]">🤖 AI Doubt &amp; File Analysis Result:</span>
                    <div class="flex items-center gap-1">
                      <span class="text-[10px] font-bold text-slate-500">Isolated Option Letters:</span>
                      ${this.lastChatAiAnalysisSummary.extractedOptionLetters
                        .map(
                          (letter) => `
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-pink-50 border border-pink-200 font-mono-tabular text-[11px] font-extrabold text-[#DB2777]">
                          ${this.escapeHtml(letter)}
                        </span>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-700 leading-relaxed">${this.escapeHtml(
                    this.lastChatAiAnalysisSummary.reply
                  )}</p>
                </div>
              `
                  : ''
              }
            </div>

            <!-- Send Chat Message + Image Upload Form -->
            <form
              id="mentorship-chat-form"
              class="pt-2 border-t border-[#F3E8FF] space-y-2"
            >
              ${
                this.pendingChatImageDataUrl
                  ? `
                <div class="flex items-center justify-between px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-xs text-pink-950">
                  <span class="font-bold truncate">📷 Image Ready: ${this.escapeHtml(
                    this.pendingChatImageName
                  )}</span>
                  <button
                    type="button"
                    data-action="clear-chat-image"
                    class="text-rose-600 font-extrabold ml-2"
                  >
                    Remove ✕
                  </button>
                </div>
              `
                  : ''
              }
              <div class="flex items-center gap-2">
                <label
                  for="mentorship-chat-image-input"
                  data-testid="chat-attach-image-label"
                  class="min-h-[44px] px-3 py-2 rounded-2xl bg-[#FFF9FB] hover:bg-pink-50 border border-[#F3E8FF] text-xs font-extrabold text-[#1E1B4B] cursor-pointer inline-flex items-center gap-1 shrink-0"
                  title="Send Doubt Image to Mentor & AI"
                >
                  📷 ${this.pendingChatImageName ? 'Image ✓' : 'Send Image'}
                </label>
                <input
                  id="mentorship-chat-image-input"
                  type="file"
                  accept="image/*"
                  class="hidden"
                />
                <input
                  id="mentorship-chat-input"
                  type="text"
                  placeholder="Message ${this.escapeHtml(
                    activeMentor.name
                  )} or ask the embedded AI Assistant..."
                  aria-label="Message to Mentor"
                  class="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#FFF9FB] border border-[#F3E8FF] text-xs text-[#1E1B4B] placeholder:text-slate-400 focus:outline-none focus:border-[#EC4899]"
                />
                <button
                  type="submit"
                  data-testid="send-mentor-chat-btn"
                  class="min-h-[44px] px-4 py-2 rounded-2xl bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-extrabold transition-all shrink-0"
                >
                  Send →
                </button>
              </div>
            </form>
          </section>

          <!-- Right 5 Cols: Book 1:1 Mentor Appointment -->
          <section
            aria-label="Book 1:1 Mentor Appointment"
            data-testid="mentor-appointment-panel"
            class="lg:col-span-5 bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
          >
            <div class="space-y-1 border-b border-[#E8DFD1] pb-3">
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#10B981] text-[10px] font-extrabold uppercase tracking-wider">
                📅 1:1 Appointment Scheduler
              </span>
              <h3 class="text-base font-extrabold text-slate-900">
                Book an Appointment with ${this.escapeHtml(activeMentor.name)}
              </h3>
              <p class="text-xs text-slate-600">
                Reserve a dedicated 1:1 doubt-clearing or strategy review slot.
              </p>
            </div>

            <form id="mentor-appointment-form" class="space-y-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Preferred Date
                </label>
                <input
                  id="appointment-date-input"
                  type="date"
                  required
                  value="${new Date().toISOString().slice(0, 10)}"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Time Slot
                </label>
                <select
                  id="appointment-slot-select"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-semibold text-slate-900"
                >
                  <option value="05:00 PM - 05:30 PM IST">05:00 PM - 05:30 PM IST (Evening Slot)</option>
                  <option value="07:00 PM - 07:30 PM IST">07:00 PM - 07:30 PM IST (Prime Doubt Slot)</option>
                  <option value="09:00 PM - 09:30 PM IST">09:00 PM - 09:30 PM IST (Night Strategy Slot)</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Discussion Topic / Chapter Doubt
                </label>
                <input
                  id="appointment-topic-input"
                  type="text"
                  required
                  placeholder="e.g., Rotational Mechanics PYQ review + Mock Test #14 analysis"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                data-testid="book-mentor-appointment-btn"
                class="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm transition-colors"
              >
                📅 Confirm 1:1 Appointment with ${this.escapeHtml(
                  activeMentor.name.split(' ')[0]
                )}
              </button>
            </form>

            <!-- Booked Appointments List -->
            <div class="space-y-2 pt-2 border-t border-[#E8DFD1]" data-testid="booked-appointments-list">
              <div class="text-xs font-extrabold text-slate-900">
                Your Scheduled Appointments (${appointments.length})
              </div>
              ${
                appointments.length === 0
                  ? `
                <p class="text-xs text-slate-500">
                  No appointments booked yet with ${this.escapeHtml(
                    activeMentor.name
                  )}. Book a slot above!
                </p>
              `
                  : appointments
                      .map(
                        (apt) => `
                  <div class="p-3 rounded-xl bg-[#FAF6EE] border border-emerald-200 space-y-1 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-extrabold text-slate-900">${this.escapeHtml(
                        apt.dateStr
                      )} · ${this.escapeHtml(apt.timeSlot)}</span>
                      <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        ${this.escapeHtml(apt.status)}
                      </span>
                    </div>
                    <p class="text-slate-700">${this.escapeHtml(apt.topic)}</p>
                  </div>
                `
                      )
                      .join('')
              }
            </div>
          </section>
        </div>
      </div>
    `;
  }

  private renderYoutubeFullScreenPlayer(
    allVideos: VideoRoadmapItem[],
    videoDoubts: ReturnType<typeof dataStore.getVideoDoubts>,
    userName: string,
    userEmail: string,
    speed: number,
    effectiveVideoSrc: string
  ): string {
    const isRealVideo = this.hasRealVideoSource(this.activeVideo);
    const suggestedVideos = allVideos.filter((v) => v.id !== this.activeVideo.id);

    return `
      <div
        data-testid="fullscreen-youtube-player"
        class="space-y-5 bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-6 shadow-md"
      >
        <!-- Top YouTube-Style Theatre Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8DFD1]">
          <div class="flex items-center gap-3">
            <button
              type="button"
              data-action="close-youtube-player"
              data-testid="close-youtube-player-btn"
              class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-amber-50 border border-[#E8DFD1] text-xs font-extrabold text-slate-800 transition-colors"
            >
              ← Back to Sections &amp; 1:1 Mentorship
            </button>
            <div>
              <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] text-[10px] font-extrabold">
                ${this.escapeHtml(
                  this.activeVideo.section || 'Strategy Roadmaps'
                )}
              </span>
              <h1 class="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                ${this.escapeHtml(this.activeVideo.title)}
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              data-action="toggle-mobile-orientation"
              class="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-xs font-extrabold"
            >
              📱 ${
                this.isMobileLandscapeLocked
                  ? 'Portrait Mode ↕'
                  : 'Rotate Horizontal ↔'
              }
            </button>
            <button
              type="button"
              data-action="vid-fullscreen"
              class="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold"
            >
              ⛶ Native Fullscreen
            </button>
          </div>
        </div>

        <!-- Primary Theatre Stage (Horizontal 16:9 Video + Controls) -->
        <div
          id="privacy-video-stage"
          class="relative w-full ${
            this.isMobileLandscapeLocked ? 'aspect-[21/9]' : 'aspect-video'
          } rounded-2xl overflow-hidden bg-slate-950 border border-[#E8DFD1] shadow-lg"
        >
          ${
            isRealVideo
              ? `
            <video
              id="real-html5-video-player"
              src="${effectiveVideoSrc}"
              poster="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
              controls
              autoplay
              playsinline
              class="w-full h-full object-contain bg-black"
            ></video>
          `
              : `
            <img
              src="${this.activeVideo.thumbnailUrl || LECTURE_COVER_PATH}"
              alt="${this.escapeHtml(this.activeVideo.title)}"
              referrerpolicy="no-referrer"
              class="absolute inset-0 w-full h-full object-cover pointer-events-none ${
                this.isPlaying ? 'opacity-0' : 'opacity-30'
              }"
            />
            <canvas
              id="privacy-video-canvas"
              width="1280"
              height="720"
              data-action="vid-toggle-play"
              class="relative z-10 w-full h-full block cursor-pointer"
            ></canvas>
          `
          }

          <div class="privacy-watermark absolute bottom-16 right-4 z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-[10px] font-mono-tabular text-white/80">
            prepskm.in · ${this.escapeHtml(userName)} (${this.escapeHtml(
              userEmail || 'Student'
            )})
          </div>

          <!-- Transport Controls -->
          <div class="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-3 pointer-events-none">
            <button
              type="button"
              data-action="vid-rewind"
              class="pointer-events-auto min-h-[38px] px-3 py-1 rounded-full bg-white/90 text-slate-900 text-xs font-mono-tabular font-extrabold shadow"
            >
              -10s
            </button>
            <button
              type="button"
              data-action="vid-toggle-play"
              class="pointer-events-auto w-12 h-12 rounded-full bg-[#4F46E5] hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg font-bold"
            >
              ${this.isPlaying ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              data-action="vid-forward"
              class="pointer-events-auto min-h-[38px] px-3 py-1 rounded-full bg-white/90 text-slate-900 text-xs font-mono-tabular font-extrabold shadow"
            >
              +10s
            </button>
          </div>
        </div>

        <!-- Scrubber & Channel Attribution Bar -->
        <div class="p-4 rounded-2xl bg-[#FAF6EE] border border-[#E8DFD1] space-y-3">
          <input
            id="privacy-scrubber"
            type="range"
            min="0"
            max="${this.totalDurationSec}"
            value="${Math.floor(this.currentTimeSec)}"
            aria-label="Seek video timeline"
            class="w-full accent-[#4F46E5] cursor-pointer"
          />
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <img
                src="${this.activeVideo.mentorAvatar || MENTOR_AVATAR_PATH}"
                alt="${this.escapeHtml(
                  this.activeVideo.mentorName || 'Sumit Kumar'
                )}"
                referrerpolicy="no-referrer"
                class="w-10 h-10 rounded-full object-cover border border-indigo-200"
              />
              <div>
                <div class="text-xs sm:text-sm font-extrabold text-slate-900">
                  ${this.escapeHtml(
                    this.activeVideo.mentorName || 'Sumit Kumar'
                  )}
                </div>
                <div class="text-[11px] text-slate-600">
                  ${this.escapeHtml(
                    this.activeVideo.mentorRole ||
                      'Master Admin & Lead Physics Mentor'
                  )} · ${videoDoubts.length} Doubts Attached
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span id="privacy-time-label" class="text-xs font-mono-tabular font-bold text-slate-700">
                ${formatDuration(this.currentTimeSec)} / ${
                  this.activeVideo.duration
                }
              </span>
              <button
                type="button"
                data-action="vid-cycle-speed"
                class="min-h-[34px] px-3 py-1 rounded-xl bg-[#FFFDF9] border border-[#E8DFD1] text-xs font-mono-tabular font-bold text-[#4F46E5]"
              >
                ${speed}x
              </button>
            </div>
          </div>
        </div>

        <!-- YouTube-Style Up Next / Suggested Videos Feed Below Player -->
        <div class="space-y-3 pt-2" data-testid="suggested-videos-list">
          <div class="flex items-center justify-between">
            <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
              Suggested Next Lectures (${suggestedVideos.length} Videos)
            </h2>
            <span class="text-xs font-semibold text-[#4F46E5]">Tap any lecture below to play</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${suggestedVideos
              .map(
                (v) => `
              <button
                type="button"
                data-action="select-video"
                data-video-id="${v.id}"
                class="text-left rounded-2xl border border-[#E8DFD1] bg-[#FAF6EE] hover:bg-[#FFFDF9] hover:border-indigo-300 transition-all overflow-hidden flex sm:flex-col gap-3 p-2.5 sm:p-0 shadow-2xs"
              >
                <div class="relative w-36 sm:w-full h-22 sm:h-32 rounded-xl sm:rounded-none overflow-hidden bg-slate-900 shrink-0">
                  <img
                    src="${v.thumbnailUrl || LECTURE_COVER_PATH}"
                    alt="${this.escapeHtml(v.title)}"
                    referrerpolicy="no-referrer"
                    class="w-full h-full object-cover opacity-90"
                  />
                  <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono-tabular">
                    ${v.duration}
                  </span>
                </div>
                <div class="sm:p-3 flex-1 min-w-0 space-y-1">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    ${this.escapeHtml(v.section || 'Strategy Roadmaps')}
                  </span>
                  <div class="text-xs font-extrabold text-slate-900 line-clamp-2">
                    ${this.escapeHtml(v.title)}
                  </div>
                  <div class="text-[11px] font-semibold text-slate-600 truncate">
                    By ${this.escapeHtml(v.mentorName || 'Sumit Kumar')}
                  </div>
                </div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
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
                  Jitsi Meet Live ${mode} Room · Connected with ${this.escapeHtml(
                    mentor.name
                  )}
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
              Mentor <strong>${this.escapeHtml(
                mentor.name
              )}</strong> receives this exact Jitsi room (<code class="font-mono text-[#4F46E5]">${this.escapeHtml(
                roomName
              )}</code>) in the Admin Mentorship Desk.
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
    const t = this.currentTimeSec;
    ctx.clearRect(0, 0, w, h);

    // Rich animated chalkboard background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(0.5, '#1E1B4B');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle moving coordinate grid
    const gridOffset = (t * 24) % 64;
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.11)';
    ctx.lineWidth = 1;
    for (let x = -gridOffset; x < w; x += 64) {
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

    // Header bar
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(
      `● LIVE LECTURE PLAYER · ${(
        this.activeVideo.mentorName || 'SUMIT KUMAR'
      ).toUpperCase()} · ${formatDuration(this.currentTimeSec)}`,
      56,
      64
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.activeVideo.title.slice(0, 58), 56, 114);

    // Animated Physics / Calculus Wave & Vector Diagram on the right side
    const waveBoxX = 760;
    const waveBoxY = 160;
    const waveBoxW = 460;
    const waveBoxH = 380;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 2.5;
    ctx.fillRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);
    ctx.strokeRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);

    ctx.fillStyle = '#A5B4FC';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(
      'LIVE DERIVATION SIMULATION · y(x,t) = A sin(kx - ωt)',
      waveBoxX + 20,
      waveBoxY + 34
    );

    // Draw animated harmonic wave
    ctx.beginPath();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    for (let px = 0; px <= waveBoxW - 40; px += 4) {
      const xCoord = waveBoxX + 20 + px;
      const phase = px * 0.032 - t * 3.2;
      const yCoord =
        waveBoxY +
        195 +
        Math.sin(phase) * 72 * Math.cos(t * 0.4);
      if (px === 0) ctx.moveTo(xCoord, yCoord);
      else ctx.lineTo(xCoord, yCoord);
    }
    ctx.stroke();

    // Orbiting vector particle on chalkboard
    const cx = waveBoxX + 230;
    const cy = waveBoxY + 435;
    ctx.fillStyle = '#F59E0B';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(
      `Instantaneous Phase φ = ${(t * 1.8).toFixed(1)} rad  |  Speed: ${
        SPEED_OPTIONS[this.speedIdx]
      }x`,
      waveBoxX + 20,
      waveBoxY + 350
    );

    // Left Chalkboard Step-by-Step Derivation Cards with Active Highlight
    const activeStepIdx = Math.floor(t / 4) % 3;
    const blocks = [
      {
        label: 'Step 1: Free-Body & Conservation Equations',
        eq: '∑τ_ext = I · α   |   E_total = ½mv² + ½Iω²',
        color: '#4F46E5',
      },
      {
        label: 'Step 2: Boundary Conditions & Integration',
        eq: '∫ E⃗ · dA⃗ = Q_enc / ε₀   |   V(r) = -∫ E⃗ · dr⃗',
        color: '#10B981',
      },
      {
        label: 'Step 3: NTA Rank-Booster Shortcut Formula',
        eq: 'a_cm = g sinθ / (1 + I / mR²)  →  Direct 15-Sec Solve',
        color: '#F59E0B',
      },
    ];

    blocks.forEach((b, idx) => {
      const y = 160 + idx * 130;
      const isHighlighted = idx === activeStepIdx;
      ctx.fillStyle = isHighlighted
        ? 'rgba(79, 70, 229, 0.28)'
        : 'rgba(255, 255, 255, 0.06)';
      ctx.strokeStyle = isHighlighted ? '#38BDF8' : b.color;
      ctx.lineWidth = isHighlighted ? 3.5 : 2;
      ctx.fillRect(56, y, 670, 108);
      ctx.strokeRect(56, y, 670, 108);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(b.label, 80, y + 42);

      ctx.fillStyle = isHighlighted ? '#38BDF8' : '#A5B4FC';
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.fillText(b.eq, 80, y + 82);
    });

    // Bottom Live Progress Bar inside video stream
    const progressRatio = Math.min(
      1,
      Math.max(0, this.currentTimeSec / Math.max(1, this.totalDurationSec))
    );
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(56, h - 42, w - 112, 8);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(56, h - 42, (w - 112) * progressRatio, 8);
    void cx;
    void cy;
  }

  private startPlaybackLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    const step = (now: number) => {
      if (!this.isPlaying) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.lastTick) / 1000));
      this.lastTick = now;
      const speed = SPEED_OPTIONS[this.speedIdx];
      this.currentTimeSec =
        this.currentTimeSec + dt * speed >= this.totalDurationSec
          ? 0
          : this.currentTimeSec + dt * speed;

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

      // Continuously render the animated chalkboard lecture frame!
      this.drawPrivacyStreamFrame();

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

    // Chat Image Input inside 1:1 Mentor Chat
    const chatImageInput = this.containerEl.querySelector<HTMLInputElement>(
      '#mentorship-chat-image-input'
    );
    chatImageInput?.addEventListener('change', () => {
      const file = chatImageInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.pendingChatImageDataUrl = reader.result;
          this.pendingChatImageName = file.name;
          this.callbacks.onShowToast(
            `Image "${file.name}" attached to chat message`
          );
          this.rerender();
        }
      };
      reader.readAsDataURL(file);
    });

    // 1:1 Mentor Chat Form (Supports Text + Image Sharing)
    const chatForm = this.containerEl.querySelector<HTMLFormElement>(
      '#mentorship-chat-form'
    );
    chatForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = chatForm.querySelector<HTMLInputElement>(
        '#mentorship-chat-input'
      );
      const rawText = input?.value.trim() ?? '';
      if (!rawText && !this.pendingChatImageDataUrl) return;
      const text = rawText || `Shared an image (${this.pendingChatImageName})`;

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
        if (this.pendingChatImageDataUrl) {
          await dataStore.sendMentorshipMessage(
            mySession.id,
            text,
            'student',
            undefined,
            {
              imageDataUrl: this.pendingChatImageDataUrl,
            }
          );
        }
      } else {
        await dataStore.sendMentorshipMessage(
          mySession.id,
          text,
          'student',
          undefined,
          {
            imageDataUrl: this.pendingChatImageDataUrl ?? undefined,
          }
        );
      }

      this.pendingChatImageDataUrl = null;
      this.pendingChatImageName = '';
      if (input) input.value = '';
      this.callbacks.onShowToast(`Message sent to ${activeMentor.name}`);
      this.rerender();
    });

    // 1:1 Mentor Appointment Booking Form
    const appointmentForm = this.containerEl.querySelector<HTMLFormElement>(
      '#mentor-appointment-form'
    );
    appointmentForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateInput = appointmentForm.querySelector<HTMLInputElement>(
        '#appointment-date-input'
      );
      const slotSelect = appointmentForm.querySelector<HTMLSelectElement>(
        '#appointment-slot-select'
      );
      const topicInput = appointmentForm.querySelector<HTMLInputElement>(
        '#appointment-topic-input'
      );

      const date = dateInput?.value || new Date().toISOString().slice(0, 10);
      const timeSlot = slotSelect?.value || '07:00 PM - 07:30 PM IST';
      const topic = topicInput?.value.trim() ?? '';
      if (!topic) return;

      const mentors = dataStore.getMentors();
      const activeMentor =
        mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

      await dataStore.bookMentorAppointment({
        mentorId: activeMentor.id,
        dateStr: date,
        timeSlot,
        topic,
      });

      if (topicInput) topicInput.value = '';
      this.callbacks.onShowToast(
        `1:1 Appointment confirmed with ${activeMentor.name} for ${date} (${timeSlot})!`
      );
      this.rerender();
    });

    this.containerEl
      .querySelectorAll<HTMLElement>('[data-action]')
      .forEach((el) => {
        const action = el.dataset.action;
        el.addEventListener('click', async () => {
          switch (action) {
            case 'switch-mentorship-section': {
              const sec = el.dataset.section as 'videos' | 'chat';
              if (sec === 'videos' || sec === 'chat') {
                this.activeMentorshipSection = sec;
                this.rerender();
                this.drawPrivacyStreamFrame();
              }
              break;
            }
            case 'clear-chat-image': {
              this.pendingChatImageDataUrl = null;
              this.pendingChatImageName = '';
              this.rerender();
              break;
            }
            case 'trigger-chat-ai-doubt':
            case 'trigger-chat-ai-file-analysis': {
              const chatInput = this.containerEl?.querySelector<HTMLInputElement>(
                '#mentorship-chat-input'
              );
              const rawMessage =
                chatInput?.value.trim() ||
                (action === 'trigger-chat-ai-file-analysis'
                  ? 'Analyze uploaded test question file, strip option text, and isolate only the option letters (A, B, C, D) with step-by-step derivation.'
                  : 'Explain the fastest conservation of energy and torque approach for pure rolling on an incline.');

              const mentors = dataStore.getMentors();
              const activeMentor =
                mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

              this.isChatAiLoading = true;
              this.rerender();

              const aiResult = await analyzeMentorChatDoubtOrFileWithAI({
                mentorName: activeMentor.name,
                mentorSubject: activeMentor.subjectSpecialty,
                studentMessage: rawMessage,
                fileName: this.pendingChatImageName || undefined,
                imageDataUrl: this.pendingChatImageDataUrl || undefined,
              });

              const isolatedLetters = isolateOptionLettersOnly(
                aiResult.extractedOptionLetters
              );
              this.lastChatAiAnalysisSummary = {
                reply: aiResult.reply,
                extractedOptionLetters: isolatedLetters,
              };
              this.isChatAiLoading = false;

              const sessions = dataStore.getMentorshipSessions();
              let mySession = sessions.find((s) => s.mentorId === activeMentor.id);
              if (!mySession) {
                mySession = await dataStore.createMentorshipRequest({
                  requestType: 'CHAT',
                  initialMessage: rawMessage,
                  mentorId: activeMentor.id,
                  mentorName: activeMentor.name,
                });
              }

              await dataStore.sendMentorshipMessage(
                mySession.id,
                `🤖 [AI Assistant · ${activeMentor.name} Desk]: ${aiResult.reply} [Isolated Option Letters: ${isolatedLetters.join(', ')}]`,
                'admin'
              );

              if (chatInput) chatInput.value = '';
              this.callbacks.onShowToast(
                `🤖 Embedded AI Assistant resolved doubt & isolated options (${isolatedLetters.join(', ')})!`
              );
              this.rerender();
              break;
            }
            case 'open-youtube-player': {
              this.isYoutubeFullScreenMode = true;
              this.rerender();
              this.drawPrivacyStreamFrame();
              break;
            }
            case 'close-youtube-player': {
              this.isYoutubeFullScreenMode = false;
              this.rerender();
              this.drawPrivacyStreamFrame();
              break;
            }
            case 'toggle-mobile-orientation': {
              this.isMobileLandscapeLocked = !this.isMobileLandscapeLocked;
              this.rerender();
              this.drawPrivacyStreamFrame();
              break;
            }
            case 'toggle-mentor-online': {
              const mId = el.dataset.mentorId || this.activeMentorId;
              await dataStore.toggleMentorOnlineStatus(mId);
              const updatedMentor = dataStore
                .getMentors()
                .find((m) => m.id === mId);
              if (updatedMentor) {
                this.callbacks.onShowToast(
                  `${updatedMentor.name} is now ${
                    updatedMentor.isOnline !== false
                      ? 'Active (Calls Enabled)'
                      : 'Offline (Chat Only)'
                  }`
                );
              }
              this.rerender();
              this.drawPrivacyStreamFrame();
              break;
            }
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
              const stage =
                this.containerEl?.querySelector('#privacy-video-stage');
              if (stage && stage.requestFullscreen) {
                void stage.requestFullscreen().catch(() => {});
              } else {
                this.isYoutubeFullScreenMode = true;
                this.rerender();
                this.drawPrivacyStreamFrame();
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
            case 'predownload-lecture-materials': {
              const companionMaterials = selectLectureCompanionMaterials(
                dataStore.getMaterials(),
                this.activeVideo
              );
              await preDownloadMaterialsForOffline(companionMaterials);
              if (companionMaterials[0]) {
                this.activeOfflineReaderRecord =
                  await getOfflineCachedMaterialRecord(companionMaterials[0]);
              }
              this.callbacks.onShowToast(
                `Pre-downloaded & cached ${companionMaterials.length} lecture study materials in Service Worker for offline access!`
              );
              this.rerender();
              this.drawPrivacyStreamFrame();
              break;
            }
            case 'open-offline-material-reader': {
              const matId = el.dataset.materialId;
              const found = dataStore.getMaterials().find((m) => m.id === matId);
              if (found) {
                await preDownloadMaterialsForOffline([found]);
                this.activeOfflineReaderRecord =
                  await getOfflineCachedMaterialRecord(found);
                this.callbacks.onShowToast(
                  `Opened "${found.title}" from Service Worker Offline Cache`
                );
                this.rerender();
                this.drawPrivacyStreamFrame();
              }
              break;
            }
            case 'close-offline-material-reader': {
              this.activeOfflineReaderRecord = null;
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
                this.isPlaying = true;
                this.lastTick = performance.now();
                await this.syncActiveVideoUrlAndRender();
                this.startPlaybackLoop();
              }
              break;
            }
            case 'select-mentor':
            case 'connect-video-mentor': {
              const mId = el.dataset.mentorId;
              if (mId) {
                this.activeMentorId = mId;
                this.activeMentorshipSection = 'chat';
                const mentorObj = dataStore
                  .getMentors()
                  .find((m) => m.id === mId);
                if (mentorObj) {
                  this.callbacks.onShowToast(
                    `Opened 1:1 Chat & Appointment Desk with ${mentorObj.name}`
                  );
                }
                this.rerender();
              }
              break;
            }
            case 'start-jitsi-call': {
              const callType =
                (el.dataset.callType as 'AUDIO' | 'VIDEO') || 'VIDEO';
              const mId = el.dataset.mentorId || this.activeMentorId;
              const mentors = dataStore.getMentors();
              const mentor = mentors.find((m) => m.id === mId) ?? mentors[0];
              this.activeMentorId = mentor.id;

              if (mentor.isOnline === false) {
                this.callbacks.onShowToast(
                  `${mentor.name} is currently Offline. Please use 1:1 Chat or book an Appointment.`
                );
                return;
              }

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
              break;
            }
            case 'close-call-modal': {
              this.activeJitsiModal = null;
              this.rerender();
              break;
            }
          }
        });
      });
  }

  private escapeHtml(str: string | undefined | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
