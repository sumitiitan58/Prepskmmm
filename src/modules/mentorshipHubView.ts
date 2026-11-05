import {
  DEFAULT_PW_LECTURE_FALLBACK,
  LECTURE_COVER_PATH,
  MENTOR_AVATAR_PATH,
} from '../constants';
import { dataStore } from '../services/firebaseService';
import type {
  MentorProfileItem,
  MentorshipMessage,
  VideoRoadmapItem,
} from '../types';
import {
  canStudentInitiateMentorCall,
  formatDuration,
} from '../utils/examLogic';

export interface MentorshipHubCallbacks {
  onShowToast: (message: string) => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

/**
 * PW (Physics Wallah) Style Structured Subject Batch & Chapter Lecture Catalog
 * Organized by Subject Batch -> Chapter -> Lecture / Class Notes / DPP
 */
const PW_BATCH_LECTURES: VideoRoadmapItem[] = [
  DEFAULT_PW_LECTURE_FALLBACK,
  {
    id: 'pw_phy_electro_01',
    title: 'Ch-02: Electrostatics & Gauss Law — L1: Electric Flux & Cavity Problems',
    description:
      'Complete PW-style classroom derivation of Gauss Law, Conductors with Cavity, Earthing of Concentric Shells, and 15 solved JEE/NEET PYQs.',
    duration: '48:15',
    topicTag: 'Physics · Ch-02 Electrostatics · Lecture + Notes + DPP-01',
    section: 'Physics Batch',
    thumbnailUrl: LECTURE_COVER_PATH,
    videoUrl: '',
    isNewRoadmap: false,
    createdAt: '2026-11-04T00:00:00.000Z',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorRole: 'Founder & Lead Physics Educator',
    mentorAvatar: MENTOR_AVATAR_PATH,
  },
  {
    id: 'pw_chem_goc_01',
    title: 'Ch-01: General Organic Chemistry (GOC) — L1: Resonance, Mesomeric & Hyperconjugation',
    description:
      'Structured PW classroom session on Carbocation stability order, SIR effect, Acidity/Basicity comparison, and Kota Class Notes.',
    duration: '52:40',
    topicTag: 'Chemistry · Ch-01 Organic GOC · Lecture + Notes + DPP-01',
    section: 'Chemistry Batch',
    thumbnailUrl: LECTURE_COVER_PATH,
    videoUrl: '',
    isNewRoadmap: false,
    createdAt: '2026-11-04T00:00:00.000Z',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorRole: 'Founder & Senior Educator',
    mentorAvatar: MENTOR_AVATAR_PATH,
  },
  {
    id: 'pw_math_calc_01',
    title: 'Ch-01: Definite Integration & Area — L1: King Property, Leibniz Rule & Limit of Sum',
    description:
      'PW-style JEE classroom lecture covering King & Queen properties, Walli formula, Gamma function shortcuts, and DPP solutions.',
    duration: '55:10',
    topicTag: 'Mathematics · Ch-01 Calculus · Lecture + Notes + DPP-01',
    section: 'Mathematics Batch',
    thumbnailUrl: LECTURE_COVER_PATH,
    videoUrl: '',
    isNewRoadmap: false,
    createdAt: '2026-11-04T00:00:00.000Z',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorRole: 'Founder & Senior Educator',
    mentorAvatar: MENTOR_AVATAR_PATH,
  },
  {
    id: 'pw_bio_genetics_01',
    title: 'Ch-01: Molecular Basis of Inheritance — L1: DNA Replication, Lac Operon & NCERT Line-by-Line',
    description:
      'NEET classroom batch session covering Meselson-Stahl experiment, Transcription, Genetic Code, and NCERT booster DPP.',
    duration: '46:30',
    topicTag: 'Biology · Ch-01 Genetics · Lecture + Notes + DPP-01',
    section: 'Biology Batch',
    thumbnailUrl: LECTURE_COVER_PATH,
    videoUrl: '',
    isNewRoadmap: false,
    createdAt: '2026-11-04T00:00:00.000Z',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorRole: 'Founder & Senior Educator',
    mentorAvatar: MENTOR_AVATAR_PATH,
  },
];

export class MentorshipHubModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: MentorshipHubCallbacks;
  private activeVideo: VideoRoadmapItem;
  private selectedVideoSection = 'ALL';
  private activePwResourceTab: 'LECTURES' | 'NOTES' | 'DPP' = 'LECTURES';
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
    isGroupCall?: boolean;
    scheduledTime?: string;
  } | null = null;

  // Chat "+" Menu & Appointment Composer State
  private isChatPlusMenuOpen = false;
  private isAppointmentFormOpen = false;
  private pendingChatUploadKind: 'IMAGE' | 'VIDEO' | 'FILE' = 'IMAGE';

  private animId: number | null = null;
  private lastTick = 0;

  constructor(callbacks: MentorshipHubCallbacks) {
    this.callbacks = callbacks;
    const allVids = this.getCombinedLecturesCatalog();
    this.activeVideo = allVids[0] ?? DEFAULT_PW_LECTURE_FALLBACK;
    if (this.activeVideo?.mentorId) {
      this.activeMentorId = this.activeVideo.mentorId;
    }
  }

  private getCombinedLecturesCatalog(): VideoRoadmapItem[] {
    const customVids = dataStore.getVideos();
    const seen = new Set(customVids.map((v) => v.id));
    const merged = [...customVids];
    for (const pwVid of PW_BATCH_LECTURES) {
      if (!seen.has(pwVid.id)) {
        merged.push(pwVid);
      }
    }
    return merged;
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const videos = this.getCombinedLecturesCatalog();
    if (!this.activeVideo || !videos.some((v) => v.id === this.activeVideo.id)) {
      this.activeVideo = videos[0] ?? DEFAULT_PW_LECTURE_FALLBACK;
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

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const allVideos = this.getCombinedLecturesCatalog();
    const mentors = dataStore.getMentors();
    const activeMentor =
      mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

    const uniqueSections = Array.from(
      new Set(allVideos.map((v) => v.section || 'Physics Batch'))
    );
    const videoSections = ['ALL', ...uniqueSections];

    const filteredVideos = allVideos.filter((v) => {
      if (this.selectedVideoSection === 'ALL') return true;
      return (v.section || 'Physics Batch') === this.selectedVideoSection;
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
    const isMentorOnline = activeMentor.isOnline !== false;
    const isAdminOrMentor = dataStore.isAuthorizedAdminOrMentor();

    // Strict Call Gate Evaluation: Disabled when mentor is offline unless student has ACCEPTED appointment
    const callGate = canStudentInitiateMentorCall({
      isMentorOnline,
      appointmentStatus: mySession?.appointmentStatus,
      scheduledCallTime: mySession?.scheduledCallTime,
    });

    const groupSchedule = dataStore.getGroupCallSchedule();
    const appointmentStatus = mySession?.appointmentStatus ?? 'NONE';

    this.containerEl.innerHTML = `
      <div class="space-y-6">
        <!-- TOP PROMINENT 1:1 MENTORSHIP BAR (Strict Offline Call Gate + Appointment Status + Multi-Mentor Switcher) -->
        <section
          aria-label="Top 1:1 Mentorship Live Bar"
          data-testid="top-1on1-mentorship-bar"
          class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white border border-indigo-500/30 rounded-3xl p-4 sm:p-6 shadow-md space-y-4"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[11px] font-extrabold uppercase tracking-wider">
                  🎯 1:1 Mentorship Live Connect
                </span>
                <span
                  data-testid="mentor-active-status-pill"
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    isMentorOnline
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                      : 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                  }"
                >
                  <span class="w-2 h-2 rounded-full ${
                    isMentorOnline ? 'bg-[#10B981] animate-ping' : 'bg-amber-400'
                  }"></span>
                  ${
                    isMentorOnline
                      ? `${this.escapeHtml(activeMentor.name)} is ACTIVE — Voice & Video Calls Open`
                      : `${this.escapeHtml(activeMentor.name)} is OFFLINE — Calls Disabled (Take Appointment in Chat)`
                  }
                </span>
                ${
                  appointmentStatus !== 'NONE'
                    ? `
                  <span
                    data-testid="top-appointment-status-badge"
                    class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                      appointmentStatus === 'ACCEPTED'
                        ? 'bg-emerald-500 text-slate-950'
                        : appointmentStatus === 'PENDING'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-rose-500 text-white'
                    }"
                  >
                    ${
                      appointmentStatus === 'ACCEPTED'
                        ? `✅ Appointment Accepted · Call Time: ${this.escapeHtml(mySession?.scheduledCallTime || 'Scheduled')}`
                        : appointmentStatus === 'PENDING'
                          ? `⏳ Appointment Pending Admin Approval (${this.escapeHtml(mySession?.requestedCallTime || 'Requested')})`
                          : '✕ Appointment Declined — Request Another Time'
                    }
                  </span>
                `
                    : ''
                }
              </div>
              <h1 class="text-lg sm:text-2xl font-extrabold tracking-tight">
                1:1 Mentorship Desk (Chat, Voice Call, Video Call & Scheduled Group Calls)
              </h1>
              <p class="text-xs text-slate-300 max-w-2xl">
                ${this.escapeHtml(callGate.reason)} Use the <strong>+</strong> button inside chat to send images, videos, files, or book a 1:1 call appointment.
              </p>
            </div>

            <!-- Action Buttons: Chat, Voice Call (Strictly Disabled when Offline & No Accepted Appointment), Video Call -->
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-action="focus-mentor-chat"
                class="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold transition-colors"
              >
                💬 1:1 Chat (${this.escapeHtml(activeMentor.name.split(' ')[0])})
              </button>
              <button
                type="button"
                data-action="start-jitsi-call"
                data-call-type="AUDIO"
                data-mentor-id="${activeMentor.id}"
                data-testid="launch-jitsi-audio-btn"
                ${!callGate.canCall ? 'disabled data-offline-blocked="true"' : ''}
                class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  callGate.canCall
                    ? 'bg-[#10B981] hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                }"
              >
                ${
                  callGate.canCall
                    ? `📞 Voice Call (${this.escapeHtml(activeMentor.name.split(' ')[0])})`
                    : '🔒 Voice Call Disabled (Mentor Offline)'
                }
              </button>
              <button
                type="button"
                data-action="start-jitsi-call"
                data-call-type="VIDEO"
                data-mentor-id="${activeMentor.id}"
                data-testid="launch-jitsi-video-btn"
                ${!callGate.canCall ? 'disabled data-offline-blocked="true"' : ''}
                class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  callGate.canCall
                    ? 'bg-[#4F46E5] hover:bg-indigo-500 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                }"
              >
                ${
                  callGate.canCall
                    ? `🎥 Video Call (${this.escapeHtml(activeMentor.name.split(' ')[0])})`
                    : '🔒 Video Call Disabled (Mentor Offline)'
                }
              </button>
              ${
                !callGate.canCall
                  ? `
                <button
                  type="button"
                  data-action="open-appointment-in-chat"
                  data-testid="book-appointment-shortcut-btn"
                  class="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-xs"
                >
                  📅 Book Appointment in Chat
                </button>
              `
                  : ''
              }
              ${
                isAdminOrMentor
                  ? `
                <button
                  type="button"
                  data-action="toggle-mentor-online-status"
                  data-mentor-id="${activeMentor.id}"
                  data-testid="toggle-mentor-active-btn"
                  title="Admin Presence Control: Toggle Online/Offline Status"
                  class="min-h-[42px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-mono-tabular font-bold text-indigo-200"
                >
                  ⚡ Admin: Set ${isMentorOnline ? 'Offline' : 'Active'}
                </button>
              `
                  : ''
              }
            </div>
          </div>

          <!-- Mentor Switcher Pills inside Top Bar -->
          <div class="pt-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar" data-testid="top-mentor-switcher">
            <span class="text-[11px] font-bold text-indigo-200 uppercase tracking-wider shrink-0">
              Lead Mentor:
            </span>
            ${mentors
              .map((m) => {
                const isSelected = m.id === activeMentor.id;
                const online = m.isOnline !== false;
                return `
                  <button
                    type="button"
                    data-action="select-mentor"
                    data-mentor-id="${m.id}"
                    class="px-3 py-1.5 rounded-xl border text-left flex items-center gap-2 shrink-0 transition-all ${
                      isSelected
                        ? 'bg-white text-slate-900 border-white font-extrabold shadow-xs'
                        : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                    }"
                  >
                    <span class="w-2 h-2 rounded-full ${
                      online ? 'bg-[#10B981]' : 'bg-amber-400'
                    }"></span>
                    <span class="text-xs font-bold">${this.escapeHtml(m.name)}</span>
                    <span class="text-[10px] ${
                      isSelected ? 'text-[#4F46E5]' : 'text-indigo-200'
                    }">(${this.escapeHtml(m.subjectSpecialty)})</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- ADMIN SCHEDULED MULTI-STUDENT GROUP CALL BANNER -->
        ${
          groupSchedule
            ? `
          <section
            aria-label="Scheduled Multi-Student Group Call"
            data-testid="group-call-schedule-banner"
            class="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  👥 Multi-Student Live Group Session
                </span>
                <span class="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono-tabular text-[11px] font-extrabold" data-testid="group-call-scheduled-time">
                  ⏰ Scheduled Time: ${this.escapeHtml(groupSchedule.scheduledTime)}
                </span>
                <span class="text-[11px] text-emerald-200 font-semibold">
                  Host: ${this.escapeHtml(groupSchedule.mentorName)}
                </span>
              </div>
              <h2 class="text-base sm:text-lg font-extrabold text-white">
                ${this.escapeHtml(groupSchedule.title)}
              </h2>
              <p class="text-xs text-emerald-100">
                Multiple students can join this live session together at the scheduled time.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-action="join-group-call-slot"
                data-testid="join-group-call-btn"
                class="min-h-[42px] px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-500 text-slate-950 text-xs font-extrabold shadow-sm transition-colors"
              >
                👥 Join Live Group Session →
              </button>
              ${
                isAdminOrMentor
                  ? `
                <div class="flex items-center gap-1.5 bg-slate-900/80 border border-white/15 rounded-xl p-1.5">
                  <input
                    id="quick-group-call-time-input"
                    type="text"
                    value="${this.escapeHtml(groupSchedule.scheduledTime)}"
                    placeholder="e.g. Today, 08:30 PM IST"
                    class="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-mono-tabular border border-slate-700 w-40"
                  />
                  <button
                    type="button"
                    data-action="admin-update-group-time"
                    data-testid="admin-update-group-time-btn"
                    class="min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold"
                  >
                    Set Time
                  </button>
                </div>
              `
                  : ''
              }
            </div>
          </section>
        `
            : ''
        }

        <!-- PW (PHYSICS WALLAH) STYLE STRUCTURED CLASSROOM BATCHES: SUBJECT -> CHAPTER -> LECTURES / NOTES / DPP -->
        <section
          aria-label="PW Style Classroom Batch Lectures"
          data-testid="video-sections-directory"
          class="bg-white border border-[#E2E8F0] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] border border-indigo-200 text-[11px] font-extrabold uppercase tracking-wider">
                  🎓 PW-Style Structured Batch Classroom
                </span>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#10B981] border border-emerald-200 text-[11px] font-extrabold">
                  Subject Wise · Chapter Wise · HD Lectures + Notes + DPPs
                </span>
              </div>
              <h2 class="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                ${this.escapeHtml(user.targetExam)} (${this.escapeHtml(user.classYear)}) — Subject & Chapter Classroom
              </h2>
              <p class="text-xs text-slate-500">
                Select your Subject Batch below to access chapter-wise Lectures, Class Notes, and DPPs. Click any lecture to launch full-screen HD playback.
              </p>
            </div>
            <a
              href="/player.html?videoId=${encodeURIComponent(this.activeVideo.id)}&mode=horizontal"
              data-testid="open-dedicated-player-link"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-[#4F46E5] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-auto transition-colors shadow-xs"
            >
              <span>⛶ Open Full-Screen Lecture Player</span>
              <span>→</span>
            </a>
          </div>

          <!-- PW-Style Subject Batch Selector Tabs -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            ${videoSections
              .map((sec) => {
                const count =
                  sec === 'ALL'
                    ? allVideos.length
                    : allVideos.filter(
                        (v) => (v.section || 'Physics Batch') === sec
                      ).length;
                const active = this.selectedVideoSection === sec;
                return `
                  <button
                    type="button"
                    data-action="filter-video-section"
                    data-section="${this.escapeHtml(sec)}"
                    class="p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-indigo-50/90 border-[#4F46E5] ring-2 ring-[#4F46E5]/15'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white'
                    }"
                  >
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-sm">${sec === 'ALL' ? '🎓' : sec.includes('Physics') ? '⚛️' : sec.includes('Chemistry') ? '🧪' : sec.includes('Math') ? '📐' : '🧬'}</span>
                      <span class="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono-tabular text-[10px] font-extrabold text-[#4F46E5]">
                        ${count} Lectures
                      </span>
                    </div>
                    <div class="text-xs font-extrabold text-slate-900 truncate">
                      ${sec === 'ALL' ? 'All Subject Batches' : this.escapeHtml(sec)}
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>

          <!-- PW-Style Resource Sub-Tabs: Lectures | Class Notes | DPPs -->
          <div class="pt-3 border-t border-slate-100 space-y-3" data-testid="section-video-thumbnail-grid">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
                <button
                  type="button"
                  data-action="switch-pw-resource-tab"
                  data-pw-tab="LECTURES"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                    this.activePwResourceTab === 'LECTURES'
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }"
                >
                  ▶️ Lectures (${filteredVideos.length})
                </button>
                <a
                  href="/study.html?section=Hand-written%20Notes"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-extrabold text-slate-600 hover:bg-white hover:text-[#4F46E5] transition-colors"
                >
                  📒 Class Notes PDF
                </a>
                <a
                  href="/study.html?section=DPPs"
                  class="px-3.5 py-1.5 rounded-lg text-xs font-extrabold text-slate-600 hover:bg-white hover:text-[#10B981] transition-colors"
                >
                  📝 Chapter DPPs
                </a>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#4F46E5] text-[11px] font-extrabold">
                📲 Click any lecture card → Plays Full-Screen or Inline
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${filteredVideos
                .map((v) => {
                  const isSelected = v.id === this.activeVideo.id;
                  return `
                  <div
                    data-testid="section-video-card"
                    class="rounded-2xl border overflow-hidden transition-all flex flex-col justify-between group ${
                      isSelected
                        ? 'border-[#4F46E5] ring-2 ring-indigo-500/20 bg-indigo-50/30'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:shadow-md'
                    }"
                  >
                    <!-- Clicking the Video Card Opens Full-Screen Horizontal Player Directly -->
                    <a
                      href="/player.html?videoId=${encodeURIComponent(v.id)}&mode=horizontal"
                      data-testid="video-card-fullscreen-launch"
                      class="block text-left w-full"
                    >
                      <div class="relative h-36 w-full bg-slate-900 overflow-hidden">
                        <img
                          src="${v.thumbnailUrl || LECTURE_COVER_PATH}"
                          alt="${this.escapeHtml(v.title)}"
                          referrerpolicy="no-referrer"
                          class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                        />
                        <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-indigo-600/95 text-white text-[10px] font-extrabold">
                          📁 ${this.escapeHtml(v.section || 'Strategy Roadmaps')}
                        </span>
                        <span class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/90 text-white text-[10px] font-mono-tabular font-bold">
                          ${v.duration}
                        </span>
                        <div class="absolute inset-0 bg-slate-950/25 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                          <span class="px-3 py-1.5 rounded-full bg-indigo-600/95 text-white text-[11px] font-extrabold shadow-lg flex items-center gap-1.5">
                            <span>▶ Full-Screen Horizontal</span>
                          </span>
                        </div>
                      </div>
                      <div class="p-3.5 space-y-1">
                        <div class="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2">
                          ${this.escapeHtml(v.title)}
                        </div>
                        <div class="text-[11px] text-slate-500 line-clamp-1">
                          ${this.escapeHtml(v.topicTag)}
                        </div>
                        <div class="flex items-center gap-1.5 pt-1">
                          <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
                          <span class="text-[11px] font-bold text-slate-700 truncate">
                            By ${this.escapeHtml(v.mentorName || 'Sumit Kumar')}
                          </span>
                        </div>
                      </div>
                    </a>

                    <div class="px-3.5 pb-3 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        data-action="select-video-inline"
                        data-video-id="${v.id}"
                        class="text-[11px] font-bold text-slate-600 hover:text-slate-900"
                      >
                        Preview Inline
                      </button>
                      <a
                        href="/player.html?videoId=${encodeURIComponent(v.id)}&mode=horizontal"
                        class="text-[11px] font-extrabold text-[#4F46E5] hover:underline shrink-0"
                      >
                        ⛶ Open Horizontal Full-Screen →
                      </a>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        </section>

        <!-- Main Grid: Inline Preview + Doubt Attacher (7 cols) & Multi-Mentor 1:1 Chat with "+" Action Menu (5 cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 7 Cols: Media Player + Timestamped Doubt Attacher -->
          <div class="lg:col-span-7 space-y-6">
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

                <div class="flex items-center gap-2">
                  <a
                    href="/player.html?videoId=${encodeURIComponent(this.activeVideo.id)}&mode=horizontal"
                    class="min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1"
                  >
                    <span>⛶ Full-Screen Horizontal Player</span>
                  </a>
                  <button
                    type="button"
                    data-action="connect-video-mentor"
                    data-mentor-id="${this.activeVideo.mentorId || 'mentor_sumit_master'}"
                    class="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-colors"
                  >
                    💬 Talk to ${this.escapeHtml((this.activeVideo.mentorName || 'Sumit').split(' ')[0])} →
                  </button>
                </div>
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
                  🔒 ${isRealVideo ? 'Uploaded Video File' : 'HD Interactive Lecture Stream'} · By ${this.escapeHtml(this.activeVideo.mentorName || 'Sumit Kumar')}
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
                    data-testid="mentorship-play-video-btn"
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
                    <a
                      href="/player.html?videoId=${encodeURIComponent(this.activeVideo.id)}&mode=horizontal"
                      class="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-700 inline-flex items-center"
                      title="Open in Full-Screen Horizontal Player"
                    >
                      ⛶
                    </a>
                  </div>
                </div>
                <p class="text-xs text-slate-600">
                  ${this.escapeHtml(this.activeVideo.description)}
                </p>
              </div>

              <!-- ATTACH DOUBT AT CURRENT TIMESTAMP -->
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
          </div>

          <!-- Right 5 Cols: Upgraded 1:1 Chat Centre with "+" Menu (Send Image, Video, File & Take Appointment) -->
          <div class="lg:col-span-5 space-y-6">
            <section
              aria-label="1:1 Mentorship Connect"
              id="mentor-1on1-chat-panel"
              data-testid="mentor-1on1-chat-panel"
              class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col min-h-[720px]"
            >
              <!-- Specific Mentor Selector Strip -->
              <div class="pb-3 border-b border-slate-100 space-y-2">
                <div class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  Select Specific Mentor to Chat or Book Appointment (${mentors.length} Mentors)
                </div>
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="mentor-selector-strip">
                  ${mentors
                    .map((m) => {
                      const isCurrent = m.id === activeMentor.id;
                      const online = m.isOnline !== false;
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
                        <div class="relative shrink-0">
                          <img
                            src="${m.avatarUrl}"
                            alt="${this.escapeHtml(m.name)}"
                            referrerpolicy="no-referrer"
                            class="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                            online ? 'bg-[#10B981]' : 'bg-amber-400'
                          }"></span>
                        </div>
                        <div>
                          <div class="text-xs font-extrabold text-slate-900 leading-none">${this.escapeHtml(m.name)}</div>
                          <div class="text-[10px] font-semibold ${
                            online ? 'text-[#10B981]' : 'text-amber-600'
                          } mt-0.5">${this.escapeHtml(m.subjectSpecialty)} · ${online ? 'Active' : 'Offline'}</div>
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
                      <span class="w-2.5 h-2.5 rounded-full ${
                        isMentorOnline ? 'bg-[#10B981]' : 'bg-amber-400'
                      }"></span>
                    </div>
                    <p class="text-[11px] text-slate-500">
                      ${this.escapeHtml(activeMentor.role)} · ${this.escapeHtml(activeMentor.qualification)}
                    </p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                  callGate.canCall
                    ? 'bg-emerald-50 text-[#10B981] border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }">
                  ${callGate.canCall ? '🟢 CALLS UNLOCKED' : '🔒 OFFLINE (BOOK IN CHAT)'}
                </span>
              </div>

              <!-- 3-Mode Quick Request Strip (Voice/Video Strictly Disabled When Offline & No Accepted Appointment) -->
              <div class="grid grid-cols-3 gap-2 py-3 border-b border-slate-100">
                <button
                  type="button"
                  data-action="open-appointment-in-chat"
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-indigo-50 text-[#4F46E5] text-xs font-extrabold hover:bg-indigo-100 transition-colors"
                >
                  📅 Take Appointment
                </button>
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="AUDIO"
                  data-mentor-id="${activeMentor.id}"
                  ${!callGate.canCall ? 'disabled data-offline-blocked="true"' : ''}
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    callGate.canCall
                      ? 'bg-emerald-50 text-[#10B981] hover:bg-emerald-100 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                  }"
                >
                  ${callGate.canCall ? '🎙️ Voice Call' : '🔒 Voice (Disabled)'}
                </button>
                <button
                  type="button"
                  data-action="start-jitsi-call"
                  data-call-type="VIDEO"
                  data-mentor-id="${activeMentor.id}"
                  ${!callGate.canCall ? 'disabled data-offline-blocked="true"' : ''}
                  class="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    callGate.canCall
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                  }"
                >
                  ${callGate.canCall ? '📹 Video Call' : '🔒 Video (Disabled)'}
                </button>
              </div>

              <!-- Current Appointment Status Banner Inside Chat -->
              ${
                appointmentStatus !== 'NONE'
                  ? `
                <div
                  data-testid="chat-appointment-status-banner"
                  class="mt-2.5 p-3 rounded-xl border text-xs space-y-1.5 ${
                    appointmentStatus === 'ACCEPTED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : appointmentStatus === 'PENDING'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                  }"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-extrabold uppercase tracking-wider text-[10px]">
                      ${
                        appointmentStatus === 'ACCEPTED'
                          ? '✅ APPOINTMENT ACCEPTED BY ADMIN'
                          : appointmentStatus === 'PENDING'
                            ? '⏳ APPOINTMENT STATUS: PENDING'
                            : '✕ APPOINTMENT REJECTED'
                      }
                    </span>
                    <span class="font-mono-tabular font-bold text-[11px]">
                      ${
                        appointmentStatus === 'ACCEPTED'
                          ? `Call Time: ${this.escapeHtml(mySession?.scheduledCallTime || 'Scheduled')}`
                          : `Pref: ${this.escapeHtml(mySession?.requestedCallTime || 'Flexible')}`
                      }
                    </span>
                  </div>
                  <p class="text-[11px] leading-snug">
                    ${
                      appointmentStatus === 'ACCEPTED'
                        ? `Admin accepted your appointment for ${this.escapeHtml(mySession?.scheduledCallTime || 'now')}. Voice & Video call buttons are now unlocked for you!`
                        : appointmentStatus === 'PENDING'
                          ? `Topic: "${this.escapeHtml(mySession?.appointmentNote || '1:1 Doubt Session')}". Waiting for Admin to Accept & assign a call time.`
                          : `Your previous slot could not be scheduled. Click "+" → Take Appointment to request another time.`
                    }
                  </p>
                  ${
                    isAdminOrMentor && mySession
                      ? `
                    <div class="pt-2 border-t border-black/10 flex flex-wrap items-center gap-1.5" data-testid="inline-admin-appointment-controls">
                      <input
                        id="inline-admin-call-time-input"
                        type="text"
                        value="${this.escapeHtml(mySession.scheduledCallTime || mySession.requestedCallTime || 'Today, 07:30 PM IST')}"
                        placeholder="Set Call Time (e.g. 07:30 PM)"
                        class="flex-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-mono-tabular text-slate-900"
                      />
                      <button
                        type="button"
                        data-action="admin-accept-appointment"
                        data-session-id="${mySession.id}"
                        data-testid="inline-admin-accept-appointment-btn"
                        class="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-[11px] font-extrabold"
                      >
                        ✓ Accept & Set Time
                      </button>
                      <button
                        type="button"
                        data-action="admin-reject-appointment"
                        data-session-id="${mySession.id}"
                        data-testid="inline-admin-reject-appointment-btn"
                        class="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-[11px] font-extrabold"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  `
                      : ''
                  }
                </div>
              `
                  : ''
              }

              <!-- Real-time Chat Thread with Rich Attachment & Appointment Cards -->
              <div id="mentorship-chat-scroll" class="flex-1 overflow-y-auto py-4 space-y-3 pr-1 max-h-[360px]">
                ${(mySession?.messages ?? [])
                  .map((m) => this.renderChatMessageBubble(m))
                  .join('')}
              </div>

              <!-- Inline Appointment Booking Form (Opened via "+" -> Take Appointment) -->
              ${
                this.isAppointmentFormOpen
                  ? `
                <form
                  id="chat-appointment-form"
                  data-testid="chat-appointment-form"
                  class="mb-3 p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 space-y-2.5"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-extrabold text-[#4F46E5]">
                      📅 Take 1:1 Call Appointment with ${this.escapeHtml(activeMentor.name)}
                    </span>
                    <button
                      type="button"
                      data-action="close-appointment-form"
                      class="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      ✕
                    </button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      id="appointment-time-input"
                      type="text"
                      required
                      value="Today, 07:30 PM IST"
                      placeholder="Preferred Time (e.g. Today 7:30 PM)"
                      class="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono-tabular text-slate-900"
                    />
                    <input
                      id="appointment-reason-input"
                      type="text"
                      required
                      placeholder="Topic / Doubt (e.g. Rotational Mechanics PYQ)"
                      class="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs text-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="submit-appointment-request-btn"
                    class="w-full min-h-[38px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs"
                  >
                    Send Appointment Request (Sets Status to PENDING) →
                  </button>
                </form>
              `
                  : ''
              }

              <!-- "+" Attachment & Appointment Action Menu Drawer -->
              ${
                this.isChatPlusMenuOpen
                  ? `
                <div
                  data-testid="chat-plus-action-menu"
                  class="mb-3 p-3 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-lg space-y-2"
                >
                  <div class="flex items-center justify-between text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">
                    <span>+ Chat Actions (Send Media or Take Appointment)</span>
                    <button type="button" data-action="toggle-chat-plus-menu" class="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-action="chat-send-media"
                      data-media-kind="IMAGE"
                      data-testid="chat-plus-send-image-btn"
                      class="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-bold transition-colors"
                    >
                      <span class="text-base">📷</span>
                      <div>
                        <div>Send Image</div>
                        <div class="text-[10px] text-slate-300 font-normal">Photo / Doubt Snap</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      data-action="chat-send-media"
                      data-media-kind="VIDEO"
                      data-testid="chat-plus-send-video-btn"
                      class="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-bold transition-colors"
                    >
                      <span class="text-base">🎬</span>
                      <div>
                        <div>Send Video</div>
                        <div class="text-[10px] text-slate-300 font-normal">Short Clip / Screen</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      data-action="chat-send-media"
                      data-media-kind="FILE"
                      data-testid="chat-plus-send-file-btn"
                      class="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-bold transition-colors"
                    >
                      <span class="text-base">📎</span>
                      <div>
                        <div>Send File / PDF</div>
                        <div class="text-[10px] text-slate-300 font-normal">Notes / Worksheet</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      data-action="open-appointment-in-chat"
                      data-testid="chat-plus-take-appointment-btn"
                      class="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-left flex items-center gap-2 text-xs font-extrabold transition-colors"
                    >
                      <span class="text-base">📅</span>
                      <div>
                        <div>Take Appointment</div>
                        <div class="text-[10px] text-slate-800 font-semibold">Request 1:1 Call Time</div>
                      </div>
                    </button>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Hidden File Input for Chat "+" Media Upload -->
              <input
                id="chat-hidden-media-input"
                type="file"
                class="hidden"
              />

              <!-- Send Message Form with "+" Button -->
              <form id="mentorship-chat-form" class="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  data-action="toggle-chat-plus-menu"
                  data-testid="chat-plus-menu-btn"
                  aria-label="Open Chat Attachments and Appointment Menu"
                  title="Send Image, Video, File or Take Appointment"
                  class="w-10 h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-lg font-extrabold flex items-center justify-center shrink-0 transition-colors"
                >
                  +
                </button>
                <input
                  id="mentorship-chat-input"
                  type="text"
                  required
                  placeholder="Message ${this.escapeHtml(activeMentor.name)} or click + for Media/Appointment..."
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

  private renderChatMessageBubble(m: MentorshipMessage): string {
    const isStudent = m.senderRole === 'student';
    const attachmentHtml =
      m.attachmentType === 'IMAGE' && m.attachmentUrl
        ? `
          <div class="mt-2 rounded-xl overflow-hidden border border-white/20 bg-black/10 p-1">
            <img src="${m.attachmentUrl}" alt="${this.escapeHtml(m.attachmentName || 'Image')}" class="max-h-36 rounded-lg object-contain mx-auto" />
            <div class="text-[10px] opacity-80 mt-1 truncate">📷 ${this.escapeHtml(m.attachmentName || 'Image Attachment')}</div>
          </div>
        `
        : m.attachmentType === 'VIDEO'
          ? `
          <div class="mt-2 p-2.5 rounded-xl bg-slate-900/90 text-white flex items-center gap-2 text-[11px]">
            <span>🎬</span>
            <span class="font-bold truncate">${this.escapeHtml(m.attachmentName || 'Video Doubt Clip.mp4')}</span>
          </div>
        `
          : m.attachmentType === 'FILE'
            ? `
          <div class="mt-2 p-2.5 rounded-xl bg-white/15 border border-current/20 flex items-center gap-2 text-[11px]">
            <span>📎</span>
            <span class="font-bold truncate">${this.escapeHtml(m.attachmentName || 'Study_Document.pdf')}</span>
          </div>
        `
            : m.attachmentType === 'APPOINTMENT'
              ? `
          <div class="mt-2 p-2.5 rounded-xl ${
            m.appointmentStatus === 'ACCEPTED'
              ? 'bg-emerald-500 text-slate-950'
              : m.appointmentStatus === 'REJECTED'
                ? 'bg-rose-500 text-white'
                : 'bg-amber-400 text-slate-950'
          } text-[11px] font-bold space-y-0.5">
            <div>
              ${
                m.appointmentStatus === 'ACCEPTED'
                  ? `✅ APPOINTMENT ACCEPTED · TIME: ${this.escapeHtml(m.scheduledCallTime || '')}`
                  : m.appointmentStatus === 'REJECTED'
                    ? '✕ APPOINTMENT DECLINED'
                    : '⏳ APPOINTMENT STATUS: PENDING'
              }
            </div>
            ${
              m.requestedCallTime
                ? `<div class="text-[10px] opacity-90">Requested Slot: ${this.escapeHtml(m.requestedCallTime)}</div>`
                : ''
            }
          </div>
        `
              : '';

    return `
      <div class="flex flex-col ${isStudent ? 'items-end' : 'items-start'}">
        <div class="max-w-[88%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
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
          ${attachmentHtml}
        </div>
      </div>
    `;
  }

  private renderJitsiCallModal(): string {
    if (!this.activeJitsiModal) return '';
    const { mode, roomName, mentor, isGroupCall, scheduledTime } =
      this.activeJitsiModal;
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
        aria-label="Jitsi Meet Live Call Room"
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
                  ${
                    isGroupCall
                      ? `👥 Multi-Student Group Call (${this.escapeHtml(scheduledTime || 'Live Slot')}) · Host: ${this.escapeHtml(mentor.name)}`
                      : `Jitsi Meet Live ${mode} Room · Connected with ${this.escapeHtml(mentor.name)}`
                  }
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
              title="Jitsi Meet Mentorship Call"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              class="w-full h-full border-0"
            ></iframe>
          </div>

          <div class="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Mentor <strong>${this.escapeHtml(mentor.name)}</strong> & joined aspirants share this exact Jitsi room (<code class="font-mono text-[#4F46E5]">${this.escapeHtml(roomName)}</code>).
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

    const progressRatio = Math.min(
      1,
      Math.max(0, this.currentTimeSec / Math.max(1, this.totalDurationSec))
    );
    ctx.fillStyle = 'rgba(79, 70, 229, 0.35)';
    ctx.fillRect(64, 595, 1140, 26);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(64, 595, Math.max(18, 1140 * progressRatio), 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(
      `${this.isPlaying ? '▶ PLAYING LIVE LECTURE' : '❚❚ PAUSED'} · ${formatDuration(this.currentTimeSec)} / ${this.activeVideo.duration}`,
      80,
      614
    );
  }

  private startPlaybackLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
    }
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
      this.drawPrivacyStreamFrame();

      this.animId = requestAnimationFrame(step);
    };
    this.animId = requestAnimationFrame(step);
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    const playerWrapper = this.containerEl.querySelector(
      '#privacy-player-wrapper'
    );
    playerWrapper?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.callbacks.onShowToast(
        'Right-click & direct video downloads are disabled on prepskm.in'
      );
    });

    const canvasEl = this.containerEl.querySelector<HTMLCanvasElement>(
      '#privacy-video-canvas'
    );
    canvasEl?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) {
        this.lastTick = performance.now();
        this.startPlaybackLoop();
      } else if (this.animId !== null) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this.rerender();
      this.drawPrivacyStreamFrame();
    });

    const realVideoEl = this.containerEl.querySelector<HTMLVideoElement>(
      '#real-html5-video-player'
    );
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

    // Chat "+" Hidden Media Input
    const chatMediaInput = this.containerEl.querySelector<HTMLInputElement>(
      '#chat-hidden-media-input'
    );
    chatMediaInput?.addEventListener('change', () => {
      const file = chatMediaInput.files?.[0];
      if (!file) return;
      const mentors = dataStore.getMentors();
      const activeMentor =
        mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl =
          typeof reader.result === 'string' ? reader.result : LECTURE_COVER_PATH;
        await dataStore.sendMentorshipAttachment({
          mentorId: activeMentor.id,
          mentorName: activeMentor.name,
          attachmentType: this.pendingChatUploadKind,
          attachmentName: file.name,
          attachmentUrl: dataUrl,
          caption: `Sent ${this.pendingChatUploadKind.toLowerCase()}: ${file.name}`,
        });
        this.isChatPlusMenuOpen = false;
        this.callbacks.onShowToast(
          `${this.pendingChatUploadKind} "${file.name}" sent to ${activeMentor.name} & saved to Firebase!`
        );
        this.rerender();
        this.drawPrivacyStreamFrame();
      };
      reader.readAsDataURL(file);
    });

    // Appointment Request Form Submission
    const appointmentForm = this.containerEl.querySelector<HTMLFormElement>(
      '#chat-appointment-form'
    );
    appointmentForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const timeInput = appointmentForm.querySelector<HTMLInputElement>(
        '#appointment-time-input'
      );
      const reasonInput = appointmentForm.querySelector<HTMLInputElement>(
        '#appointment-reason-input'
      );
      const preferredTime =
        timeInput?.value.trim() || 'Today, 07:30 PM IST';
      const reason =
        reasonInput?.value.trim() || '1:1 Strategy & Concept Doubt Session';

      const mentors = dataStore.getMentors();
      const activeMentor =
        mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

      await dataStore.requestMentorshipAppointment({
        mentorId: activeMentor.id,
        mentorName: activeMentor.name,
        preferredTime,
        reason,
      });

      this.isAppointmentFormOpen = false;
      this.isChatPlusMenuOpen = false;
      this.callbacks.onShowToast(
        `Appointment requested for ${preferredTime} — Status is now PENDING Admin approval!`
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
          case 'select-video-inline': {
            const vidId = el.dataset.videoId;
            const found = this.getCombinedLecturesCatalog().find(
              (v) => v.id === vidId
            );
            if (found) {
              this.activeVideo = found;
              if (found.mentorId) {
                this.activeMentorId = found.mentorId;
              }
              this.currentTimeSec = 120;
              this.isPlaying = true;
              this.lastTick = performance.now();
              this.startPlaybackLoop();
              this.callbacks.onShowToast(`Playing "${found.title}" inline`);
              this.rerender();
              this.drawPrivacyStreamFrame();
            }
            break;
          }
          case 'focus-mentor-chat': {
            const chatInput = this.containerEl?.querySelector<HTMLInputElement>(
              '#mentorship-chat-input'
            );
            chatInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            chatInput?.focus();
            break;
          }
          case 'toggle-chat-plus-menu': {
            this.isChatPlusMenuOpen = !this.isChatPlusMenuOpen;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'open-appointment-in-chat': {
            this.isAppointmentFormOpen = true;
            this.isChatPlusMenuOpen = false;
            this.rerender();
            this.drawPrivacyStreamFrame();
            const formEl = this.containerEl?.querySelector('#chat-appointment-form');
            formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
          case 'close-appointment-form': {
            this.isAppointmentFormOpen = false;
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'chat-send-media': {
            const kind =
              (el.dataset.mediaKind as 'IMAGE' | 'VIDEO' | 'FILE') || 'IMAGE';
            this.pendingChatUploadKind = kind;
            const mentors = dataStore.getMentors();
            const activeMentor =
              mentors.find((m) => m.id === this.activeMentorId) ?? mentors[0];

            // Immediately log attachment to chat AND allow optional file picker
            const sampleName =
              kind === 'IMAGE'
                ? 'Doubt_FBD_Diagram.jpg'
                : kind === 'VIDEO'
                  ? 'Concept_Question_Clip.mp4'
                  : 'Chapter_Formula_Sheet.pdf';
            await dataStore.sendMentorshipAttachment({
              mentorId: activeMentor.id,
              mentorName: activeMentor.name,
              attachmentType: kind,
              attachmentName: sampleName,
              attachmentUrl:
                kind === 'IMAGE' ? LECTURE_COVER_PATH : undefined,
              caption: `Shared ${kind.toLowerCase()} in 1:1 Chat (${sampleName})`,
            });
            this.isChatPlusMenuOpen = false;
            this.callbacks.onShowToast(
              `${kind} "${sampleName}" sent in chat & saved to Firebase!`
            );
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'admin-accept-appointment': {
            const sessionId = el.dataset.sessionId;
            if (!sessionId) return;
            const timeInput = this.containerEl?.querySelector<HTMLInputElement>(
              '#inline-admin-call-time-input'
            );
            const scheduledTime =
              timeInput?.value.trim() || 'Today, 07:30 PM IST';
            await dataStore.respondToMentorshipAppointment({
              sessionId,
              decision: 'ACCEPTED',
              scheduledCallTime: scheduledTime,
            });
            this.callbacks.onShowToast(
              `Appointment ACCEPTED for ${scheduledTime}! Student can now join the call.`
            );
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'admin-reject-appointment': {
            const sessionId = el.dataset.sessionId;
            if (!sessionId) return;
            await dataStore.respondToMentorshipAppointment({
              sessionId,
              decision: 'REJECTED',
            });
            this.callbacks.onShowToast('Appointment marked as REJECTED.');
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'join-group-call-slot': {
            const updatedSlot = await dataStore.joinGroupCallSchedule();
            const mentors = dataStore.getMentors();
            const hostMentor =
              mentors.find((m) => m.id === updatedSlot?.mentorId) ?? mentors[0];
            if (updatedSlot) {
              this.activeJitsiModal = {
                mode: 'VIDEO',
                roomName: updatedSlot.jitsiRoom,
                mentor: hostMentor,
                isGroupCall: true,
                scheduledTime: updatedSlot.scheduledTime,
              };
              this.callbacks.onShowToast(
                `Joined Multi-Student Group Call (${updatedSlot.scheduledTime})!`
              );
              this.rerender();
              this.drawPrivacyStreamFrame();
            }
            break;
          }
          case 'admin-update-group-time': {
            const timeInput = this.containerEl?.querySelector<HTMLInputElement>(
              '#quick-group-call-time-input'
            );
            const currentSlot = dataStore.getGroupCallSchedule();
            const nextTime =
              timeInput?.value.trim() || 'Today, 08:30 PM IST';
            await dataStore.saveGroupCallSchedule({
              title:
                currentSlot?.title ||
                'Live Multi-Student Doubt Clearing & Rank Strategy Group Call',
              scheduledTime: nextTime,
            });
            this.callbacks.onShowToast(
              `Group Call Time updated to "${nextTime}" in Firebase!`
            );
            this.rerender();
            this.drawPrivacyStreamFrame();
            break;
          }
          case 'toggle-mentor-online-status': {
            const mId = el.dataset.mentorId || this.activeMentorId;
            const updated = await dataStore.toggleMentorOnlineStatus(mId);
            if (updated) {
              this.callbacks.onShowToast(
                `${updated.name} is now ${
                  updated.isOnline
                    ? '🟢 ACTIVE (Voice & Video Calls Unlocked!)'
                    : '⚪ OFFLINE (Calls Disabled — Book Appointment in Chat)'
                }`
              );
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
          case 'start-jitsi-call': {
            const callType =
              (el.dataset.callType as 'AUDIO' | 'VIDEO') || 'VIDEO';
            const mId = el.dataset.mentorId || this.activeMentorId;
            const mentors = dataStore.getMentors();
            const mentor = mentors.find((m) => m.id === mId) ?? mentors[0];
            this.activeMentorId = mentor.id;

            const sessions = dataStore.getMentorshipSessions();
            const mySession = sessions.find((s) => s.mentorId === mentor.id);
            const gate = canStudentInitiateMentorCall({
              isMentorOnline: mentor.isOnline !== false,
              appointmentStatus: mySession?.appointmentStatus,
              scheduledCallTime: mySession?.scheduledCallTime,
            });

            if (!gate.canCall) {
              this.callbacks.onShowToast(`🔒 ${gate.reason}`);
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

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
