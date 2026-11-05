import { DEFAULT_BRAND_LOGO_SVG, LECTURE_COVER_PATH } from '../constants';
import {
  dataStore,
  MASTER_ADMIN_EMAIL,
  uploadDataUrlToStorage,
  uploadFileToStorage,
} from '../services/firebaseService';
import type { StudentClassYear, SubjectName, TargetExam } from '../types';

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

  // Dual-Crop Workbench State (Default Mock Test Values + Subject-Only Selection, No Chapter!)
  private defaultMockClassCohort = 'Class 12';
  private defaultMockExamTrack: 'JEE' | 'NEET' = 'JEE';
  private defaultMockTestTitle = 'All-India Official NTA Major Mock #14';
  private selectedCropSubjectName: SubjectName = 'Physics';
  private selectedClassId = 'cls_12';
  private selectedSubjectId = 'sub_phy_12';
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
      { id: 'workbench', label: '1. Mock Test & Crop Builder' },
      { id: 'videos', label: '2. Video Lecture Uploader' },
      { id: 'mentors_broadcast', label: '3. Mentors & Broadcast' },
      { id: 'theme_brand', label: '4. Theme & Logo Customizer' },
      { id: 'materials', label: '5. PDF Vault Uploader' },
      { id: 'structure', label: '6. Chapters & Weightage' },
      { id: 'mentorship', label: '7. Admin Chat & Call Centre' },
    ];

    this.containerEl.innerHTML = `
      <div class="space-y-6">
        <!-- Admin & Mentor Top Command Banner -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-extrabold">
                  ✓ ${isMaster ? `Master Admin: ${this.escapeHtml(user.email || MASTER_ADMIN_EMAIL)}` : `Authorized Mentor: ${this.escapeHtml(user.email)}`}
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
          class="bg-white border border-indigo-100 rounded-3xl p-6 sm:p-8 shadow-md text-center space-y-5"
        >
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#4F46E5] flex items-center justify-center mx-auto text-2xl font-bold">
            🛡️
          </div>
          <div class="space-y-1.5">
            <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
              Restricted Admin & Mentor Studio (Hidden from Normal Students)
            </span>
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">
              Master Admin or Authorized Mentor Access Required
            </h1>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Sign in with Google using an authorized Master Admin Gmail (<strong class="font-mono text-indigo-700">padhlesumit59@gmail.com</strong>, <strong class="font-mono text-indigo-700">${MASTER_ADMIN_EMAIL}</strong>, or <strong class="font-mono text-indigo-700">sumit586kumar@gmail.com</strong>) to unlock the full Admin Studio.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-600">
            Current Session: <strong class="text-slate-900">${this.escapeHtml(user.name)}</strong> (<span class="font-mono text-indigo-600">${this.escapeHtml(user.email)}</span>)
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              id="admin-activate-master-btn"
              class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              Unlock as Master Admin (${MASTER_ADMIN_EMAIL}) →
            </button>
            <button
              type="button"
              id="admin-google-oauth-btn"
              class="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold transition-colors cursor-pointer"
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
                  class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#059669] text-xs font-bold cursor-pointer"
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
    const adminQuestions = dataStore.getAdminQuestions();
    const cohortChoices = [
      'Class 12',
      'Class 11',
      'Dropper',
      'Class 11 Foundation',
      'Class 10 Foundation',
      'Class 10',
      'Class 9',
    ];
    const subjectChoices: SubjectName[] = [
      'Physics',
      'Chemistry',
      'Math',
      'Biology',
    ];

    return `
      <div class="space-y-6" data-testid="admin-mock-crop-builder">
        <!-- STEP 1: DEFAULT MOCK TEST VALUES BAR (Class/Foundation + Exam Track + Mock Test Title -> Then Select Subject Only!) -->
        <section class="bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/80 text-slate-900 border border-indigo-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                Step 1 · Set Default Mock Test Values Once (Saved Across Questions)
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                Mock Test Default Configuration (Class, Foundation & Exam) → Select Subject Only & Start Cropping
              </h2>
            </div>
            <span class="px-3 py-1 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-800 font-mono-tabular text-xs font-extrabold">
              Active Subject: ${this.selectedCropSubjectName} (No Chapter Needed)
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                Default Class / Foundation Cohort
              </label>
              <select
                id="wb-default-cohort-select"
                data-testid="wb-default-cohort-select"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-extrabold text-slate-900"
              >
                ${cohortChoices
                  .map(
                    (c) =>
                      `<option value="${c}" ${this.defaultMockClassCohort === c ? 'selected' : ''}>${c}</option>`
                  )
                  .join('')}
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                Default Target Exam Track
              </label>
              <select
                id="wb-default-exam-select"
                data-testid="wb-default-exam-select"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-extrabold text-slate-900"
              >
                <option value="JEE" ${this.defaultMockExamTrack === 'JEE' ? 'selected' : ''}>JEE Main / Advanced</option>
                <option value="NEET" ${this.defaultMockExamTrack === 'NEET' ? 'selected' : ''}>NEET UG Medical</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                Default Mock Test Series Title
              </label>
              <input
                id="wb-default-mock-title"
                type="text"
                value="${this.escapeHtml(this.defaultMockTestTitle)}"
                placeholder="e.g. All-India Full Syllabus Mock #14"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <!-- STEP 2: SUBJECT-ONLY PILL SELECTOR (NO CHAPTER SELECTION REQUIRED!) -->
          <div class="pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-3">
            <span class="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
              Step 2 · Choose Subject Only (No Chapter Selection — Start Cropping Immediately):
            </span>
            <div class="flex flex-wrap items-center gap-2" data-testid="wb-subject-only-selector">
              ${subjectChoices
                .map((sub) => {
                  const active = this.selectedCropSubjectName === sub;
                  return `
                  <button
                    type="button"
                    data-action="wb-select-subject-only"
                    data-subject-name="${sub}"
                    class="min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#059669] text-white shadow-sm scale-105'
                        : 'bg-white text-slate-700 hover:bg-indigo-50 border border-slate-300'
                    }"
                  >
                    ${active ? '✓ ' : ''}${sub}
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 7 Cols: Interactive Drag-and-Resize Dual-Crop Canvas Workbench -->
          <section
            aria-label="Dual-Crop Image Canvas"
            class="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  Step 3 · Crop Question (Box 1) & Answer/Solution (Box 2)
                </span>
                <h2 class="text-lg font-bold text-slate-900 mt-0.5">
                  Drag or Resize Question & Solution Crop Boxes Directly
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
              <span>💡 <strong>Interactive Canvas:</strong> Drag inside Box 1 (Question) or Box 2 (Solution) to move, or drag the bottom-right corner handle <code class="font-mono font-bold">↘</code> to resize!</span>
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
                    Crop Box 2: Answer & Step-by-Step Solution
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

          <!-- Right 5 Cols: Subject-Only Answer Key & Instant Save to Firebase -->
          <section
            aria-label="Question Metadata and Save Form"
            class="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
          >
            <div class="pb-3 border-b border-slate-100">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#10B981]">
                Subject-Only Fast Crop · No Chapter Selection Required
              </span>
              <h2 class="text-base font-bold text-slate-900 mt-0.5">
                Save Cropped ${this.selectedCropSubjectName} Question + Solution
              </h2>
              <p class="text-xs text-slate-500">
                Auto-tagged to <strong>${this.escapeHtml(this.defaultMockClassCohort)} · ${this.defaultMockExamTrack}</strong> (${this.escapeHtml(this.defaultMockTestTitle)}) under <strong>${this.selectedCropSubjectName}</strong>.
              </p>
            </div>

            <form id="admin-save-question-form" class="space-y-4">
              <div class="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
                <span class="font-bold text-slate-700">Selected Subject:</span>
                <span class="px-2.5 py-0.5 rounded-lg bg-[#4F46E5] text-white font-extrabold">
                  ${this.selectedCropSubjectName} (No Chapter Required)
                </span>
              </div>

              <div>
                <label for="wb-prompt-input" class="block text-xs font-bold text-slate-700 mb-1">
                  Optional Question Label / Tag
                </label>
                <input
                  id="wb-prompt-input"
                  type="text"
                  required
                  value="${this.escapeHtml(this.questionPromptText)}"
                  placeholder="e.g., ${this.selectedCropSubjectName} High-Yield Mock Problem"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-900"
                />
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
                  <div class="text-xs font-bold text-slate-700">Select Correct Option Key (A / B / C / D)</div>
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
                Save Cropped ${this.selectedCropSubjectName} Question & Prepare Next →
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
                              <span class="font-bold text-[#4F46E5]">[${aq.type} · ${this.escapeHtml(aq.subjectName)} · ${this.escapeHtml(aq.classCohort || 'Class 12')}]</span>
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
    const syllabusTopics = dataStore.getSyllabusTopics();

    return `
      <div class="space-y-6">
        <!-- Syllabus Chapters & Exam Weightage Manager -->
        <section
          data-testid="admin-syllabus-weightage-manager"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span class="px-2.5 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] text-xs font-extrabold uppercase tracking-wider">
                Syllabus Progress & Infinite Practice Chapter Bank
              </span>
              <h2 class="text-lg font-extrabold text-slate-900 mt-1">
                Manage Syllabus Chapters & Exam Weightage (${syllabusTopics.length} Chapters)
              </h2>
              <p class="text-xs text-slate-500">
                Add chapters and set their official JEE/NEET exam weightage. Every chapter added here automatically appears in the Student Syllabus Tracker and CBT Infinite Practice (with 100 P&amp;C questions per chapter).
              </p>
            </div>
          </div>

          <form
            id="admin-add-syllabus-topic-form"
            data-testid="admin-add-syllabus-topic-form"
            class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]"
          >
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
              <select
                id="syl-topic-subject"
                data-testid="syl-topic-subject"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-extrabold text-slate-900"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Math">Math</option>
                <option value="Biology">Biology</option>
              </select>
            </div>

            <div class="sm:col-span-4">
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Chapter / Topic Name</label>
              <input
                id="syl-topic-chapter-name"
                data-testid="syl-topic-chapter-name"
                type="text"
                required
                placeholder="e.g., Wave Optics & Interference"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-900"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Exam Weightage</label>
              <input
                id="syl-topic-weightage"
                data-testid="syl-topic-weightage"
                type="text"
                required
                value="10% Weightage"
                placeholder="e.g., 10% Weightage"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono-tabular font-bold text-[#4F46E5]"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Exam Track &amp; Hrs</label>
              <div class="flex gap-1.5">
                <select
                  id="syl-topic-exam"
                  data-testid="syl-topic-exam"
                  class="flex-1 min-h-[40px] px-2 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-slate-900"
                >
                  <option value="JEE">JEE</option>
                  <option value="NEET">NEET</option>
                </select>
                <input
                  id="syl-topic-hours"
                  type="number"
                  min="2"
                  max="60"
                  value="12"
                  title="Estimated Hours"
                  class="w-16 min-h-[40px] px-2 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono-tabular font-bold text-slate-900"
                />
              </div>
            </div>

            <div class="sm:col-span-2">
              <button
                type="submit"
                data-testid="admin-add-syllabus-btn"
                class="w-full min-h-[40px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                + Add Chapter
              </button>
            </div>
          </form>

          <!-- Existing Syllabus Chapters & Inline Weightage Editor -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
            ${syllabusTopics
              .map(
                (t) => `
              <div
                data-testid="admin-syllabus-topic-row"
                class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 text-xs"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-extrabold text-[10px]">
                      ${this.escapeHtml(t.subject)} · ${this.escapeHtml((t.examTypes ?? ['JEE']).join('/'))}
                    </span>
                    <span class="font-bold text-slate-900 truncate">${this.escapeHtml(t.chapterName)}</span>
                  </div>
                  <div class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>Est: ${t.estimatedHours}h</span>
                    <span>·</span>
                    <span class="text-emerald-700 font-semibold">100 P&amp;C Qs Ready</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    value="${this.escapeHtml(t.weightageLabel)}"
                    data-syllabus-weightage-input="${t.id}"
                    aria-label="Weightage for ${this.escapeHtml(t.chapterName)}"
                    class="w-28 min-h-[32px] px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono-tabular text-[11px] font-bold text-[#4F46E5]"
                  />
                  <button
                    type="button"
                    data-action="save-syllabus-weightage"
                    data-id="${t.id}"
                    class="min-h-[32px] px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#10B981] font-extrabold text-[11px] cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    data-action="del-syllabus-topic"
                    data-id="${t.id}"
                    class="min-h-[32px] px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#EF4444] font-bold text-[11px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

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
    const groupSchedule = dataStore.getGroupCallSchedule();
    return `
      <div data-testid="admin-chat-centre" class="space-y-6">
        <!-- Multi-Student Group Call Time Slot Scheduler -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-500/30 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                👥 Multi-Student Scheduled Group Call Slot · Saved to Firebase
              </span>
              <h2 class="text-base sm:text-lg font-extrabold mt-1">
                Schedule Group Mentorship Call Time (Multiple Students Join Together)
              </h2>
              <p class="text-xs text-slate-300">
                Set a time slot below. At this scheduled time, multiple students can join the shared Jitsi call room simultaneously.
              </p>
            </div>
            <div class="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono-tabular">
              Joined Students: <strong class="text-emerald-300">${groupSchedule.joinedStudents.length}</strong> · Time: <strong class="text-amber-300">${this.escapeHtml(groupSchedule.scheduledTime)}</strong>
            </div>
          </div>

          <form id="admin-group-call-form" data-testid="admin-group-call-form" class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div class="sm:col-span-5">
              <label class="block text-[11px] font-bold text-indigo-200 mb-1">Group Session Title</label>
              <input
                id="group-call-title-input"
                type="text"
                required
                value="${this.escapeHtml(groupSchedule.title)}"
                placeholder="e.g., Evening JEE/NEET Strategy & Doubt Room"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold placeholder:text-slate-400"
              />
            </div>
            <div class="sm:col-span-4">
              <label class="block text-[11px] font-bold text-indigo-200 mb-1">Scheduled Call Time (For All Students)</label>
              <input
                id="group-call-time-input"
                type="text"
                required
                value="${this.escapeHtml(groupSchedule.scheduledTime)}"
                placeholder="e.g., Today, 08:30 PM IST"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-mono-tabular font-bold placeholder:text-slate-400"
              />
            </div>
            <div class="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                data-testid="save-group-call-slot-btn"
                class="flex-1 min-h-[40px] px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                💾 Save Time Slot
              </button>
              <button
                type="button"
                data-action="admin-join-jitsi"
                data-room="${this.escapeHtml(groupSchedule.jitsiRoom)}"
                data-student="Group Session (${groupSchedule.joinedStudents.length} Students)"
                class="min-h-[40px] px-3 py-2 rounded-xl bg-white text-slate-900 text-xs font-extrabold cursor-pointer"
              >
                🎥 Host
              </button>
            </div>
          </form>
        </div>

        <!-- Admin 1:1 Student Chat Centre & Appointment Approval Desk -->
        <div class="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-extrabold text-slate-900">
                Admin Chat Centre · Student Media, Doubts & Appointment Approvals
              </h2>
              <p class="text-xs text-slate-500">
                Review student images, videos, files, and appointment requests. Accept an appointment and assign a call time to unlock calling for that student.
              </p>
            </div>
            <span class="px-3 py-1 rounded-xl bg-indigo-50 text-[#4F46E5] text-xs font-mono-tabular font-bold">
              ${sessions.length} Active Student Threads
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            ${sessions
              .map((s) => {
                const apptStatus = s.appointmentStatus || 'NONE';
                return `
              <div class="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 flex flex-col justify-between">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-extrabold text-slate-900">${this.escapeHtml(s.studentName)}</span>
                        ${
                          apptStatus === 'PENDING'
                            ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold">⏳ PENDING APPOINTMENT</span>`
                            : apptStatus === 'ACCEPTED'
                              ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold">✓ ACCEPTED · ${this.escapeHtml(s.scheduledCallTime || '')}</span>`
                              : apptStatus === 'REJECTED'
                                ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold">✕ REJECTED</span>`
                                : ''
                        }
                      </div>
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
                        class="px-2.5 py-1 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-[11px] font-extrabold shadow-2xs cursor-pointer"
                      >
                        🎥 Join Call
                      </button>
                    </div>
                  </div>

                  <!-- Admin Appointment Accept / Reject + Time Setter Control Bar -->
                  <div class="p-3 rounded-xl ${
                    apptStatus === 'PENDING'
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-white border border-[#E2E8F0]'
                  } space-y-2">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-extrabold text-slate-800">
                        📅 Call Appointment Control ${
                          s.requestedCallTime
                            ? `(Requested: ${this.escapeHtml(s.requestedCallTime)})`
                            : ''
                        }
                      </span>
                      <span class="font-mono-tabular font-bold ${
                        apptStatus === 'ACCEPTED'
                          ? 'text-emerald-700'
                          : apptStatus === 'PENDING'
                            ? 'text-amber-800'
                            : 'text-slate-500'
                      }">Status: ${apptStatus}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <input
                        id="admin-appt-time-${s.id}"
                        data-testid="admin-appt-time-input-${s.id}"
                        type="text"
                        value="${this.escapeHtml(s.scheduledCallTime || s.requestedCallTime || 'Today, 07:30 PM IST')}"
                        placeholder="Set Call Time (e.g., 07:30 PM IST)"
                        class="flex-1 min-w-[140px] min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-mono-tabular font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        data-action="admin-accept-appointment"
                        data-session-id="${s.id}"
                        data-testid="admin-accept-appt-btn-${s.id}"
                        class="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-[11px] font-extrabold cursor-pointer"
                      >
                        ✓ Accept & Set Time
                      </button>
                      <button
                        type="button"
                        data-action="admin-reject-appointment"
                        data-session-id="${s.id}"
                        data-testid="admin-reject-appt-btn-${s.id}"
                        class="min-h-[32px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>

                  <!-- Chat Messages & Attachments History -->
                  <div class="space-y-2 max-h-48 overflow-y-auto bg-white p-3 rounded-xl border border-[#E2E8F0]">
                    ${s.messages
                      .map(
                        (m) => `
                      <div class="text-xs space-y-1 pb-1.5 border-b border-slate-50 last:border-b-0">
                        <div>
                          <strong class="${m.senderRole === 'admin' ? 'text-[#4F46E5]' : 'text-slate-900'}">${this.escapeHtml(m.senderName)}:</strong>
                          <span class="text-slate-600"> ${this.escapeHtml(m.text)}</span>
                        </div>
                        ${
                          m.attachmentType === 'IMAGE' && m.attachmentUrl
                            ? `<img src="${this.escapeHtml(m.attachmentUrl)}" alt="${this.escapeHtml(m.attachmentName || 'Image')}" class="max-h-24 rounded-lg border border-slate-200 object-contain" />`
                            : m.attachmentType === 'VIDEO' && m.attachmentUrl
                              ? `<video src="${this.escapeHtml(m.attachmentUrl)}" controls class="max-h-28 rounded-lg border border-slate-200"></video>`
                              : m.attachmentType === 'FILE' && m.attachmentUrl
                                ? `<a href="${this.escapeHtml(m.attachmentUrl)}" download="${this.escapeHtml(m.attachmentName || 'file')}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[#4F46E5] text-[10px] font-bold">📎 ${this.escapeHtml(m.attachmentName || 'Attached File')}</a>`
                                : ''
                        }
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
                    class="px-3.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold cursor-pointer"
                  >
                    Reply
                  </button>
                </form>
              </div>
            `;
              })
              .join('')}
          </div>
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
        `${this.defaultMockExamTrack} · ${this.defaultMockClassCohort.toUpperCase()} · ${this.selectedCropSubjectName.toUpperCase()}`,
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
    ctx.fillStyle = '#10B981';
    ctx.fillRect(b2x + b2w - 16, b2y + b2h - 16, 16, 16);

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
        this.callbacks.onAuthUpdated();
        this.rerender();
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

    // Step 1 Default Mock Test Metadata Controls (Class/Foundation, Exam Track, Mock Test Title)
    const defaultCohortSelect = this.containerEl.querySelector<HTMLSelectElement>(
      '#wb-default-cohort-select'
    );
    defaultCohortSelect?.addEventListener('change', () => {
      this.defaultMockClassCohort = defaultCohortSelect.value as StudentClassYear;
      this.drawDualCropCanvases();
    });

    const defaultExamSelect = this.containerEl.querySelector<HTMLSelectElement>(
      '#wb-default-exam-select'
    );
    defaultExamSelect?.addEventListener('change', () => {
      this.defaultMockExamTrack = defaultExamSelect.value as TargetExam;
      this.drawDualCropCanvases();
    });

    const defaultMockTitleInput = this.containerEl.querySelector<HTMLInputElement>(
      '#wb-default-mock-title'
    );
    defaultMockTitleInput?.addEventListener('input', () => {
      if (defaultMockTitleInput.value.trim()) {
        this.defaultMockTestTitle = defaultMockTitleInput.value.trim();
      }
    });

    // Save & Next Cropped Question + Solution Form (Subject-Only, No Chapter Required)
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

      const correctVal =
        this.questionType === 'MCQ'
          ? this.singleMcqAnswer
          : this.questionType === 'NUMERICAL'
            ? this.numericalAnswer
            : Array.from(this.multiMcqAnswers).sort().join(',');

      await dataStore.addAdminQuestion({
        classId: this.selectedClassId,
        subjectId: `sub_${this.selectedCropSubjectName.toLowerCase()}`,
        subjectName: this.selectedCropSubjectName,
        classCohort: this.defaultMockClassCohort as StudentClassYear,
        targetExam: this.defaultMockExamTrack as TargetExam,
        mockTestTitle: this.defaultMockTestTitle,
        chapterName: `${this.selectedCropSubjectName} · ${this.defaultMockTestTitle}`,
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
        `Saved ${this.selectedCropSubjectName} Question #${this.savedCountInSession} (${this.defaultMockClassCohort}) to Firebase!`
      );
      this.rerender();
    });

    // Multi-Student Scheduled Group Call Form
    const groupCallForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-group-call-form'
    );
    groupCallForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title =
        groupCallForm
          .querySelector<HTMLInputElement>('#group-call-title-input')
          ?.value.trim() || 'Evening JEE/NEET Group Strategy & Doubt Session';
      const scheduledTime =
        groupCallForm
          .querySelector<HTMLInputElement>('#group-call-time-input')
          ?.value.trim() || 'Today, 08:00 PM IST';
      await dataStore.saveGroupCallSchedule({
        title,
        scheduledTime,
        isActive: true,
      });
      this.callbacks.onShowToast(
        `Saved Multi-Student Group Call Slot for "${scheduledTime}" to Firebase!`
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

    // Syllabus Chapters & Exam Weightage Form
    const addSylTopicForm = this.containerEl.querySelector<HTMLFormElement>(
      '#admin-add-syllabus-topic-form'
    );
    addSylTopicForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject =
        (addSylTopicForm.querySelector<HTMLSelectElement>('#syl-topic-subject')
          ?.value as SubjectName) ?? 'Physics';
      const chapterName =
        addSylTopicForm
          .querySelector<HTMLInputElement>('#syl-topic-chapter-name')
          ?.value.trim() ?? '';
      const weightageLabel =
        addSylTopicForm
          .querySelector<HTMLInputElement>('#syl-topic-weightage')
          ?.value.trim() || '8% Weightage';
      const targetExam =
        (addSylTopicForm.querySelector<HTMLSelectElement>('#syl-topic-exam')
          ?.value as TargetExam) ?? 'JEE';
      const estimatedHours =
        Number(
          addSylTopicForm.querySelector<HTMLInputElement>('#syl-topic-hours')
            ?.value
        ) || 12;
      if (!chapterName) return;

      await dataStore.addSyllabusTopic({
        subject,
        chapterName,
        weightageLabel,
        estimatedHours,
        examTypes: [targetExam],
      });
      this.callbacks.onShowToast(
        `Added "${chapterName}" (${weightageLabel}) to ${subject} Syllabus & 100-Q P&C Bank!`
      );
      this.rerender();
    });

    // Material PDF File Input & Uploader Form
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
          case 'wb-select-subject-only': {
            const subj = el.dataset.subject as SubjectName;
            if (subj) {
              this.selectedCropSubjectName = subj;
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
                  : 'Mentor set to OFFLINE — Direct calls locked unless student has an Accepted Appointment.'
              );
              this.rerender();
            }
            break;
          }
          case 'admin-accept-appointment': {
            const sessionId = el.dataset.sessionId;
            if (sessionId) {
              const timeInput = this.containerEl?.querySelector<HTMLInputElement>(
                `#admin-appt-time-${sessionId}`
              );
              const scheduledTime =
                timeInput?.value.trim() || 'Today, 07:30 PM IST';
              await dataStore.respondToMentorshipAppointment(
                sessionId,
                'ACCEPTED',
                scheduledTime
              );
              this.callbacks.onShowToast(
                `Appointment ACCEPTED for ${scheduledTime} — Call unlocked for student!`
              );
              this.rerender();
            }
            break;
          }
          case 'admin-reject-appointment': {
            const sessionId = el.dataset.sessionId;
            if (sessionId) {
              await dataStore.respondToMentorshipAppointment(
                sessionId,
                'REJECTED'
              );
              this.callbacks.onShowToast('Appointment marked as REJECTED.');
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
          case 'save-syllabus-weightage': {
            const topicId = el.dataset.id;
            if (topicId) {
              const wInput = this.containerEl?.querySelector<HTMLInputElement>(
                `[data-syllabus-weightage-input="${topicId}"]`
              );
              const nextWeightage = wInput?.value.trim() || '8% Weightage';
              await dataStore.updateSyllabusTopic(topicId, {
                weightageLabel: nextWeightage,
              });
              this.callbacks.onShowToast(
                `Updated chapter exam weightage to "${nextWeightage}"!`
              );
              this.rerender();
            }
            break;
          }
          case 'del-syllabus-topic': {
            const topicId = el.dataset.id;
            if (topicId) {
              await dataStore.deleteSyllabusTopic(topicId);
              this.callbacks.onShowToast('Removed chapter from syllabus');
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

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
