import { DEFAULT_BRAND_LOGO_SVG, LECTURE_COVER_PATH } from '../constants';
import {
  dataStore,
  MASTER_ADMIN_EMAIL,
  uploadDataUrlToStorage,
  uploadFileToStorage,
} from '../services/firebaseService';
import type { SubjectName } from '../types';

export interface AdminCommandCallbacks {
  onShowToast: (message: string) => void;
  onAuthUpdated: () => void;
}

type AdminTabId =
  | 'workbench'
  | 'videos'
  | 'mentors_broadcast'
  | 'theme_brand'
  | 'structure'
  | 'materials'
  | 'mentorship';

export class AdminCommandModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: AdminCommandCallbacks;
  private activeAdminTab: AdminTabId = 'workbench';

  // Dual-Crop Workbench State
  private selectedClassId = 'cls_11';
  private selectedSubjectId = 'sub_phy_11';
  private selectedChapterId = 'ch_rotational';
  private questionType: 'MCQ' | 'NUMERICAL' | 'MULTI_MCQ' = 'MCQ';
  private singleMcqAnswer = '0';
  private numericalAnswer = '4.9';
  private multiMcqAnswers: Set<string> = new Set(['A', 'C']);
  private questionPromptText =
    'A uniform cylinder of mass M and radius R rolls without slipping on a rough inclined plane of angle θ.';
  private uploadedSheetImage: HTMLImageElement | null = null;

  // Normalized crop rectangles [xPct, yPct, wPct, hPct]
  private cropBox1 = { x: 4, y: 10, w: 92, h: 36 }; // Question + Options
  private cropBox2 = { x: 4, y: 53, w: 92, h: 40 }; // Step-by-step Solution
  private dragState: {
    target: 'box1-move' | 'box1-resize' | 'box2-move' | 'box2-resize';
    startX: number;
    startY: number;
    origBox: { x: number; y: number; w: number; h: number };
  } | null = null;
  private savedCountInSession = 0;

  // Video Lecture Real File Uploader State
  private pendingVideoFile: File | null = null;
  private pendingVideoObjectUrl: string | null = null;
  private pendingVideoThumbDataUrl: string | null = null;

  // PDF Real File Uploader State
  private pendingPdfFile: File | null = null;
  private pendingPdfDataUrl: string | null = null;

  // Custom Logo Uploader State
  private pendingCustomLogoDataUrl: string | null = null;

  // Jitsi Call Modal in Admin Mentorship Desk
  private activeAdminJitsiRoom: { roomName: string; studentName: string } | null =
    null;

  constructor(callbacks: AdminCommandCallbacks) {
    this.callbacks = callbacks;
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    this.rerender();
  }

  public rerender(): void {
    if (!this.containerEl) return;

    const isAuthorized = dataStore.isAuthorizedAdminOrMentor();
    if (!isAuthorized) {
      this.containerEl.innerHTML = this.renderAdminAuthGate();
      this.bindGateEvents();
      return;
    }

    const user = dataStore.getUser();
    const isMaster = dataStore.isMasterAdmin();

    const tabs: { id: AdminTabId; label: string }[] = [
      { id: 'workbench', label: '1. Dual-Crop Workbench' },
      { id: 'videos', label: '2. Video Lecture Uploader' },
      { id: 'mentors_broadcast', label: '3. Mentors & Broadcast' },
      { id: 'theme_brand', label: '4. Theme & Logo Customizer' },
      { id: 'materials', label: '5. PDF Vault Uploader' },
      { id: 'structure', label: '6. Classes & Chapters' },
      { id: 'mentorship', label: '7. Jitsi Mentorship Desk' },
    ];

    this.containerEl.innerHTML = `
      <div class="space-y-6">
        <!-- Admin & Mentor Top Command Banner -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#10B981] text-xs font-extrabold">
                  ✓ ${isMaster ? `Master Admin: ${MASTER_ADMIN_EMAIL}` : `Authorized Mentor: ${this.escapeHtml(user.email)}`}
                </span>
                <span class="px-2.5 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] text-xs font-bold">
                  🔒 Hidden from Student Navigation
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">
                prepskm.in Admin & Mentor Studio
              </h1>
            </div>

            <div class="text-xs font-mono-tabular text-slate-500">
              Questions: <strong>${dataStore.getAdminQuestions().length}</strong> · Videos: <strong>${dataStore.getVideos().length}</strong> · Mentors: <strong>${dataStore.getMentors().length}</strong>
            </div>
          </div>

          <!-- 7 Admin Sub-Module Tabs -->
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Admin Modules">
            ${tabs
              .map(
                (tab) => `
              <button
                type="button"
                role="tab"
                aria-selected="${this.activeAdminTab === tab.id}"
                data-action="switch-admin-tab"
                data-tab="${tab.id}"
                class="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors shrink-0 ${
                  this.activeAdminTab === tab.id
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'bg-[#F8FAFC] border border-[#E2E8F0] text-slate-700 hover:bg-slate-100'
                }"
              >
                ${tab.label}
              </button>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Active Admin Sub-Module Content -->
        ${
          this.activeAdminTab === 'workbench'
            ? this.renderDualCropWorkbench()
            : this.activeAdminTab === 'videos'
              ? this.renderVideoLectureUploader()
              : this.activeAdminTab === 'mentors_broadcast'
                ? this.renderMentorsAndBroadcastManager()
                : this.activeAdminTab === 'theme_brand'
                  ? this.renderThemeAndLogoCustomizer()
                  : this.activeAdminTab === 'structure'
                    ? this.renderStructureManager()
                    : this.activeAdminTab === 'materials'
                      ? this.renderMaterialUploader()
                      : this.renderMentorshipDesk()
        }

        ${this.renderAdminJitsiModal()}
      </div>
    `;

    this.bindEvents();
    if (this.activeAdminTab === 'workbench') {
      this.drawDualCropCanvases();
      this.bindInteractiveCanvasCropEvents();
    }
  }

  private renderAdminAuthGate(): string {
    const user = dataStore.getUser();
    const mentors = dataStore.getMentors();

    return `
      <div class="max-w-xl mx-auto my-8">
        <section
          aria-label="Master Admin and Mentor Authentication Gate"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-md text-center space-y-5"
        >
          <div class="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-[#EF4444] flex items-center justify-center mx-auto text-2xl font-bold">
            🔒
          </div>
          <div class="space-y-1.5">
            <span class="text-xs font-bold uppercase tracking-wider text-[#EF4444]">
              Restricted Admin & Mentor Studio (Hidden from Students)
            </span>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900">
              Master Admin or Authorized Mentor Access Required
            </h1>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              This portal is strictly invisible to normal students. Sign in as Master Admin (<strong class="font-mono text-slate-900">${MASTER_ADMIN_EMAIL}</strong>) or an authorized Co-Admin/Mentor to manage questions, videos, broadcasts, and site theme.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-600">
            Current Session: <strong class="text-slate-900">${this.escapeHtml(user.name)}</strong> (<span class="font-mono">${this.escapeHtml(user.email)}</span>)
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              id="admin-activate-master-btn"
              class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors"
            >
              Authenticate as ${MASTER_ADMIN_EMAIL} →
            </button>
            <button
              type="button"
              id="admin-google-oauth-btn"
              class="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 text-xs font-semibold transition-colors"
            >
              Sign In with Google Popup
            </button>
          </div>

          <div class="pt-3 border-t border-slate-100 space-y-2">
            <div class="text-[11px] font-bold text-slate-500">Or Sign In as Authorized Video Mentor:</div>
            <div class="flex flex-wrap justify-center gap-2">
              ${mentors
                .filter((m) => m.id !== 'mentor_sumit_master')
                .map(
                  (m) => `
                <button
                  type="button"
                  data-mentor-gate-email="${this.escapeHtml(m.email)}"
                  class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#10B981] text-xs font-bold"
                >
                  ${this.escapeHtml(m.name)} (${this.escapeHtml(m.subjectSpecialty)})
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private renderDualCropWorkbench(): string {
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects(this.selectedClassId);
    const adminQuestions = dataStore.getAdminQuestions();

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 7 Cols: Interactive Drag-and-Resize Dual-Crop Canvas Workbench -->
        <section
          aria-label="Dual-Crop Image Canvas"
          class="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Interactive Drag & Resize Dual-Box Engine · Question + Solution
              </span>
              <h2 class="text-lg font-bold text-slate-900 mt-0.5">
                Drag or Resize Crop Box 1 & Crop Box 2 Directly on Canvas
              </h2>
            </div>

            <div class="flex items-center gap-2">
              <label
                for="admin-crop-file-input"
                class="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer inline-flex items-center"
              >
                Upload Exam Sheet Image
              </label>
              <input
                id="admin-crop-file-input"
                type="file"
                accept="image/*"
                class="hidden"
              />
              <button
                type="button"
                data-action="reset-crop-boxes"
                class="min-h-[38px] px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-semibold text-slate-700"
              >
                Reset Crop Boxes
              </button>
            </div>
          </div>

          <div class="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-slate-700 flex items-center justify-between">
            <span>💡 <strong>Interactive Canvas:</strong> Drag inside Box 1 (Indigo) or Box 2 (Emerald) to move, or drag the bottom-right corner handle <code class="font-mono font-bold">↘</code> to resize!</span>
          </div>

          <!-- Source Exam Sheet Canvas with Interactive Pointer Drag/Resize -->
          <div class="rounded-xl overflow-hidden border border-[#E2E8F0] bg-slate-900 p-2">
            <canvas
              id="admin-source-sheet-canvas"
              width="860"
              height="520"
              class="w-full h-auto block rounded-lg bg-white cursor-move touch-none"
            ></canvas>
          </div>

          <!-- Dual Crop Box Precision Controls & Live Previews -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Crop Box 1 Controls -->
            <div class="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[#4F46E5]">
                  Crop Box 1: Question + Options
                </span>
                <span id="crop1-coords-label" class="text-[11px] font-mono-tabular text-slate-600">
                  X:${this.cropBox1.x}% Y:${this.cropBox1.y}% W:${this.cropBox1.w}% H:${this.cropBox1.h}%
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="text-[11px] text-slate-600">
                  Top Y (${this.cropBox1.y}%)
                  <input
                    type="range"
                    min="2"
                    max="60"
                    value="${this.cropBox1.y}"
                    data-crop-slider="b1-y"
                    class="w-full accent-[#4F46E5]"
                  />
                </label>
                <label class="text-[11px] text-slate-600">
                  Height H (${this.cropBox1.h}%)
                  <input
                    type="range"
                    min="15"
                    max="65"
                    value="${this.cropBox1.h}"
                    data-crop-slider="b1-h"
                    class="w-full accent-[#4F46E5]"
                  />
                </label>
              </div>
              <canvas
                id="admin-crop1-preview"
                width="420"
                height="130"
                class="w-full h-auto rounded-lg border border-indigo-200 bg-white"
              ></canvas>
            </div>

            <!-- Crop Box 2 Controls -->
            <div class="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[#10B981]">
                  Crop Box 2: Step-by-Step Solution
                </span>
                <span id="crop2-coords-label" class="text-[11px] font-mono-tabular text-slate-600">
                  X:${this.cropBox2.x}% Y:${this.cropBox2.y}% W:${this.cropBox2.w}% H:${this.cropBox2.h}%
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="text-[11px] text-slate-600">
                  Top Y (${this.cropBox2.y}%)
                  <input
                    type="range"
                    min="30"
                    max="82"
                    value="${this.cropBox2.y}"
                    data-crop-slider="b2-y"
                    class="w-full accent-[#10B981]"
                  />
                </label>
                <label class="text-[11px] text-slate-600">
                  Height H (${this.cropBox2.h}%)
                  <input
                    type="range"
                    min="15"
                    max="60"
                    value="${this.cropBox2.h}"
                    data-crop-slider="b2-h"
                    class="w-full accent-[#10B981]"
                  />
                </label>
              </div>
              <canvas
                id="admin-crop2-preview"
                width="420"
                height="130"
                class="w-full h-auto rounded-lg border border-emerald-200 bg-white"
              ></canvas>
            </div>
          </div>
        </section>

        <!-- Right 5 Cols: Simplified Taxonomy (Only Title, Class & Subject — No Chapter!) & Save Flow -->
        <section
          aria-label="Question Metadata and Save Form"
          class="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
        >
          <div class="pb-3 border-b border-slate-100">
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#10B981]">
              Simplified Upload · Only Title, Class & Subject Required
            </span>
            <h2 class="text-base font-bold text-slate-900 mt-0.5">
              Save Cropped Question + Solution to Firebase
            </h2>
            <p class="text-xs text-slate-500">
              Extracts Crop 1 (Question) & Crop 2 (Solution) and syncs directly to Firebase Firestore for all students and admins.
            </p>
          </div>

          <form id="admin-save-question-form" class="space-y-4">
            <div>
              <label for="wb-prompt-input" class="block text-xs font-bold text-slate-700 mb-1">
                1. Question Title / Prompt Caption (No Chapter Needed)
              </label>
              <input
                id="wb-prompt-input"
                type="text"
                required
                value="${this.escapeHtml(this.questionPromptText)}"
                placeholder="e.g., Solid Cylinder Pure Rolling on Inclined Plane PYQ"
                class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-900"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">2. Select Class / Cohort</label>
                <select
                  id="wb-class-select"
                  class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${classes
                    .map(
                      (c) =>
                        `<option value="${c.id}" ${this.selectedClassId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">3. Select Subject</label>
                <select
                  id="wb-subject-select"
                  class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${subjects
                    .map(
                      (s) =>
                        `<option value="${s.id}" ${this.selectedSubjectId === s.id ? 'selected' : ''}>${this.escapeHtml(s.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-700">Question Type</label>
              <div class="grid grid-cols-3 gap-2">
                ${(
                  [
                    { id: 'MCQ', label: 'Single MCQ' },
                    { id: 'NUMERICAL', label: 'Numerical Value' },
                    { id: 'MULTI_MCQ', label: 'Multiple MCQ' },
                  ] as const
                )
                  .map(
                    (qt) => `
                  <button
                    type="button"
                    data-action="wb-select-qtype"
                    data-qtype="${qt.id}"
                    class="min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                      this.questionType === qt.id
                        ? 'bg-[#4F46E5] border-[#4F46E5] text-white'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700'
                    }"
                  >
                    ${qt.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            ${
              this.questionType === 'MCQ'
                ? `
              <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div class="text-xs font-bold text-slate-700">Select Correct Single Option</div>
                <div class="grid grid-cols-4 gap-2">
                  ${['A', 'B', 'C', 'D']
                    .map((opt, idx) => {
                      const active = this.singleMcqAnswer === String(idx);
                      return `
                      <button
                        type="button"
                        data-action="wb-select-single-opt"
                        data-opt="${idx}"
                        class="min-h-[40px] rounded-xl border font-mono-tabular text-xs font-bold ${
                          active
                            ? 'bg-[#10B981] border-[#10B981] text-white'
                            : 'bg-white border-[#E2E8F0] text-slate-700'
                        }"
                      >
                        Option ${opt}
                      </button>
                    `;
                    })
                    .join('')}
                </div>
              </div>
            `
                : this.questionType === 'NUMERICAL'
                  ? `
              <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <label for="wb-numerical-val" class="block text-xs font-bold text-slate-700">
                  Exact Numerical Answer (or Decimal Value)
                </label>
                <input
                  id="wb-numerical-val"
                  type="text"
                  value="${this.escapeHtml(this.numericalAnswer)}"
                  placeholder="e.g. 4.9"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] font-mono-tabular text-sm font-bold text-slate-900"
                />
              </div>
            `
                  : `
              <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div class="text-xs font-bold text-slate-700">Select All Correct Options (Multiple MCQ)</div>
                <div class="grid grid-cols-4 gap-2">
                  ${['A', 'B', 'C', 'D']
                    .map((opt) => {
                      const checked = this.multiMcqAnswers.has(opt);
                      return `
                      <button
                        type="button"
                        data-action="wb-toggle-multi-opt"
                        data-opt="${opt}"
                        class="min-h-[40px] rounded-xl border font-mono-tabular text-xs font-bold ${
                          checked
                            ? 'bg-[#10B981] border-[#10B981] text-white'
                            : 'bg-white border-[#E2E8F0] text-slate-700'
                        }"
                      >
                        ${checked ? '✓ ' : ''}${opt}
                      </button>
                    `;
                    })
                    .join('')}
                </div>
              </div>
            `
            }

            <button
              type="submit"
              data-testid="wb-save-next-btn"
              class="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors"
            >
              Save Cropped Question & Prepare Next →
            </button>
          </form>

          <div class="pt-3 border-t border-slate-100 space-y-2">
            <div class="text-xs font-bold text-slate-700">
              Recently Uploaded Cropped Questions & Solutions (${adminQuestions.length})
            </div>
            <div class="space-y-2.5 max-h-60 overflow-y-auto">
              ${
                adminQuestions.length === 0
                  ? `<div class="text-xs text-slate-400">Click "Save Cropped Question & Prepare Next" to upload your first cropped question & solution.</div>`
                  : adminQuestions
                      .map(
                        (aq) => `
                      <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs" data-testid="uploaded-cropped-question-item">
                        <div class="flex items-center justify-between gap-2">
                          <div class="truncate">
                            <span class="font-bold text-[#4F46E5]">[${aq.type} · ${this.escapeHtml(aq.subjectName)}]</span>
                            <span class="font-semibold text-slate-800"> ${this.escapeHtml(aq.prompt)}</span>
                            <span class="text-slate-500"> · Key: ${this.escapeHtml(aq.correctVal)}</span>
                          </div>
                          <button
                            type="button"
                            data-action="delete-admin-q"
                            data-qid="${aq.id}"
                            class="text-[#EF4444] font-bold px-2"
                          >
                            ✕
                          </button>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          ${
                            aq.questionImg
                              ? `<div class="rounded-lg border border-indigo-200 bg-white p-1">
                                  <span class="block text-[9px] font-bold text-[#4F46E5]">CROP 1: QUESTION</span>
                                  <img src="${aq.questionImg}" alt="Cropped Question" class="h-12 w-full object-contain" />
                                </div>`
                              : ''
                          }
                          ${
                            aq.solutionImg
                              ? `<div class="rounded-lg border border-emerald-200 bg-white p-1">
                                  <span class="block text-[9px] font-bold text-[#10B981]">CROP 2: SOLUTION</span>
                                  <img src="${aq.solutionImg}" alt="Cropped Solution" class="h-12 w-full object-contain" />
                                </div>`
                              : ''
                          }
                        </div>
                      </div>
                    `
                      )
                      .join('')
              }
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private renderVideoLectureUploader(): string {
    const videos = dataStore.getVideos();
    const mentors = dataStore.getMentors();
    const doubts = dataStore.getVideoDoubts();
    const user = dataStore.getUser();
    const matchedMentor = dataStore.getMentorByEmail(user.email) ?? mentors[0];

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 5 Cols: Real File Video Lecture Uploader -->
        <section class="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
              Real Video File + Custom Thumbnail + Section + Mentor Attribution
            </span>
            <h2 class="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
              Upload Video Lecture to Mentorship Hub
            </h2>
          </div>

          <form id="admin-upload-video-form" class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Lecture Title</label>
              <input
                id="vid-upload-title"
                type="text"
                required
                placeholder="e.g., Rotational Mechanics: IAOR & Rolling Friction PYQs"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Target Video Section (Folder)</label>
                <select
                  id="vid-upload-section"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
                >
                  ${dataStore
                    .getVideoSections()
                    .map(
                      (sec) =>
                        `<option value="${this.escapeHtml(sec)}">${this.escapeHtml(sec)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Or Create New Video Section</label>
                <input
                  id="vid-upload-custom-section"
                  type="text"
                  placeholder="e.g., Class 10 & 11 Foundation"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Uploading Mentor (Shown on Video)</label>
              <select
                id="vid-upload-mentor"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
              >
                ${mentors
                  .map(
                    (m) =>
                      `<option value="${m.id}" ${m.id === matchedMentor.id ? 'selected' : ''}>${this.escapeHtml(m.name)} (${this.escapeHtml(m.subjectSpecialty)})</option>`
                  )
                  .join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Topic Tag</label>
                <input
                  id="vid-upload-tag"
                  type="text"
                  placeholder="e.g., JEE & NEET 2027 · High Yield"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Duration (MM:SS)</label>
                <input
                  id="vid-upload-duration"
                  type="text"
                  value="28:45"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono-tabular"
                />
              </div>
            </div>

            <!-- Real Video File Input & Custom Thumbnail Image Input -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1.5">
                <label for="vid-file-input" class="block text-xs font-extrabold text-[#4F46E5] cursor-pointer">
                  1. Select Real Video File (.mp4/.webm)
                </label>
                <input
                  id="vid-file-input"
                  type="file"
                  accept="video/*"
                  class="text-[11px] text-slate-600 w-full"
                />
                <div class="text-[10px] text-slate-500">
                  ${this.pendingVideoFile ? `Selected: ${this.escapeHtml(this.pendingVideoFile.name)}` : 'Or uses built-in DRM stream'}
                </div>
              </div>

              <div class="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                <label for="vid-thumb-input" class="block text-xs font-extrabold text-[#10B981] cursor-pointer">
                  2. Select Thumbnail Image
                </label>
                <input
                  id="vid-thumb-input"
                  type="file"
                  accept="image/*"
                  class="text-[11px] text-slate-600 w-full"
                />
                <div class="text-[10px] text-slate-500">
                  ${this.pendingVideoThumbDataUrl ? 'Custom Thumbnail Ready ✓' : 'Uses default HD cover if empty'}
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Lecture Summary / Description</label>
              <textarea
                id="vid-upload-desc"
                rows="2"
                placeholder="Key formulas, PYQ years covered, and revision instructions..."
                class="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
              ></textarea>
            </div>

            <button
              type="submit"
              data-testid="publish-video-lecture-btn"
              class="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
            >
              Publish Video Lecture with Mentor Attribution →
            </button>
          </form>
        </section>

        <!-- Right 7 Cols: Published Video Lectures & Student Timestamped Doubts Inbox -->
        <div class="lg:col-span-7 space-y-6">
          <section class="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 class="text-base font-extrabold text-slate-900">
              Published Video Lectures (${videos.length})
            </h2>
            <div class="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              ${videos
                .map(
                  (v) => `
                <div class="py-3 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <img
                      src="${v.thumbnailUrl || LECTURE_COVER_PATH}"
                      alt="${this.escapeHtml(v.title)}"
                      referrerpolicy="no-referrer"
                      class="w-16 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div class="min-w-0">
                      <div class="text-xs font-extrabold text-slate-900 truncate">${this.escapeHtml(v.title)}</div>
                      <div class="text-[11px] text-slate-500">
                        Section: <strong class="text-[#4F46E5]">${this.escapeHtml(v.section || 'Strategy Roadmaps')}</strong> · Uploaded by: <strong class="text-[#10B981]">${this.escapeHtml(v.mentorName || 'Sumit Kumar')}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-action="del-video-lecture"
                    data-id="${v.id}"
                    class="min-h-[32px] px-2.5 py-1 rounded-lg bg-red-50 text-[#EF4444] text-xs font-bold shrink-0"
                  >
                    Delete
                  </button>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <!-- Student Timestamped Video Doubts Inbox -->
          <section class="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-extrabold text-slate-900">
                Student Timestamped Video Doubts (${doubts.length})
              </h2>
              <span class="text-xs text-slate-500">Attached directly from Media Player</span>
            </div>

            <div class="space-y-3 max-h-72 overflow-y-auto">
              ${doubts
                .map(
                  (d) => `
                <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="px-2 py-0.5 rounded bg-indigo-100 text-[#4F46E5] font-mono-tabular font-bold">
                        @ ${this.escapeHtml(d.timestampFormatted)}
                      </span>
                      <strong class="ml-1.5 text-slate-900">${this.escapeHtml(d.studentName)}</strong>
                      <span class="text-slate-500"> · ${this.escapeHtml(d.videoTitle || '')}</span>
                    </div>
                    <span class="text-[10px] text-slate-400">${this.escapeHtml(d.createdAt)}</span>
                  </div>
                  <p class="text-slate-700">${this.escapeHtml(d.doubtText)}</p>
                  ${
                    d.mentorReply
                      ? `<div class="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900"><strong>Reply:</strong> ${this.escapeHtml(d.mentorReply)}</div>`
                      : `
                    <form data-doubt-reply-id="${d.id}" class="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Write mentor reply for ${this.escapeHtml(d.studentName)}..."
                        class="flex-1 min-h-[34px] px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs"
                      />
                      <button type="submit" class="px-3 py-1 rounded-lg bg-[#10B981] text-white text-xs font-bold">
                        Reply
                      </button>
                    </form>
                  `
                  }
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  private renderMentorsAndBroadcastManager(): string {
    const mentors = dataStore.getMentors();
    const broadcasts = dataStore.getBroadcasts();

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 6 Cols: Add Co-Admin / Video Mentor -->
        <section class="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#10B981]">
              Multi-Mentor & Co-Admin Directory
            </span>
            <h2 class="text-lg font-extrabold text-slate-900 mt-0.5">
              Add Co-Admin / Video Mentor Email
            </h2>
            <p class="text-xs text-slate-500">
              Added mentors can upload video lectures (with their name shown on the video) and chat/video-call with students 1:1.
            </p>
          </div>

          <form id="admin-add-mentor-form" class="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Mentor Full Name</label>
                <input
                  id="mentor-name-input"
                  type="text"
                  required
                  placeholder="e.g., Prof. Vikramaditya Rao"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Mentor Gmail / Email</label>
                <input
                  id="mentor-email-input"
                  type="email"
                  required
                  placeholder="e.g., vikram.mentor@prepskm.in"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Role</label>
                <select
                  id="mentor-role-select"
                  class="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold"
                >
                  <option value="Co-Admin & Mentor">Co-Admin & Mentor</option>
                  <option value="Video Mentor">Video Mentor</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Subject Specialty</label>
                <input
                  id="mentor-specialty-input"
                  type="text"
                  required
                  placeholder="e.g., Organic Chemistry"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Qualification</label>
                <input
                  id="mentor-qual-input"
                  type="text"
                  required
                  placeholder="e.g., IIT Bombay"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="add-mentor-submit-btn"
              class="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm"
            >
              + Authorize Mentor & Add to Mentorship Hub
            </button>
          </form>

          <div class="divide-y divide-slate-100">
            ${mentors
              .map(
                (m) => `
              <div class="py-3 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    src="${m.avatarUrl}"
                    alt="${this.escapeHtml(m.name)}"
                    referrerpolicy="no-referrer"
                    class="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div class="min-w-0">
                    <div class="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                      <span>${this.escapeHtml(m.name)}</span>
                      <span class="text-[#4F46E5]">(${this.escapeHtml(m.role)})</span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.isOnline !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }">
                        ${m.isOnline !== false ? '🟢 Active for Calls' : '⚪ Offline (Calls Locked)'}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-500 font-mono truncate">
                      ${this.escapeHtml(m.email)} · ${this.escapeHtml(m.subjectSpecialty)}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-action="toggle-mentor-online"
                    data-id="${m.id}"
                    class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                      m.isOnline !== false
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }"
                  >
                    ${m.isOnline !== false ? 'Set Offline' : 'Set Active'}
                  </button>
                  ${
                    m.id === 'mentor_sumit_master'
                      ? `<span class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] text-[10px] font-bold">Owner</span>`
                      : `
                    <button
                      type="button"
                      data-action="del-mentor"
                      data-id="${m.id}"
                      class="px-2.5 py-1 rounded-lg bg-red-50 text-[#EF4444] text-xs font-bold"
                    >
                      Remove
                    </button>
                  `
                  }
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Right 6 Cols: Global Broadcast Message to All Students -->
        <section class="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
              One-Click All-Student Megaphone · Synced via Firestore
            </span>
            <h2 class="text-lg font-extrabold text-slate-900 mt-0.5">
              Broadcast Message to Every Student at Once
            </h2>
            <p class="text-xs text-slate-500">
              Appears immediately on every student's Home Dashboard banner and Notification Bell.
            </p>
          </div>

          <form id="admin-broadcast-form" class="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Broadcast Headline</label>
              <input
                id="bcast-title-input"
                type="text"
                required
                placeholder="e.g., Live Full-Syllabus Mock Test Starts Tonight at 8:00 PM!"
                class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Message Body for All Students</label>
              <textarea
                id="bcast-message-input"
                rows="2"
                required
                placeholder="Write instructions, revision links, or live Jitsi session details for all students..."
                class="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Alert Badge</label>
                <select
                  id="bcast-badge-select"
                  class="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold"
                >
                  <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                  <option value="URGENT">URGENT</option>
                  <option value="LIVE_CLASS">LIVE_CLASS</option>
                  <option value="TEST_ALERT">TEST_ALERT</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Target Cohort</label>
                <select
                  id="bcast-cohort-select"
                  class="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold"
                >
                  <option value="ALL">All Students (JEE, NEET, 9–12, Dropper)</option>
                  <option value="JEE">JEE 2027 Aspirants</option>
                  <option value="NEET">NEET 2027 Aspirants</option>
                  <option value="Dropper">Dropper Batch</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              data-testid="send-broadcast-btn"
              class="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
            >
              📢 Send Global Broadcast to All Students Now
            </button>
          </form>

          <div class="space-y-2.5 max-h-60 overflow-y-auto">
            ${broadcasts
              .map(
                (b) => `
              <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start justify-between gap-2 text-xs">
                <div class="space-y-0.5 min-w-0">
                  <div class="font-extrabold text-slate-900">
                    <span class="text-[#4F46E5]">[${this.escapeHtml(b.badgeType)}]</span> ${this.escapeHtml(b.title)}
                  </div>
                  <p class="text-slate-600 text-[11px]">${this.escapeHtml(b.message)}</p>
                  <div class="text-[10px] text-slate-400 font-mono-tabular">
                    Target: ${this.escapeHtml(b.targetCohort)} · By ${this.escapeHtml(b.senderName)}
                  </div>
                </div>
                <button
                  type="button"
                  data-action="del-broadcast"
                  data-id="${b.id}"
                  class="text-[#EF4444] font-bold px-2"
                >
                  ✕
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  private renderThemeAndLogoCustomizer(): string {
    const theme = dataStore.getSiteTheme();

    const presets = [
      {
        name: 'Electric Indigo & Emerald (Default)',
        primary: '#4F46E5',
        secondary: '#10B981',
        accent: '#F59E0B',
        surface: '#F8FAFC',
      },
      {
        name: 'Royal Violet & Teal Mix',
        primary: '#7C3AED',
        secondary: '#0D9488',
        accent: '#F97316',
        surface: '#FAF8FF',
      },
      {
        name: 'Ocean Blue & Rose Coral Mix',
        primary: '#2563EB',
        secondary: '#059669',
        accent: '#E11D48',
        surface: '#F8FAFC',
      },
    ];

    return `
      <div class="max-w-4xl mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
              Whole-Website Brand & Color Customizer · Synced to Firestore
            </span>
            <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">
              Customize Website Colors, Brand Name & Custom Logo/Icon
            </h2>
          </div>
          <img
            src="${this.pendingCustomLogoDataUrl || theme.logoDataUrl || DEFAULT_BRAND_LOGO_SVG}"
            alt="Current Brand Logo"
            class="w-14 h-14 rounded-2xl object-contain border border-[#E2E8F0] p-1 bg-[#F8FAFC]"
          />
        </div>

        <!-- 1-Click Multi-Color Theme Presets -->
        <div class="space-y-2">
          <div class="text-xs font-bold text-slate-700">Quick Multi-Color Palette Presets</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${presets
              .map(
                (p) => `
              <button
                type="button"
                data-action="apply-theme-preset"
                data-primary="${p.primary}"
                data-secondary="${p.secondary}"
                data-accent="${p.accent}"
                data-surface="${p.surface}"
                class="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white text-left space-y-2 transition-all"
              >
                <div class="flex items-center gap-1.5">
                  <span class="w-5 h-5 rounded-full" style="background:${p.primary}"></span>
                  <span class="w-5 h-5 rounded-full" style="background:${p.secondary}"></span>
                  <span class="w-5 h-5 rounded-full" style="background:${p.accent}"></span>
                </div>
                <div class="text-xs font-bold text-slate-900">${p.name}</div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <form id="admin-theme-customizer-form" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Website Brand Title</label>
              <input
                id="theme-brand-name"
                type="text"
                required
                value="${this.escapeHtml(theme.brandName)}"
                class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label for="theme-logo-file" class="block text-xs font-bold text-slate-700 mb-1">
                Upload Own Custom Logo / Icon Image File
              </label>
              <input
                id="theme-logo-file"
                type="file"
                accept="image/*"
                class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-[#4F46E5]"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Primary Brand Color</label>
              <input
                id="theme-primary-color"
                type="color"
                value="${this.escapeHtml(theme.primaryColor)}"
                class="w-full h-10 rounded-lg cursor-pointer"
              />
              <span class="text-[11px] font-mono-tabular text-slate-500">${this.escapeHtml(theme.primaryColor)}</span>
            </div>

            <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Secondary Emerald</label>
              <input
                id="theme-secondary-color"
                type="color"
                value="${this.escapeHtml(theme.secondaryColor)}"
                class="w-full h-10 rounded-lg cursor-pointer"
              />
              <span class="text-[11px] font-mono-tabular text-slate-500">${this.escapeHtml(theme.secondaryColor)}</span>
            </div>

            <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Accent Highlight</label>
              <input
                id="theme-accent-color"
                type="color"
                value="${this.escapeHtml(theme.accentColor)}"
                class="w-full h-10 rounded-lg cursor-pointer"
              />
              <span class="text-[11px] font-mono-tabular text-slate-500">${this.escapeHtml(theme.accentColor)}</span>
            </div>

            <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
              <label class="block text-xs font-bold text-slate-700">Clean Surface Bg</label>
              <input
                id="theme-surface-color"
                type="color"
                value="${this.escapeHtml(theme.surfaceBg)}"
                class="w-full h-10 rounded-lg cursor-pointer"
              />
              <span class="text-[11px] font-mono-tabular text-slate-500">${this.escapeHtml(theme.surfaceBg)}</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              data-action="reset-default-theme"
              class="min-h-[42px] px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-bold text-slate-700"
            >
              Reset Default Clean White Theme & Emblem Logo
            </button>
            <button
              type="submit"
              data-testid="save-site-theme-btn"
              class="min-h-[42px] px-6 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
            >
              Save & Apply Theme + Logo Across Website →
            </button>
          </div>
        </form>
      </div>
    `;
  }

  private renderStructureManager(): string {
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const chapters = dataStore.getChapters();

    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-slate-900">1. Manage Classes (${classes.length})</h2>
          <form id="add-class-form" class="flex gap-2">
            <input
              id="new-class-name"
              type="text"
              required
              placeholder="e.g., Foundation Class 8"
              class="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
            />
            <button type="submit" class="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold">
              + Add
            </button>
          </form>
          <div class="divide-y divide-slate-100">
            ${classes
              .map(
                (c) => `
              <div class="py-2.5 flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-800">${this.escapeHtml(c.name)}</span>
                <button
                  type="button"
                  data-action="del-class"
                  data-id="${c.id}"
                  class="text-slate-400 hover:text-[#EF4444]"
                >
                  Delete
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-slate-900">2. Manage Subjects (${subjects.length})</h2>
          <form id="add-subject-form" class="space-y-2">
            <select
              id="new-subject-class"
              class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
            >
              ${classes.map((c) => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
            </select>
            <div class="flex gap-2">
              <input
                id="new-subject-name"
                type="text"
                required
                placeholder="e.g., Physical Chemistry"
                class="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
              />
              <button type="submit" class="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold">
                + Add
              </button>
            </div>
          </form>
          <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            ${subjects
              .map((s) => {
                const cls = classes.find((c) => c.id === s.classId);
                return `
                <div class="py-2 flex items-center justify-between text-xs">
                  <span><strong>${this.escapeHtml(s.name)}</strong> <span class="text-slate-400">(${this.escapeHtml(cls?.name ?? '')})</span></span>
                  <button
                    type="button"
                    data-action="del-subject"
                    data-id="${s.id}"
                    class="text-slate-400 hover:text-[#EF4444]"
                  >
                    Delete
                  </button>
                </div>
              `;
              })
              .join('')}
          </div>
        </section>

        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-slate-900">3. Manage Chapters (${chapters.length})</h2>
          <form id="add-chapter-form" class="space-y-2">
            <select
              id="new-chapter-subject"
              class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
            >
              ${subjects
                .map((s) => `<option value="${s.id}" data-class-id="${s.classId}">${this.escapeHtml(s.name)} (${s.classId})</option>`)
                .join('')}
            </select>
            <div class="flex gap-2">
              <input
                id="new-chapter-name"
                type="text"
                required
                placeholder="e.g., Alternating Current & LCR"
                class="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
              />
              <button type="submit" class="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold">
                + Add
              </button>
            </div>
          </form>
          <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            ${chapters
              .map(
                (ch) => `
              <div class="py-2 flex items-center justify-between text-xs">
                <span class="font-medium text-slate-800 truncate">${this.escapeHtml(ch.name)}</span>
                <button
                  type="button"
                  data-action="del-chapter"
                  data-id="${ch.id}"
                  class="text-slate-400 hover:text-[#EF4444] shrink-0"
                >
                  Delete
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  private renderMaterialUploader(): string {
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const sections = dataStore.getVaultSections();
    const materials = dataStore.getMaterials();

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section class="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#10B981]">
              Simplified PDF Upload · Only Title, Class & Subject (No Chapter)
            </span>
            <h2 class="text-base font-bold text-slate-900 mt-0.5">
              Upload Study Material / Test PDF to Firebase Vault
            </h2>
          </div>
          <form id="admin-upload-material-form" class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">1. PDF Title (Required)</label>
              <input
                id="mat-title"
                type="text"
                required
                placeholder="e.g., Modern Physics & Semiconductors Rapid Notes"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">2. Class / Cohort</label>
                <select
                  id="mat-class"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
                >
                  ${classes.map((c) => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">3. Subject</label>
                <select
                  id="mat-subject"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
                >
                  ${subjects.map((s) => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">4. Vault Section</label>
                <select
                  id="mat-section"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold"
                >
                  ${sections.map((sec) => `<option value="${this.escapeHtml(sec)}">${this.escapeHtml(sec)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Or Custom Section</label>
                <input
                  id="mat-custom-section"
                  type="text"
                  placeholder="e.g., CBT Test PDFs"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
                />
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1.5">
              <label for="mat-pdf-file" class="block text-xs font-extrabold text-[#4F46E5] cursor-pointer">
                5. Choose PDF File from Device (.pdf)
              </label>
              <input
                id="mat-pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                class="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#4F46E5] file:text-white"
              />
              <div class="text-[11px] text-slate-500">
                ${this.pendingPdfFile ? `Ready to upload: ${this.escapeHtml(this.pendingPdfFile.name)}` : 'Select any PDF file or publish directly with instant Firebase sync.'}
              </div>
            </div>

            <button
              type="submit"
              data-testid="publish-pdf-material-btn"
              class="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
            >
              Publish PDF to Study Material Vault (Synced to Firebase) →
            </button>
          </form>
        </section>

        <section class="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-slate-900">Published Study Materials (${materials.length})</h2>
          <div class="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            ${materials
              .map(
                (m) => `
              <div class="py-2.5 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 truncate">${this.escapeHtml(m.title)}</div>
                  <div class="text-[11px] text-slate-500">${this.escapeHtml(m.section)} · ${m.downloads} downloads</div>
                </div>
                <button
                  type="button"
                  data-action="del-material"
                  data-id="${m.id}"
                  class="min-h-[32px] px-3 py-1 rounded-lg bg-red-50 text-[#EF4444] text-xs font-bold"
                >
                  Delete
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  private renderMentorshipDesk(): string {
    const sessions = dataStore.getMentorshipSessions();
    return `
      <div class="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-lg font-extrabold text-slate-900">
              Admin & Mentor 1:1 Consultation Desk (With Live Jitsi Video Call)
            </h2>
            <p class="text-xs text-slate-500">
              Reply to student threads or click "Join Jitsi Video Call" to enter the live 1:1 room with that student.
            </p>
          </div>
          <span class="px-3 py-1 rounded-xl bg-indigo-50 text-[#4F46E5] text-xs font-mono-tabular font-bold">
            ${sessions.length} Active Threads
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${sessions
            .map(
              (s) => `
            <div class="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 flex flex-col justify-between">
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="text-sm font-extrabold text-slate-900">${this.escapeHtml(s.studentName)}</div>
                    <div class="text-[11px] text-slate-500">
                      ${this.escapeHtml(s.studentClass)} · Mentor: <strong class="text-[#4F46E5]">${this.escapeHtml(s.mentorName || 'Sumit Kumar')}</strong>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-action="admin-join-jitsi"
                      data-room="${this.escapeHtml(s.jitsiRoom || 'prepskm_sumit_live_room')}"
                      data-student="${this.escapeHtml(s.studentName)}"
                      class="px-2.5 py-1 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-[11px] font-extrabold shadow-2xs"
                    >
                      🎥 Join Jitsi Call
                    </button>
                  </div>
                </div>

                <div class="space-y-1.5 max-h-40 overflow-y-auto bg-white p-3 rounded-xl border border-[#E2E8F0]">
                  ${s.messages
                    .map(
                      (m) => `
                    <div class="text-xs">
                      <strong class="${m.senderRole === 'admin' ? 'text-[#4F46E5]' : 'text-slate-900'}">${this.escapeHtml(m.senderName)}:</strong>
                      <span class="text-slate-600"> ${this.escapeHtml(m.text)}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <form data-admin-reply-session="${s.id}" class="flex gap-2 pt-2">
                <input
                  type="text"
                  required
                  placeholder="Reply as ${this.escapeHtml(s.mentorName || 'Sumit Kumar')}..."
                  class="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs"
                />
                <button
                  type="submit"
                  class="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold"
                >
                  Reply
                </button>
              </form>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private renderAdminJitsiModal(): string {
    if (!this.activeAdminJitsiRoom) return '';
    const { roomName, studentName } = this.activeAdminJitsiRoom;
    const user = dataStore.getUser();
    const jitsiUrl = `https://meet.jit.si/${encodeURIComponent(
      roomName
    )}#userInfo.displayName="${encodeURIComponent(
      user.name
    )}"&config.prejoinPageEnabled=false`;

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mentor Jitsi Video Call Room"
        class="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div class="text-xs font-extrabold text-emerald-400">
                Mentor Live Jitsi Meet Call with ${this.escapeHtml(studentName)}
              </div>
              <div class="text-[11px] font-mono-tabular text-slate-300">Room: ${this.escapeHtml(roomName)}</div>
            </div>
            <button
              type="button"
              data-action="close-admin-jitsi"
              class="px-3.5 py-1.5 rounded-xl bg-[#EF4444] text-white text-xs font-bold"
            >
              Close Call ✕
            </button>
          </div>
          <div class="w-full h-[480px] bg-slate-950">
            <iframe
              src="${jitsiUrl}"
              title="Mentor Jitsi Video Room"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              class="w-full h-full border-0"
            ></iframe>
          </div>
        </div>
      </div>
    `;
  }

  private drawDualCropCanvases(): void {
    const sourceCanvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#admin-source-sheet-canvas'
    );
    const crop1Canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#admin-crop1-preview'
    );
    const crop2Canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#admin-crop2-preview'
    );
    if (!sourceCanvas) return;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return;

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.fillStyle = '#FFFFFF';
    offCtx.fillRect(0, 0, w, h);

    if (this.uploadedSheetImage) {
      offCtx.drawImage(this.uploadedSheetImage, 0, 0, w, h);
    } else {
      offCtx.fillStyle = '#0F172A';
      offCtx.font = '700 18px "Plus Jakarta Sans", sans-serif';
      offCtx.fillText(
        'JEE ADVANCED PHYSICS PAPER-1 · SECTION A (ROTATIONAL MECHANICS)',
        32,
        28
      );

      offCtx.font = '600 17px "Plus Jakarta Sans", sans-serif';
      offCtx.fillStyle = '#1E293B';
      offCtx.fillText(this.questionPromptText.slice(0, 74), 32, 92);
      offCtx.fillText(
        'Find the magnitude of static friction acting on the cylinder during pure rolling:',
        32,
        122
      );

      offCtx.font = '600 16px "JetBrains Mono", monospace';
      offCtx.fillStyle = '#4F46E5';
      offCtx.fillText('(A) (1/3) M g sin θ        (B) (2/5) M g sin θ', 32, 168);
      offCtx.fillText('(C) (1/2) M g sin θ        (D) (2/7) M g sin θ', 32, 202);

      offCtx.strokeStyle = '#CBD5E1';
      offCtx.lineWidth = 2;
      offCtx.beginPath();
      offCtx.moveTo(28, 255);
      offCtx.lineTo(w - 28, 255);
      offCtx.stroke();

      offCtx.fillStyle = '#10B981';
      offCtx.font = '700 18px "JetBrains Mono", monospace';
      offCtx.fillText('OFFICIAL STEP-BY-STEP SOLUTION:', 32, 305);

      offCtx.fillStyle = '#334155';
      offCtx.font = '500 16px "JetBrains Mono", monospace';
      offCtx.fillText(
        'Step 1: For a solid cylinder, I_cm = (1/2) M R²  ==>  β = 1/2 = 0.5',
        32,
        345
      );
      offCtx.fillText(
        'Step 2: a_cm = g sin θ / (1 + β) = (2/3) g sin θ',
        32,
        382
      );
      offCtx.fillText(
        'Step 3: f_s = M g sin θ - M a_cm = (1/3) M g sin θ. Correct Option: (A)',
        32,
        420
      );
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(offscreen, 0, 0);

    // Draw Crop Box 1 Overlay (Indigo) + Bottom-Right Resize Handle
    const b1x = (this.cropBox1.x / 100) * w;
    const b1y = (this.cropBox1.y / 100) * h;
    const b1w = (this.cropBox1.w / 100) * w;
    const b1h = (this.cropBox1.h / 100) * h;

    ctx.fillStyle = 'rgba(79, 70, 229, 0.06)';
    ctx.fillRect(b1x, b1y, b1w, b1h);
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(b1x, b1y, b1w, b1h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#4F46E5';
    ctx.fillRect(b1x, Math.max(0, b1y - 22), 260, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('CROP BOX 1: QUESTION (DRAG / RESIZE ↘)', b1x + 8, Math.max(15, b1y - 7));
    // Resize handle square for Box 1
    ctx.fillStyle = '#4F46E5';
    ctx.fillRect(b1x + b1w - 16, b1y + b1h - 16, 16, 16);

    // Draw Crop Box 2 Overlay (Emerald) + Bottom-Right Resize Handle
    const b2x = (this.cropBox2.x / 100) * w;
    const b2y = (this.cropBox2.y / 100) * h;
    const b2w = (this.cropBox2.w / 100) * w;
    const b2h = (this.cropBox2.h / 100) * h;

    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.fillRect(b2x, b2y, b2w, b2h);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(b2x, b2y, b2w, b2h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(b2x, Math.max(0, b2y - 22), 260, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('CROP BOX 2: SOLUTION (DRAG / RESIZE ↘)', b2x + 8, Math.max(15, b2y - 7));
    // Resize handle square for Box 2
    ctx.fillStyle = '#10B981';
    ctx.fillRect(b2x + b2w - 16, b2y + b2h - 16, 16, 16);

    // Update coordinate labels
    const l1 = this.containerEl?.querySelector('#crop1-coords-label');
    if (l1) {
      l1.textContent = `X:${Math.round(this.cropBox1.x)}% Y:${Math.round(
        this.cropBox1.y
      )}% W:${Math.round(this.cropBox1.w)}% H:${Math.round(this.cropBox1.h)}%`;
    }
    const l2 = this.containerEl?.querySelector('#crop2-coords-label');
    if (l2) {
      l2.textContent = `X:${Math.round(this.cropBox2.x)}% Y:${Math.round(
        this.cropBox2.y
      )}% W:${Math.round(this.cropBox2.w)}% H:${Math.round(this.cropBox2.h)}%`;
    }

    if (crop1Canvas) {
      const c1 = crop1Canvas.getContext('2d');
      if (c1) {
        c1.clearRect(0, 0, crop1Canvas.width, crop1Canvas.height);
        c1.drawImage(
          offscreen,
          b1x,
          b1y,
          b1w,
          b1h,
          0,
          0,
          crop1Canvas.width,
          crop1Canvas.height
        );
      }
    }

    if (crop2Canvas) {
      const c2 = crop2Canvas.getContext('2d');
      if (c2) {
        c2.clearRect(0, 0, crop2Canvas.width, crop2Canvas.height);
        c2.drawImage(
          offscreen,
          b2x,
          b2y,
          b2w,
          b2h,
          0,
          0,
          crop2Canvas.width,
          crop2Canvas.height
        );
      }
    }
  }

  private bindInteractiveCanvasCropEvents(): void {
    const canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
      '#admin-source-sheet-canvas'
    );
    if (!canvas) return;

    const getCanvasPctCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const yPct = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      return { xPct, yPct };
    };

    canvas.addEventListener('pointerdown', (e) => {
      const { xPct, yPct } = getCanvasPctCoords(e);
      const b1 = this.cropBox1;
      const b2 = this.cropBox2;

      // Check resize handle of Box 1 (bottom-right 5% x 6% zone)
      if (
        Math.abs(xPct - (b1.x + b1.w)) <= 5 &&
        Math.abs(yPct - (b1.y + b1.h)) <= 6
      ) {
        this.dragState = {
          target: 'box1-resize',
          startX: xPct,
          startY: yPct,
          origBox: { ...b1 },
        };
      } else if (
        Math.abs(xPct - (b2.x + b2.w)) <= 5 &&
        Math.abs(yPct - (b2.y + b2.h)) <= 6
      ) {
        this.dragState = {
          target: 'box2-resize',
          startX: xPct,
          startY: yPct,
          origBox: { ...b2 },
        };
      } else if (
        xPct >= b1.x &&
        xPct <= b1.x + b1.w &&
        yPct >= b1.y - 4 &&
        yPct <= b1.y + b1.h
      ) {
        this.dragState = {
          target: 'box1-move',
          startX: xPct,
          startY: yPct,
          origBox: { ...b1 },
        };
      } else if (
        xPct >= b2.x &&
        xPct <= b2.x + b2.w &&
        yPct >= b2.y - 4 &&
        yPct <= b2.y + b2.h
      ) {
        this.dragState = {
          target: 'box2-move',
          startX: xPct,
          startY: yPct,
          origBox: { ...b2 },
        };
      }

      if (this.dragState) {
        canvas.setPointerCapture(e.pointerId);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragState) return;
      const { xPct, yPct } = getCanvasPctCoords(e);
      const dx = xPct - this.dragState.startX;
      const dy = yPct - this.dragState.startY;
      const orig = this.dragState.origBox;

      if (this.dragState.target === 'box1-move') {
        this.cropBox1.x = Math.max(0, Math.min(100 - orig.w, Math.round(orig.x + dx)));
        this.cropBox1.y = Math.max(4, Math.min(100 - orig.h, Math.round(orig.y + dy)));
      } else if (this.dragState.target === 'box1-resize') {
        this.cropBox1.w = Math.max(20, Math.min(100 - orig.x, Math.round(orig.w + dx)));
        this.cropBox1.h = Math.max(12, Math.min(100 - orig.y, Math.round(orig.h + dy)));
      } else if (this.dragState.target === 'box2-move') {
        this.cropBox2.x = Math.max(0, Math.min(100 - orig.w, Math.round(orig.x + dx)));
        this.cropBox2.y = Math.max(4, Math.min(100 - orig.h, Math.round(orig.y + dy)));
      } else if (this.dragState.target === 'box2-resize') {
        this.cropBox2.w = Math.max(20, Math.min(100 - orig.x, Math.round(orig.w + dx)));
        this.cropBox2.h = Math.max(12, Math.min(100 - orig.y, Math.round(orig.h + dy)));
      }

      this.drawDualCropCanvases();
    });

    const endDrag = () => {
      this.dragState = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  private bindGateEvents(): void {
    if (!this.containerEl) return;
    const activateBtn = this.containerEl.querySelector('#admin-activate-master-btn');
    activateBtn?.addEventListener('click', () => {
      dataStore.switchRoleSession('admin');
      this.callbacks.onAuthUpdated();
      this.callbacks.onShowToast(
        `Authenticated as Master Admin (${MASTER_ADMIN_EMAIL})`
      );
      this.rerender();
    });

    const googleBtn = this.containerEl.querySelector('#admin-google-oauth-btn');
    googleBtn?.addEventListener('click', async () => {
      try {
        await dataStore.signInWithGoogle();
      } catch {
        dataStore.switchRoleSession('admin');
        this.callbacks.onAuthUpdated();
        this.rerender();
      }
    });

    this.containerEl
      .querySelectorAll<HTMLButtonElement>('[data-mentor-gate-email]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const email = btn.dataset.mentorGateEmail;
          if (email) {
            dataStore.switchRoleSession(
              'mentor',
              undefined,
              undefined,
              undefined,
              email
            );
            this.callbacks.onAuthUpdated();
            this.callbacks.onShowToast(`Signed in as Mentor (${email})`);
            this.rerender();
          }
        });
      });
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    // Dual-Crop Sliders
    this.containerEl
      .querySelectorAll<HTMLInputElement>('[data-crop-slider]')
      .forEach((slider) => {
        slider.addEventListener('input', () => {
          const key = slider.dataset.cropSlider;
          const val = Number(slider.value);
          if (key === 'b1-y') this.cropBox1.y = val;
          if (key === 'b1-h') this.cropBox1.h = val;
          if (key === 'b2-y') this.cropBox2.y = val;
          if (key === 'b2-h') this.cropBox2.h = val;
          this.drawDualCropCanvases();
        });
      });

    // Upload Exam Sheet Image for Cropping
    const cropFileInput = this.containerEl.querySelector<HTMLInputElement>(
      '#admin-crop-file-input'
    );
    cropFileInput?.addEventListener('change', () => {
      const file = cropFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const img = new Image();
          img.onload = () => {
            this.uploadedSheetImage = img;
            this.drawDualCropCanvases();
            this.callbacks.onShowToast(
              `Loaded "${file.name}" into Dual-Crop Workbench!`
            );
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    });

    // Taxonomy dropdowns (Only Class & Subject needed)
    const clsSelect =
      this.containerEl.querySelector<HTMLSelectElement>('#wb-class-select');
    clsSelect?.addEventListener('change', () => {
      this.selectedClassId = clsSelect.value;
      const subs = dataStore.getSubjects(this.selectedClassId);
      this.selectedSubjectId = subs[0]?.id ?? '';
      this.rerender();
    });

    const subSelect =
      this.containerEl.querySelector<HTMLSelectElement>('#wb-subject-select');
    subSelect?.addEventListener('change', () => {
      this.selectedSubjectId = subSelect.value;
    });

    // Save & Next Cropped Question + Solution Form
    const saveQuestionForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-save-question-form'
    );
    saveQuestionForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const promptInput =
        saveQuestionForm.querySelector<HTMLInputElement>('#wb-prompt-input');
      const numInput =
        saveQuestionForm.querySelector<HTMLInputElement>('#wb-numerical-val');
      if (promptInput && promptInput.value.trim()) {
        this.questionPromptText = promptInput.value.trim();
      }
      if (numInput && numInput.value.trim()) {
        this.numericalAnswer = numInput.value.trim();
      }

      // Ensure canvases are freshly drawn before extracting data URLs
      this.drawDualCropCanvases();

      const crop1Canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
        '#admin-crop1-preview'
      );
      const crop2Canvas = this.containerEl?.querySelector<HTMLCanvasElement>(
        '#admin-crop2-preview'
      );
      const qDataUrl = crop1Canvas?.toDataURL('image/png') ?? '';
      const sDataUrl = crop2Canvas?.toDataURL('image/png') ?? '';

      const ts = Date.now();
      const [questionImgUrl, solutionImgUrl] = await Promise.all([
        uploadDataUrlToStorage(`questions/${ts}_q.png`, qDataUrl),
        uploadDataUrlToStorage(`solutions/${ts}_s.png`, sDataUrl),
      ]);

      const subObj = dataStore
        .getSubjects()
        .find((s) => s.id === this.selectedSubjectId);

      const correctVal =
        this.questionType === 'MCQ'
          ? this.singleMcqAnswer
          : this.questionType === 'NUMERICAL'
            ? this.numericalAnswer
            : Array.from(this.multiMcqAnswers).sort().join(',');

      await dataStore.addAdminQuestion({
        classId: this.selectedClassId,
        subjectId: this.selectedSubjectId,
        subjectName: (subObj?.name as SubjectName) || 'Physics',
        chapterName: this.questionPromptText.slice(0, 48),
        type: this.questionType,
        questionImg: questionImgUrl,
        solutionImg: solutionImgUrl,
        prompt: this.questionPromptText,
        options:
          this.questionType === 'MCQ'
            ? [
                '(1/3) M g sin θ',
                '(2/5) M g sin θ',
                '(1/2) M g sin θ',
                '(2/7) M g sin θ',
              ]
            : undefined,
        correctVal,
        marks: 4,
        solutionText:
          'Official Step-by-Step Solution cropped and synced via Master Admin Workbench.',
      });

      this.savedCountInSession += 1;
      this.callbacks.onShowToast(
        `Saved Cropped Question & Solution #${this.savedCountInSession} to Firebase!`
      );
      this.rerender();
    });

    // Video Lecture File Inputs & Form
    const vidFileInput =
      this.containerEl.querySelector<HTMLInputElement>('#vid-file-input');
    vidFileInput?.addEventListener('change', () => {
      const file = vidFileInput.files?.[0];
      if (!file) return;
      this.pendingVideoFile = file;
      this.pendingVideoObjectUrl = URL.createObjectURL(file);
      this.callbacks.onShowToast(`Selected video file: "${file.name}"`);
    });

    const vidThumbInput =
      this.containerEl.querySelector<HTMLInputElement>('#vid-thumb-input');
    vidThumbInput?.addEventListener('change', () => {
      const file = vidThumbInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.pendingVideoThumbDataUrl = reader.result;
          this.callbacks.onShowToast(`Loaded custom thumbnail: "${file.name}"`);
        }
      };
      reader.readAsDataURL(file);
    });

    const uploadVideoForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-upload-video-form'
    );
    uploadVideoForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title =
        uploadVideoForm
          .querySelector<HTMLInputElement>('#vid-upload-title')
          ?.value.trim() ?? '';
      if (!title) return;
      const secSelect =
        uploadVideoForm.querySelector<HTMLSelectElement>('#vid-upload-section')
          ?.value ?? 'Strategy Roadmaps';
      const customSec =
        uploadVideoForm
          .querySelector<HTMLInputElement>('#vid-upload-custom-section')
          ?.value.trim() ?? '';
      const section = customSec || secSelect;
      if (customSec) {
        dataStore.addCustomVideoSection(customSec);
      }
      const mentorId =
        uploadVideoForm.querySelector<HTMLSelectElement>('#vid-upload-mentor')
          ?.value ?? 'mentor_sumit_master';
      const topicTag =
        uploadVideoForm
          .querySelector<HTMLInputElement>('#vid-upload-tag')
          ?.value.trim() || `${section} · JEE & NEET`;
      const duration =
        uploadVideoForm
          .querySelector<HTMLInputElement>('#vid-upload-duration')
          ?.value.trim() || '25:00';
      const description =
        uploadVideoForm
          .querySelector<HTMLTextAreaElement>('#vid-upload-desc')
          ?.value.trim() || 'Complete concept breakdown and PYQ applications.';

      let videoUrl = this.pendingVideoObjectUrl || '';
      if (this.pendingVideoFile) {
        videoUrl = await uploadFileToStorage(
          `videos/${Date.now()}_${this.pendingVideoFile.name}`,
          this.pendingVideoFile,
          this.pendingVideoObjectUrl || ''
        );
      }

      let thumbnailUrl = this.pendingVideoThumbDataUrl || LECTURE_COVER_PATH;
      if (this.pendingVideoThumbDataUrl) {
        thumbnailUrl = await uploadDataUrlToStorage(
          `thumbnails/${Date.now()}_thumb.png`,
          this.pendingVideoThumbDataUrl
        );
      }

      const added = await dataStore.addVideoLecture({
        title,
        description,
        duration,
        topicTag,
        section,
        thumbnailUrl,
        videoUrl,
        mentorId,
      });

      this.pendingVideoFile = null;
      this.pendingVideoThumbDataUrl = null;
      this.callbacks.onShowToast(
        `Published video "${added.title}" in ${added.section} (By ${added.mentorName})!`
      );
      this.rerender();
    });

    // Reply to Student Video Doubts
    this.containerEl
      .querySelectorAll<HTMLFormElement>('[data-doubt-reply-id]')
      .forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const doubtId = form.dataset.doubtReplyId;
          const input = form.querySelector<HTMLInputElement>('input');
          const text = input?.value.trim() ?? '';
          if (!doubtId || !text) return;
          await dataStore.replyToVideoDoubt(doubtId, text);
          this.callbacks.onShowToast('Replied to student timestamped doubt!');
          this.rerender();
        });
      });

    // Add Mentor Form
    const addMentorForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-add-mentor-form'
    );
    addMentorForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name =
        addMentorForm
          .querySelector<HTMLInputElement>('#mentor-name-input')
          ?.value.trim() ?? '';
      const email =
        addMentorForm
          .querySelector<HTMLInputElement>('#mentor-email-input')
          ?.value.trim() ?? '';
      const role =
        (addMentorForm.querySelector<HTMLSelectElement>('#mentor-role-select')
          ?.value as 'Co-Admin & Mentor' | 'Video Mentor') ?? 'Co-Admin & Mentor';
      const subjectSpecialty =
        addMentorForm
          .querySelector<HTMLInputElement>('#mentor-specialty-input')
          ?.value.trim() ?? 'Physics';
      const qualification =
        addMentorForm
          .querySelector<HTMLInputElement>('#mentor-qual-input')
          ?.value.trim() ?? 'IIT Alumni';
      if (!name || !email) return;

      await dataStore.addMentor({
        name,
        email,
        role,
        subjectSpecialty,
        qualification,
      });
      this.callbacks.onShowToast(
        `Added Mentor "${name}" (${email}) to Mentorship & Video Uploader!`
      );
      this.rerender();
    });

    // Broadcast Form
    const bcastForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-broadcast-form'
    );
    bcastForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title =
        bcastForm
          .querySelector<HTMLInputElement>('#bcast-title-input')
          ?.value.trim() ?? '';
      const message =
        bcastForm
          .querySelector<HTMLTextAreaElement>('#bcast-message-input')
          ?.value.trim() ?? '';
      const badgeType =
        (bcastForm.querySelector<HTMLSelectElement>('#bcast-badge-select')
          ?.value as 'ANNOUNCEMENT' | 'URGENT' | 'LIVE_CLASS' | 'TEST_ALERT') ??
        'ANNOUNCEMENT';
      const targetCohort =
        bcastForm.querySelector<HTMLSelectElement>('#bcast-cohort-select')
          ?.value ?? 'ALL';
      if (!title || !message) return;

      await dataStore.sendBroadcast({
        title,
        message,
        badgeType,
        targetCohort,
      });
      this.callbacks.onShowToast(
        `Broadcast sent to all ${targetCohort} students!`
      );
      this.rerender();
    });

    // Custom Logo File Upload & Theme Customizer Form
    const logoFileInput =
      this.containerEl.querySelector<HTMLInputElement>('#theme-logo-file');
    logoFileInput?.addEventListener('change', () => {
      const file = logoFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.pendingCustomLogoDataUrl = reader.result;
          this.callbacks.onShowToast(`Loaded custom logo "${file.name}"!`);
          this.rerender();
        }
      };
      reader.readAsDataURL(file);
    });

    const themeForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-theme-customizer-form'
    );
    themeForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const brandName =
        themeForm
          .querySelector<HTMLInputElement>('#theme-brand-name')
          ?.value.trim() || 'prepskm.in';
      const primaryColor =
        themeForm.querySelector<HTMLInputElement>('#theme-primary-color')
          ?.value || '#4F46E5';
      const secondaryColor =
        themeForm.querySelector<HTMLInputElement>('#theme-secondary-color')
          ?.value || '#10B981';
      const accentColor =
        themeForm.querySelector<HTMLInputElement>('#theme-accent-color')?.value ||
        '#F59E0B';
      const surfaceBg =
        themeForm.querySelector<HTMLInputElement>('#theme-surface-color')
          ?.value || '#F8FAFC';

      await dataStore.updateSiteTheme({
        brandName,
        primaryColor,
        secondaryColor,
        accentColor,
        surfaceBg,
        ...(this.pendingCustomLogoDataUrl
          ? { logoDataUrl: this.pendingCustomLogoDataUrl }
          : {}),
      });
      this.pendingCustomLogoDataUrl = null;
      this.callbacks.onAuthUpdated();
      this.callbacks.onShowToast(
        `Applied custom Website Theme & Logo for ${brandName}!`
      );
      this.rerender();
    });

    // Structure Manager Forms
    const addClassForm =
      this.containerEl.querySelector<HTMLFormElement>('#add-class-form');
    addClassForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input =
        addClassForm.querySelector<HTMLInputElement>('#new-class-name');
      const name = input?.value.trim() ?? '';
      if (!name) return;
      await dataStore.addClass(name);
      this.callbacks.onShowToast(`Added Class "${name}"`);
      this.rerender();
    });

    const addSubjectForm =
      this.containerEl.querySelector<HTMLFormElement>('#add-subject-form');
    addSubjectForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clsId =
        addSubjectForm.querySelector<HTMLSelectElement>('#new-subject-class')
          ?.value ?? 'cls_11';
      const name =
        addSubjectForm
          .querySelector<HTMLInputElement>('#new-subject-name')
          ?.value.trim() ?? '';
      if (!name) return;
      await dataStore.addSubject(clsId, name);
      this.callbacks.onShowToast(`Added Subject "${name}"`);
      this.rerender();
    });

    const addChapterForm =
      this.containerEl.querySelector<HTMLFormElement>('#add-chapter-form');
    addChapterForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subSel = addChapterForm.querySelector<HTMLSelectElement>(
        '#new-chapter-subject'
      );
      const subId = subSel?.value ?? 'sub_phy_11';
      const clsId =
        subSel?.selectedOptions[0]?.dataset.classId ?? this.selectedClassId;
      const name =
        addChapterForm
          .querySelector<HTMLInputElement>('#new-chapter-name')
          ?.value.trim() ?? '';
      if (!name) return;
      await dataStore.addChapter(clsId, subId, name);
      this.callbacks.onShowToast(`Added Chapter "${name}"`);
      this.rerender();
    });

    // Material PDF File Input & Uploader Form (Title + Class + Subject + Section)
    const pdfFileInput =
      this.containerEl.querySelector<HTMLInputElement>('#mat-pdf-file');
    pdfFileInput?.addEventListener('change', () => {
      const file = pdfFileInput.files?.[0];
      if (!file) return;
      this.pendingPdfFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.pendingPdfDataUrl = reader.result;
          this.callbacks.onShowToast(`Loaded PDF file: "${file.name}"`);
        }
      };
      reader.readAsDataURL(file);
    });

    const uploadMatForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-upload-material-form'
    );
    uploadMatForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title =
        uploadMatForm.querySelector<HTMLInputElement>('#mat-title')?.value.trim() ??
        '';
      if (!title) return;
      const classId =
        uploadMatForm.querySelector<HTMLSelectElement>('#mat-class')?.value ??
        'cls_12';
      const subjectId =
        uploadMatForm.querySelector<HTMLSelectElement>('#mat-subject')?.value ??
        'sub_phy_12';
      const secDropdown =
        uploadMatForm.querySelector<HTMLSelectElement>('#mat-section')?.value ??
        'PYQs';
      const customSec =
        uploadMatForm
          .querySelector<HTMLInputElement>('#mat-custom-section')
          ?.value.trim() ?? '';

      const section = customSec || secDropdown;
      if (customSec) {
        dataStore.addCustomVaultSection(customSec);
      }

      let pdfUrl = `/materials/${Date.now()}.pdf`;
      if (this.pendingPdfFile) {
        pdfUrl = await uploadFileToStorage(
          `materials/${Date.now()}_${this.pendingPdfFile.name}`,
          this.pendingPdfFile,
          this.pendingPdfDataUrl || pdfUrl
        );
      }

      await dataStore.addMaterial({
        title,
        section,
        classId,
        subjectId,
        pdfUrl,
      });
      this.pendingPdfFile = null;
      this.pendingPdfDataUrl = null;
      this.callbacks.onShowToast(
        `Published PDF "${title}" to ${section} Vault (Synced to Firebase)!`
      );
      this.rerender();
    });

    // Admin Mentorship Reply Forms
    this.containerEl
      .querySelectorAll<HTMLFormElement>('[data-admin-reply-session]')
      .forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const sessionId = form.dataset.adminReplySession;
          const input = form.querySelector<HTMLInputElement>('input');
          const text = input?.value.trim() ?? '';
          if (!sessionId || !text) return;
          await dataStore.sendMentorshipMessage(sessionId, text, 'admin');
          this.callbacks.onShowToast('Sent mentor reply to student!');
          this.rerender();
        });
      });

    // General Action Buttons
    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'switch-admin-tab': {
            const tab = el.dataset.tab as AdminTabId;
            if (tab) {
              this.activeAdminTab = tab;
              this.rerender();
            }
            break;
          }
          case 'reset-crop-boxes': {
            this.cropBox1 = { x: 4, y: 10, w: 92, h: 36 };
            this.cropBox2 = { x: 4, y: 53, w: 92, h: 40 };
            this.drawDualCropCanvases();
            break;
          }
          case 'wb-select-qtype': {
            const qt = el.dataset.qtype as 'MCQ' | 'NUMERICAL' | 'MULTI_MCQ';
            if (qt) {
              this.questionType = qt;
              this.rerender();
            }
            break;
          }
          case 'wb-select-single-opt': {
            this.singleMcqAnswer = el.dataset.opt ?? '0';
            this.rerender();
            break;
          }
          case 'wb-toggle-multi-opt': {
            const opt = el.dataset.opt;
            if (opt) {
              if (this.multiMcqAnswers.has(opt)) {
                if (this.multiMcqAnswers.size > 1) this.multiMcqAnswers.delete(opt);
              } else {
                this.multiMcqAnswers.add(opt);
              }
              this.rerender();
            }
            break;
          }
          case 'delete-admin-q': {
            const qid = el.dataset.qid;
            if (qid) {
              await dataStore.deleteAdminQuestion(qid);
              this.rerender();
            }
            break;
          }
          case 'del-video-lecture': {
            const id = el.dataset.id;
            if (id) {
              await dataStore.deleteVideoLecture(id);
              this.callbacks.onShowToast('Removed video lecture');
              this.rerender();
            }
            break;
          }
          case 'toggle-mentor-online': {
            const id = el.dataset.id;
            if (id) {
              const nextOnline = await dataStore.toggleMentorOnlineStatus(id);
              this.callbacks.onShowToast(
                nextOnline
                  ? 'Mentor is now ACTIVE — Students can initiate 1:1 Voice & Video Calls!'
                  : 'Mentor set to OFFLINE — 1:1 Voice & Video Calls are locked.'
              );
              this.rerender();
            }
            break;
          }
          case 'del-mentor': {
            const id = el.dataset.id;
            if (id) {
              await dataStore.deleteMentor(id);
              this.callbacks.onShowToast('Removed mentor');
              this.rerender();
            }
            break;
          }
          case 'del-broadcast': {
            const id = el.dataset.id;
            if (id) {
              await dataStore.deleteBroadcast(id);
              this.rerender();
            }
            break;
          }
          case 'apply-theme-preset': {
            const primaryColor = el.dataset.primary || '#4F46E5';
            const secondaryColor = el.dataset.secondary || '#10B981';
            const accentColor = el.dataset.accent || '#F59E0B';
            const surfaceBg = el.dataset.surface || '#F8FAFC';
            await dataStore.updateSiteTheme({
              primaryColor,
              secondaryColor,
              accentColor,
              surfaceBg,
            });
            this.callbacks.onAuthUpdated();
            this.callbacks.onShowToast('Applied multi-color theme preset!');
            this.rerender();
            break;
          }
          case 'reset-default-theme': {
            await dataStore.updateSiteTheme({
              brandName: 'prepskm.in',
              primaryColor: '#4F46E5',
              secondaryColor: '#10B981',
              accentColor: '#F59E0B',
              surfaceBg: '#F8FAFC',
              logoDataUrl: DEFAULT_BRAND_LOGO_SVG,
            });
            this.pendingCustomLogoDataUrl = null;
            this.callbacks.onAuthUpdated();
            this.callbacks.onShowToast('Reset to default Clean White theme & logo');
            this.rerender();
            break;
          }
          case 'del-class': {
            if (el.dataset.id) {
              await dataStore.deleteClass(el.dataset.id);
              this.rerender();
            }
            break;
          }
          case 'del-subject': {
            if (el.dataset.id) {
              await dataStore.deleteSubject(el.dataset.id);
              this.rerender();
            }
            break;
          }
          case 'del-chapter': {
            if (el.dataset.id) {
              await dataStore.deleteChapter(el.dataset.id);
              this.rerender();
            }
            break;
          }
          case 'del-material': {
            if (el.dataset.id) {
              await dataStore.deleteMaterial(el.dataset.id);
              this.rerender();
            }
            break;
          }
          case 'admin-join-jitsi': {
            const roomName = el.dataset.room || 'prepskm_sumit_live_room';
            const studentName = el.dataset.student || 'Student';
            this.activeAdminJitsiRoom = { roomName, studentName };
            this.rerender();
            break;
          }
          case 'close-admin-jitsi': {
            this.activeAdminJitsiRoom = null;
            this.rerender();
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
