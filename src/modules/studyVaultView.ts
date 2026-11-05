import { getCohortTheme } from '../constants';
import { dataStore } from '../services/firebaseService';
import {
  signInWithGoogleWorkspace,
  workspaceConnector,
} from '../services/workspaceService';
import type { StudyMaterialItem, SubjectName } from '../types';
import { formatDuration } from '../utils/examLogic';

export interface StudyVaultCallbacks {
  onShowToast: (message: string) => void;
}

export class StudyVaultModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: StudyVaultCallbacks;
  private selectedCohort = 'ALL';
  private selectedSubjectName = 'ALL';
  private activeOpenedSection: string | null = null; // null = Section Directory Hub, string = Dedicated Section Page
  private searchQuery = '';

  // Pomodoro Focus Timer State
  private focusSubject: SubjectName = 'Physics';
  private focusModeMinutes = 25;
  private focusModeLabel = '25m Classic Pomodoro';
  private focusRemainingSeconds = 25 * 60;
  private isFocusRunning = false;
  private focusIntervalId: number | null = null;

  // Google Classroom & Calendar/Tasks Sync State
  private isFetchingClassroom = false;
  private isSyncingCalendarTasks = false;
  private isWorkspaceSyncConfirmOpen = false;

  // In-App Secure PDF Viewer Modal State
  private previewMaterial: StudyMaterialItem | null = null;
  private editingMaterial: StudyMaterialItem | null = null;
  private currentPageIndex = 0;
  private zoomPercent = 100;

  constructor(callbacks: StudyVaultCallbacks) {
    this.callbacks = callbacks;
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const params = new URLSearchParams(window.location.search);
    const secParam = params.get('section');
    if (secParam) {
      this.activeOpenedSection = secParam;
    }
    this.rerender();
  }

  private getSectionStyle(sectionName: string, index: number) {
    const palettes = [
      {
        gradient: 'from-indigo-50 via-white to-violet-50',
        headerGrad: 'from-indigo-600 via-violet-600 to-blue-600',
        border: 'border-indigo-200 hover:border-[#4F46E5]',
        badge: 'bg-[#4F46E5] text-white',
        text: 'text-[#4F46E5]',
        desc: 'Chapter-wise Archive Papers with Official Step-by-Step Solutions',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      },
      {
        gradient: 'from-emerald-50 via-white to-teal-50',
        headerGrad: 'from-emerald-600 via-teal-600 to-cyan-600',
        border: 'border-emerald-200 hover:border-[#10B981]',
        badge: 'bg-[#10B981] text-white',
        text: 'text-[#10B981]',
        desc: 'Rapid Revision Formula Handbooks, Dimensional Charts & Shortcuts',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
      },
      {
        gradient: 'from-amber-50 via-white to-orange-50',
        headerGrad: 'from-amber-500 via-orange-500 to-rose-500',
        border: 'border-amber-200 hover:border-[#F59E0B]',
        badge: 'bg-[#F59E0B] text-white',
        text: 'text-amber-700',
        desc: 'AIR Topper Hand-written Classroom Notes, Mechanisms & Diagrams',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
      },
      {
        gradient: 'from-rose-50 via-white to-pink-50',
        headerGrad: 'from-rose-600 via-pink-600 to-purple-600',
        border: 'border-rose-200 hover:border-[#EF4444]',
        badge: 'bg-[#EF4444] text-white',
        text: 'text-[#EF4444]',
        desc: 'Daily Practice Problems (DPPs) with Timed Target Sets & Answer Keys',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
      },
    ];
    if (sectionName === 'PYQs') return palettes[0];
    if (sectionName === 'Formula Sheets') return palettes[1];
    if (sectionName === 'Hand-written Notes') return palettes[2];
    if (sectionName === 'DPPs') return palettes[3];
    return palettes[index % palettes.length];
  }

  private matchesCohortFilter(mat: StudyMaterialItem, classes: { id: string; name: string }[]): boolean {
    if (this.selectedCohort === 'ALL') return true;
    const clsObj = classes.find((c) => c.id === mat.classId);
    const clsName = clsObj?.name || '';
    const cohortTag = mat.cohortTag || '';
    const titleUpper = mat.title.toUpperCase();

    if (this.selectedCohort === 'JEE') {
      return (
        cohortTag === 'JEE' ||
        titleUpper.includes('JEE') ||
        (cohortTag !== 'NEET' && clsName !== 'Class 9' && clsName !== 'Class 10')
      );
    }
    if (this.selectedCohort === 'NEET') {
      return (
        cohortTag === 'NEET' ||
        titleUpper.includes('NEET') ||
        titleUpper.includes('NCERT') ||
        mat.subjectId.includes('bio')
      );
    }
    return clsName === this.selectedCohort || cohortTag === this.selectedCohort;
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const sections = dataStore.getVaultSections();
    const allMaterials = dataStore.getMaterials();

    const uniqueSubjectNames = Array.from(new Set(subjects.map((s) => s.name)));

    const filteredMaterials = allMaterials.filter((mat) => {
      if (!this.matchesCohortFilter(mat, classes)) return false;
      if (this.selectedSubjectName !== 'ALL') {
        const subObj = subjects.find((s) => s.id === mat.subjectId);
        if (subObj?.name !== this.selectedSubjectName) return false;
      }
      if (this.activeOpenedSection && mat.section !== this.activeOpenedSection) {
        return false;
      }
      if (this.searchQuery.trim() !== '') {
        const q = this.searchQuery.toLowerCase();
        if (
          !mat.title.toLowerCase().includes(q) &&
          !mat.section.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    if (!this.activeOpenedSection) {
      // =========================================================================
      // VIEW 1: STUDY VAULT SECTION DIRECTORY HUB (/study.html)
      // Clicking any section opens a dedicated page for that section!
      // =========================================================================
      this.containerEl.innerHTML = `
        <div class="space-y-6" data-testid="study-vault-directory-page">
          <!-- Class-Specific Vault Banner -->
          <section
            aria-label="Study Material Vault Banner"
            class="rounded-2xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div class="space-y-1.5">
              <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold uppercase tracking-wider">
                📚 ${this.escapeHtml(cohortTheme.label)} · Study Material Vault
              </span>
              <h1 class="text-xl sm:text-2xl font-extrabold">
                Select a Study Vault Section to Open Its Dedicated Page
              </h1>
              <p class="text-xs sm:text-sm text-white/90">
                Click any section card below (PYQs, Formula Sheets, Hand-written Notes, or DPPs) to open a dedicated full-screen page with compact wide PDFs.
              </p>
            </div>
            <div class="shrink-0 bg-white/15 border border-white/25 rounded-2xl px-4 py-3 text-center">
              <div class="text-2xl font-mono-tabular font-extrabold">${allMaterials.length}</div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-white/90">Verified PDFs</div>
            </div>
          </section>

          <!-- Dedicated Section Folder Cards Grid -->
          <section aria-label="Study Material Sections" class="space-y-3">
            <div class="flex items-center justify-between px-1">
              <h2 class="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                Study Vault Sections (${sections.length} Categories) — Click Any Section to Open New Page
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="vault-section-folders">
              ${sections
                .map((sec, idx) => {
                  const st = this.getSectionStyle(sec, idx);
                  const secMaterials = allMaterials.filter((m) => m.section === sec);

                  return `
                    <button
                      type="button"
                      data-action="open-section-folder"
                      data-section="${this.escapeHtml(sec)}"
                      class="text-left rounded-2xl p-5 bg-gradient-to-br ${st.gradient} border-2 ${st.border} shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group cursor-pointer"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="w-11 h-11 rounded-2xl ${st.badge} flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                          ${st.icon}
                        </span>
                        <span class="px-2.5 py-1 rounded-full bg-white border border-slate-200 font-mono-tabular text-xs font-extrabold ${st.text}">
                          ${secMaterials.length} PDFs
                        </span>
                      </div>
                      <div class="space-y-1.5">
                        <div class="text-base sm:text-lg font-extrabold text-slate-900 flex items-center justify-between">
                          <span>${this.escapeHtml(sec)}</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">
                          ${st.desc}
                        </p>
                      </div>
                      <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-extrabold ${st.text}">
                        <span>Open ${this.escapeHtml(sec)} Page</span>
                        <span class="group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </button>
                  `;
                })
                .join('')}
              </div>
            </section>

            <!-- Google Classroom Resources & Assignment Connector + Google Calendar/Tasks Multi-Device Sync Hub -->
            ${this.renderGoogleClassroomAndCalendarSyncHub()}

            <!-- In-App Secure PDF Viewer Modal -->
            ${this.renderSecurePdfModal()}
            <!-- Edit PDF Study Material Modal (Master Admin Only) -->
            ${dataStore.isMasterAdmin() ? this.renderEditMaterialModal() : ''}
            <!-- Explicit User Confirmation Modal for Mutating Google Calendar & Tasks Sync -->
            ${this.renderWorkspaceSyncConfirmModal()}
          </div>
        `;

      this.bindEvents();
      return;
    }

    // =========================================================================
    // VIEW 2: DEDICATED SECTION PAGE (/study.html?section=PYQs)
    // =========================================================================
    const activeSecStyle = this.getSectionStyle(this.activeOpenedSection, 0);
    const isAdmin = dataStore.isMasterAdmin();

    this.containerEl.innerHTML = `
      <div class="space-y-5" data-testid="study-vault-dedicated-section-page">
        <!-- Dedicated Section Page Hero Header with Back Button -->
        <section
          aria-label="Dedicated Section Page Header"
          class="rounded-2xl bg-gradient-to-r ${activeSecStyle.headerGrad} text-white p-5 sm:p-6 shadow-md space-y-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              data-action="close-section-view"
              data-testid="back-to-all-sections-btn"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>← Back to All Study Vault Sections</span>
            </button>

            <span class="px-3 py-1 rounded-full bg-white/20 text-xs font-mono-tabular font-extrabold">
              ${filteredMaterials.length} PDFs in ${this.escapeHtml(this.activeOpenedSection)}
            </span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-white/80">
                Dedicated Section Page · ${this.escapeHtml(cohortTheme.label)}
              </span>
              <h1 class="text-xl sm:text-2xl font-extrabold mt-0.5">
                ${this.escapeHtml(this.activeOpenedSection)} — Complete PDF Archive
              </h1>
              <p class="text-xs sm:text-sm text-white/90 mt-1">
                ${activeSecStyle.desc}
              </p>
            </div>

            <input
              id="vault-search-input"
              type="search"
              value="${this.escapeHtml(this.searchQuery)}"
              placeholder="Search inside ${this.escapeHtml(this.activeOpenedSection)}..."
              aria-label="Search study materials"
              class="min-h-[40px] px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none w-full sm:w-64 shadow-sm"
            />
          </div>
        </section>

        <!-- Subject Filter Bar for Dedicated Section Page -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            ${(['ALL', ...uniqueSubjectNames] as const)
              .map(
                (subName) => `
              <button
                type="button"
                data-action="filter-subject-name"
                data-subject="${subName}"
                class="min-h-[34px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                  this.selectedSubjectName === subName
                    ? 'bg-[#4F46E5] text-white shadow-2xs'
                    : 'bg-[#F8FAFC] border border-[#E2E8F0] text-slate-600 hover:bg-slate-100'
                }"
              >
                ${subName === 'ALL' ? 'All Subjects' : subName}
              </button>
            `
              )
              .join('')}
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            ${sections
              .map(
                (sec) => `
              <button
                type="button"
                data-action="open-section-folder"
                data-section="${this.escapeHtml(sec)}"
                class="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
                  this.activeOpenedSection === sec
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }"
              >
                ${this.escapeHtml(sec)}
              </button>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- COMPACT-HEIGHT, WIDE HORIZONTAL PDF ROW LIST -->
        <section
          aria-label="Compact Wide Study Material PDF List"
          data-testid="compact-pdf-list"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-4 shadow-sm space-y-2"
        >
          <div class="flex items-center justify-between px-2 py-1 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
              <span class="text-xs font-extrabold text-slate-800">
                ${this.escapeHtml(this.activeOpenedSection)} — Study Material PDFs
              </span>
            </div>
            <span class="text-[11px] font-mono-tabular text-slate-500">
              ${filteredMaterials.length} PDFs
            </span>
          </div>

          ${
            filteredMaterials.length === 0
              ? `
            <div class="p-8 text-center space-y-3">
              <div class="text-sm font-bold text-slate-900">No PDFs uploaded in ${this.escapeHtml(this.activeOpenedSection)} yet</div>
              <p class="text-xs text-slate-500 max-w-md mx-auto">
                New verified ${this.escapeHtml(this.activeOpenedSection)} PDFs will appear here as soon as they are published, or you can import resources from Google Classroom below.
              </p>
              <button
                type="button"
                data-action="reset-vault-filters"
                class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold"
              >
                Reset Section Filter
              </button>
            </div>
          `
              : `
            <div class="divide-y divide-slate-100">
              ${filteredMaterials
                .map((mat, idx) => {
                  const clsObj = classes.find((c) => c.id === mat.classId);
                  const subObj = subjects.find((s) => s.id === mat.subjectId);
                  const st = this.getSectionStyle(mat.section, idx);
                  const subName = subObj?.name ?? 'Physics';
                  const cohortLabel = mat.cohortTag || clsObj?.name || 'JEE';

                  return `
                    <article
                      data-testid="compact-pdf-row"
                      class="py-2.5 px-2.5 sm:px-3.5 hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-emerald-50/30 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <!-- Left: Compact PDF Icon + Wide Title + Inline Badges -->
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div class="w-9 h-9 rounded-xl ${st.badge} flex items-center justify-center text-[10px] font-mono-tabular font-extrabold shrink-0 shadow-2xs">
                          PDF
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                              ${this.escapeHtml(mat.title)}
                            </h3>
                          </div>
                          <div class="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px]">
                            <span class="px-1.5 py-0.2 rounded font-bold bg-indigo-50 text-[#4F46E5]">
                              ${this.escapeHtml(mat.section)}
                            </span>
                            <span class="px-1.5 py-0.2 rounded font-bold bg-emerald-50 text-[#10B981]">
                              ${this.escapeHtml(subName)}
                            </span>
                            <span class="px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-800">
                              ${this.escapeHtml(cohortLabel)}
                            </span>
                            <span class="text-slate-400 font-mono-tabular">
                              · ${mat.pagesCount}p · ${mat.downloads} dl
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Right: Compact Action Buttons (Preview & Download for Students; Edit PDF strictly for Master Admin) -->
                      <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          data-action="preview-material"
                          data-material-id="${mat.id}"
                          class="min-h-[34px] px-3 py-1 rounded-lg bg-[#4F46E5] hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Preview
                        </button>
                        ${
                          isAdmin
                            ? `
                          <button
                            type="button"
                            data-action="open-edit-material"
                            data-material-id="${mat.id}"
                            data-testid="edit-pdf-material-btn"
                            class="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            ✏️ Edit PDF
                          </button>
                        `
                            : ''
                        }
                        <button
                          type="button"
                          data-action="download-material"
                          data-material-id="${mat.id}"
                          class="min-h-[34px] px-3 py-1 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          ⬇ PDF
                        </button>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </section>

        <!-- Google Classroom Resources & Assignment Connector + Google Calendar/Tasks Multi-Device Sync Hub -->
        ${this.renderGoogleClassroomAndCalendarSyncHub()}

        <!-- In-App Secure PDF Viewer Modal -->
        ${this.renderSecurePdfModal()}
        <!-- Edit PDF Study Material Modal -->
        ${this.renderEditMaterialModal()}
        <!-- Explicit User Confirmation Modal for Mutating Google Calendar & Tasks Sync -->
        ${this.renderWorkspaceSyncConfirmModal()}
      </div>
    `;

    this.bindEvents();
  }

  private renderGoogleClassroomAndCalendarSyncHub(): string {
    const user = dataStore.getUser();
    const classroomItems = workspaceConnector.getClassroomResources(
      user.classYear,
      user.targetExam
    );
    const syncRecords = workspaceConnector.getScheduleSyncRecords();
    const hasToken = workspaceConnector.hasLiveToken();
    const lastClassroomSync = workspaceConnector.getLastClassroomSyncTime();
    const lastScheduleSync = workspaceConnector.getLastCalendarTasksSyncTime();

    return `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <!-- LEFT 7 COLS: Google Classroom Resource & Assignment Connector -->
        <section
          aria-label="Google Classroom Resource and Assignment Connector"
          data-testid="classroom-connector-panel"
          class="xl:col-span-7 bg-white border-2 border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
                  🎓 Google Classroom Connector · Study Vault Direct Sync
                </span>
                <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono-tabular text-[10px] font-bold" data-testid="classroom-sync-status-badge">
                  ${hasToken ? '✓ OAuth Connected' : 'Connector Ready'} · ${this.escapeHtml(lastClassroomSync)}
                </span>
              </div>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Google Classroom Resources & Assignment Updates
              </h2>
              <p class="text-xs text-slate-600">
                Fetch active classwork materials, teacher announcements, and graded assignments directly into your Study Vault and Study Planner.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              ${
                !hasToken
                  ? `
                <button
                  type="button"
                  data-action="workspace-google-signin"
                  data-testid="classroom-google-signin-btn"
                  class="gsi-material-button min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span class="gsi-material-button-contents">Sign in with Google</span>
                </button>
              `
                  : ''
              }
              <button
                type="button"
                data-action="fetch-classroom-feed"
                data-testid="classroom-fetch-btn"
                ${this.isFetchingClassroom ? 'disabled' : ''}
                class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                ${this.isFetchingClassroom ? '⏳ Fetching Classroom...' : '🔄 Fetch Classroom Updates'}
              </button>
            </div>
          </div>

          <div class="space-y-2.5" data-testid="classroom-resources-list">
            ${classroomItems
              .map(
                (item) => `
              <article
                data-testid="classroom-resource-card"
                class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div class="space-y-1 min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                      item.itemType === 'ASSIGNMENT'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-indigo-100 text-[#4F46E5] border border-indigo-200'
                    }">
                      ${item.itemType === 'ASSIGNMENT' ? '📝 Assignment Update' : '📚 Class Resource'}
                    </span>
                    <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      ${this.escapeHtml(item.subjectTag)} · ${this.escapeHtml(item.vaultCategory)}
                    </span>
                    <span class="text-[11px] font-mono-tabular text-emerald-700 font-bold">
                      ${this.escapeHtml(item.dueDateText)}
                    </span>
                  </div>
                  <h3 class="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                    ${this.escapeHtml(item.title)}
                  </h3>
                  <p class="text-[11px] text-slate-600 line-clamp-2">
                    ${this.escapeHtml(item.description)}
                  </p>
                  <div class="text-[10px] font-semibold text-slate-500">
                    Course: <strong>${this.escapeHtml(item.courseName)}</strong>
                    ${item.driveFileTitle ? ` · Attachment: <code class="text-[#4F46E5]">${this.escapeHtml(item.driveFileTitle)}</code>` : ''}
                  </div>
                </div>

                <div class="flex sm:flex-col items-center sm:items-end justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-action="import-classroom-item"
                    data-item-id="${item.id}"
                    data-testid="classroom-import-vault-btn"
                    ${item.importedToVault ? 'disabled' : ''}
                    class="min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                      item.importedToVault
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                        : 'bg-[#4F46E5] hover:bg-indigo-700 text-white shadow-2xs'
                    }"
                  >
                    ${item.importedToVault ? '✓ In Study Vault' : '+ Import to Vault'}
                  </button>
                </div>
              </article>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- RIGHT 5 COLS: Google Calendar & Google Tasks Multi-Device Schedule Sync Service Layer -->
        <section
          aria-label="Google Calendar and Google Tasks Sync Service"
          data-testid="workspace-calendar-tasks-sync-panel"
          class="xl:col-span-5 bg-white border-2 border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4"
        >
          <div class="space-y-3">
            <div class="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] border border-indigo-200 text-[10px] font-extrabold uppercase tracking-wider">
                    📅 Google Calendar + Tasks API Sync
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono-tabular text-[10px] font-bold" data-testid="schedule-sync-status-badge">
                    ${this.escapeHtml(lastScheduleSync)}
                  </span>
                </div>
                <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                  Multi-Device Study Schedule & Task Sync
                </h2>
                <p class="text-xs text-slate-600">
                  Automatically mirror your daily study blocks, backlog micro-tasks, and Classroom assignment deadlines to Google Calendar & Google Tasks across all devices.
                </p>
              </div>
            </div>

            <div class="space-y-2 max-h-[260px] overflow-y-auto pr-1" data-testid="workspace-synced-schedule-list">
              ${syncRecords
                .map(
                  (rec) => `
                <div class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 text-xs">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-[#4F46E5] text-[10px] font-extrabold">
                        ${this.escapeHtml(rec.subject)}
                      </span>
                      <span class="font-mono-tabular text-[10px] text-slate-500">
                        ${this.escapeHtml(rec.scheduledDateIso)} · ${this.escapeHtml(rec.scheduledTimeSlot)}
                      </span>
                    </div>
                    <div class="font-bold text-slate-900 truncate mt-0.5">
                      ${this.escapeHtml(rec.title)}
                    </div>
                  </div>
                  <div class="flex flex-col items-end shrink-0 text-[10px] font-mono-tabular">
                    <span class="text-emerald-700 font-extrabold">✓ Calendar + Tasks</span>
                    <span class="text-slate-400">${this.escapeHtml(rec.lastSyncedAt)}</span>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] text-slate-500 font-semibold">
              ${syncRecords.length} Study Events & Tasks Queued
            </span>
            <button
              type="button"
              data-action="open-workspace-sync-confirm"
              data-testid="open-workspace-sync-confirm-btn"
              ${this.isSyncingCalendarTasks ? 'disabled' : ''}
              class="min-h-[40px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              ${this.isSyncingCalendarTasks ? '⏳ Syncing Across Devices...' : '📅 Sync Schedule to Google Calendar & Tasks →'}
            </button>
          </div>
        </section>
      </div>
    `;
  }

  private renderWorkspaceSyncConfirmModal(): string {
    if (!this.isWorkspaceSyncConfirmOpen) return '';
    const tasks = dataStore.getTasks();
    return `
      <div
        id="workspace-sync-confirm-modal"
        data-testid="workspace-sync-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Google Calendar and Google Tasks Sync"
        class="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
          <div class="space-y-1">
            <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider">
              Explicit User Confirmation Required · Google Workspace Mutation
            </span>
            <h3 class="text-lg font-extrabold text-slate-900">
              Sync ${tasks.length} Study Events & Tasks to Google Calendar and Google Tasks?
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed">
              Confirming will create or update <strong>${tasks.length} scheduled study blocks</strong> in your primary <strong>Google Calendar</strong> and <strong>Google Tasks</strong> list so your study schedule is reflected across all your devices.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] max-h-44 overflow-y-auto space-y-1.5 text-xs">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Affected Study Schedule Items (${tasks.length}):
            </div>
            ${tasks
              .slice(0, 6)
              .map(
                (t) => `
              <div class="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60 last:border-0">
                <span class="font-bold text-slate-800 truncate">[${this.escapeHtml(t.subject)}] ${this.escapeHtml(t.title)}</span>
                <span class="font-mono-tabular text-[10px] text-[#4F46E5] shrink-0">${this.escapeHtml(t.type)}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              data-action="cancel-workspace-sync"
              data-testid="cancel-workspace-sync-btn"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-action="confirm-workspace-sync"
              data-testid="confirm-workspace-sync-btn"
              class="min-h-[40px] px-5 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm cursor-pointer"
            >
              ✓ Confirm & Sync to Google Calendar + Tasks
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderPomodoroFocusWidget(): string {
    const focusStats = dataStore.getFocusStatsSummary();
    const recentSessions = dataStore.getFocusSessions().slice(0, 3);
    const subjectsList: SubjectName[] = ['Physics', 'Chemistry', 'Math', 'Biology'];
    const presets = [
      { minutes: 25, label: '25m Classic Pomodoro' },
      { minutes: 50, label: '50m Deep Focus' },
      { minutes: 15, label: '15m PYQ Sprint' },
      { minutes: 5, label: '5m Reset Break' },
    ];

    const totalSec = Math.max(60, this.focusModeMinutes * 60);
    const progressPct = Math.min(
      100,
      Math.max(0, Math.round(((totalSec - this.focusRemainingSeconds) / totalSec) * 100))
    );

    return `
      <section
        aria-label="Pomodoro Subject Focus Timer"
        data-testid="study-pomodoro-timer-card"
        class="bg-white border-2 border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <!-- Left: Subject Selector & Timer Presets -->
          <div class="space-y-2.5 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] border border-indigo-200 text-[11px] font-extrabold uppercase tracking-wider">
                ⏱️ Pomodoro Focus Timer · Synced to Profile Stats
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono-tabular font-bold" data-testid="pomodoro-total-focus-badge">
                Profile Total: ${focusStats.totalFocusHours} hrs (${focusStats.totalFocusMinutes} mins)
              </span>
            </div>

            <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
              Select Subject & Log Deep-Focus Hours to Your Profile
            </h2>

            <!-- Subject Pills -->
            <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select Focus Subject">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Subject:</span>
              ${subjectsList
                .map((sub) => {
                  const active = this.focusSubject === sub;
                  const hrs = focusStats.subjectFocusHours[sub] ?? 0;
                  return `
                    <button
                      type="button"
                      data-action="select-focus-subject"
                      data-subject="${sub}"
                      data-testid="focus-subject-btn-${sub.toLowerCase()}"
                      class="min-h-[34px] px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#4F46E5] text-white shadow-sm'
                          : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-[#E2E8F0]'
                      }"
                    >
                      ${sub} <span class="opacity-80 font-mono-tabular text-[10px]">(${hrs}h)</span>
                    </button>
                  `;
                })
                .join('')}
            </div>

            <!-- Duration Presets -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Mode:</span>
              ${presets
                .map((p) => {
                  const active = this.focusModeMinutes === p.minutes;
                  return `
                    <button
                      type="button"
                      data-action="select-focus-preset"
                      data-minutes="${p.minutes}"
                      data-label="${this.escapeHtml(p.label)}"
                      class="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }"
                    >
                      ${this.escapeHtml(p.label)}
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>

          <!-- Center/Right: Digital Clock & Controls -->
          <div class="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <div class="text-center sm:text-left">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Active: ${this.focusSubject} · ${this.escapeHtml(this.focusModeLabel)}
              </div>
              <div
                id="pomodoro-countdown-display"
                data-testid="pomodoro-countdown-display"
                class="text-3xl sm:text-4xl font-mono-tabular font-extrabold text-slate-900 tracking-tight my-0.5"
              >
                ${formatDuration(this.focusRemainingSeconds)}
              </div>
              <div class="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden mx-auto sm:mx-0">
                <div class="h-full bg-[#4F46E5] transition-all" style="width: ${progressPct}%"></div>
              </div>
            </div>

            <div class="flex flex-wrap sm:flex-col gap-2">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="toggle-focus-timer"
                  data-testid="pomodoro-start-pause-btn"
                  class="min-h-[38px] px-4 py-1.5 rounded-xl ${
                    this.isFocusRunning
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-[#4F46E5] hover:bg-indigo-700 text-white'
                  } text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  ${this.isFocusRunning ? '⏸ Pause' : '▶ Start Timer'}
                </button>
                <button
                  type="button"
                  data-action="reset-focus-timer"
                  class="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 text-xs font-bold cursor-pointer"
                >
                  ↺ Reset
                </button>
              </div>
              <button
                type="button"
                data-action="complete-log-focus-session"
                data-testid="pomodoro-complete-log-btn"
                class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                ✓ Complete & Log +${this.focusModeMinutes}m to Profile
              </button>
            </div>
          </div>
        </div>

        <!-- Subject Focus Breakdown Bar & Recent Logged Sessions -->
        <div class="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-2" data-testid="pomodoro-subject-breakdown">
            <span class="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Profile Subject Hours:</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4F46E5] font-mono-tabular font-bold">
              Physics: ${focusStats.subjectFocusHours.Physics}h (${focusStats.subjectFocusMinutes.Physics}m)
            </span>
            <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-mono-tabular font-bold">
              Chemistry: ${focusStats.subjectFocusHours.Chemistry}h (${focusStats.subjectFocusMinutes.Chemistry}m)
            </span>
            <span class="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-mono-tabular font-bold">
              Math: ${focusStats.subjectFocusHours.Math}h (${focusStats.subjectFocusMinutes.Math}m)
            </span>
            <span class="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-mono-tabular font-bold">
              Biology: ${focusStats.subjectFocusHours.Biology}h (${focusStats.subjectFocusMinutes.Biology}m)
            </span>
          </div>
          <div class="text-[11px] text-slate-500 font-medium truncate">
            Latest Log: ${
              recentSessions[0]
                ? `${this.escapeHtml(recentSessions[0].subject)} (+${recentSessions[0].durationMinutes}m · ${this.escapeHtml(recentSessions[0].modeLabel)})`
                : 'No focus session logged yet'
            }
          </div>
        </div>
      </section>
    `;
  }

  private renderSecurePdfModal(): string {
    if (!this.previewMaterial) return '';
    const mat = this.previewMaterial;
    const pages = mat.summaryPages.length > 0 ? mat.summaryPages : ['Page 1 content'];
    const currentPageText = pages[this.currentPageIndex] ?? pages[0];

    return `
      <div
        id="secure-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-label="In-App Secure PDF Viewer"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      >
        <div
          id="secure-pdf-modal-box"
          class="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          <div class="px-4 sm:px-6 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                prepskm.in Secure In-App PDF Reader · ${this.escapeHtml(mat.section)}
              </div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900 truncate max-w-md">
                ${this.escapeHtml(mat.title)}
              </h3>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex items-center rounded-xl bg-white border border-[#E2E8F0] p-0.5">
                <button
                  type="button"
                  data-action="pdf-zoom-out"
                  aria-label="Zoom out"
                  class="px-2.5 py-1 text-xs font-mono-tabular font-bold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  −
                </button>
                <span class="px-2 text-xs font-mono-tabular font-semibold text-slate-800">
                  ${this.zoomPercent}%
                </span>
                <button
                  type="button"
                  data-action="pdf-zoom-in"
                  aria-label="Zoom in"
                  class="px-2.5 py-1 text-xs font-mono-tabular font-bold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  +
                </button>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E2E8F0] px-2.5 py-1">
                <button
                  type="button"
                  data-action="pdf-prev-page"
                  ${this.currentPageIndex <= 0 ? 'disabled' : ''}
                  class="text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span class="text-xs font-mono-tabular text-slate-600">
                  Page ${this.currentPageIndex + 1} / ${pages.length}
                </span>
                <button
                  type="button"
                  data-action="pdf-next-page"
                  ${this.currentPageIndex >= pages.length - 1 ? 'disabled' : ''}
                  class="text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>

              <button
                type="button"
                data-action="open-edit-material"
                data-material-id="${mat.id}"
                class="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100"
              >
                ✏️ Edit PDF
              </button>

              <button
                type="button"
                data-action="pdf-fullscreen"
                class="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Fullscreen
              </button>

              <button
                type="button"
                data-action="close-pdf-modal"
                class="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close ✕
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-100 flex justify-center">
            <div
              class="bg-white border border-[#E2E8F0] rounded-xl shadow-md p-6 sm:p-10 w-full max-w-2xl transition-all"
              style="font-size: ${Math.round((14 * this.zoomPercent) / 100)}px"
            >
              <div class="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 text-xs text-slate-400 font-mono-tabular">
                <span>prepskm.in Verified Study Material</span>
                <span>Watermark: ${this.escapeHtml(dataStore.getUser().email)}</span>
              </div>
              <pre class="whitespace-pre-wrap font-mono text-slate-800 leading-relaxed">${this.escapeHtml(
                currentPageText
              )}</pre>
            </div>
          </div>

          <div class="px-6 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <span class="text-xs text-slate-500">
              Protected Document · ${mat.downloads} student downloads
            </span>
            <button
              type="button"
              data-action="download-material"
              data-material-id="${mat.id}"
              class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              Download Full PDF
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderEditMaterialModal(): string {
    if (!this.editingMaterial) return '';
    const mat = this.editingMaterial;
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const sections = dataStore.getVaultSections();

    return `
      <div
        id="edit-pdf-material-modal"
        data-testid="edit-pdf-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit PDF Study Material"
        class="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
                ✏️ Edit & Update Study Vault PDF · Synced to Firebase
              </span>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900">
                Update PDF Title, Section & Document Pages
              </h3>
            </div>
            <button
              type="button"
              data-action="close-edit-material"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Close ✕
            </button>
          </div>

          <form id="study-vault-edit-pdf-form" class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">PDF Title</label>
              <input
                id="edit-pdf-title"
                type="text"
                required
                value="${this.escapeHtml(mat.title)}"
                class="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-slate-900"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Vault Section</label>
                <select
                  id="edit-pdf-section"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${sections
                    .map(
                      (sec) =>
                        `<option value="${this.escapeHtml(sec)}" ${mat.section === sec ? 'selected' : ''}>${this.escapeHtml(sec)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Class / Cohort</label>
                <select
                  id="edit-pdf-class"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${classes
                    .map(
                      (c) =>
                        `<option value="${c.id}" ${mat.classId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <select
                  id="edit-pdf-subject"
                  class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${subjects
                    .map(
                      (s) =>
                        `<option value="${s.id}" ${mat.subjectId === s.id ? 'selected' : ''}>${this.escapeHtml(s.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                PDF Content / Formula & Notes Pages (Separate pages with a blank line "---")
              </label>
              <textarea
                id="edit-pdf-pages"
                rows="6"
                class="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs text-slate-800"
              >${this.escapeHtml(mat.summaryPages.join('\n---\n'))}</textarea>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-action="close-edit-material"
                class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-edited-pdf-btn"
                class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
              >
                💾 Save Updated PDF to Firebase
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private triggerMaterialDownload(mat: StudyMaterialItem): void {
    const content = [
      `====================================================================`,
      `PREPSKM.IN — OFFICIAL STUDY MATERIAL VAULT`,
      `Title   : ${mat.title}`,
      `Section : ${mat.section}`,
      `Student : ${dataStore.getUser().name} (${dataStore.getUser().email})`,
      `====================================================================`,
      ``,
      ...mat.summaryPages,
    ].join('\n\n');

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    const searchInput =
      this.containerEl.querySelector<HTMLInputElement>('#vault-search-input');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.rerender();
      const refocused =
        this.containerEl?.querySelector<HTMLInputElement>('#vault-search-input');
      if (refocused) {
        refocused.focus();
        refocused.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    const editForm = this.containerEl.querySelector<HTMLFormElement>(
      '#study-vault-edit-pdf-form'
    );
    editForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.editingMaterial) return;
      const title =
        editForm.querySelector<HTMLInputElement>('#edit-pdf-title')?.value.trim() ||
        this.editingMaterial.title;
      const section =
        editForm.querySelector<HTMLSelectElement>('#edit-pdf-section')?.value ||
        this.editingMaterial.section;
      const classId =
        editForm.querySelector<HTMLSelectElement>('#edit-pdf-class')?.value ||
        this.editingMaterial.classId;
      const subjectId =
        editForm.querySelector<HTMLSelectElement>('#edit-pdf-subject')?.value ||
        this.editingMaterial.subjectId;
      const rawPages =
        editForm.querySelector<HTMLTextAreaElement>('#edit-pdf-pages')?.value || '';
      const summaryPages = rawPages
        .split(/\n---\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      await dataStore.updateMaterial(this.editingMaterial.id, {
        title,
        section,
        classId,
        subjectId,
        summaryPages:
          summaryPages.length > 0 ? summaryPages : this.editingMaterial.summaryPages,
      });

      if (this.previewMaterial && this.previewMaterial.id === this.editingMaterial.id) {
        this.previewMaterial =
          dataStore.getMaterials().find((m) => m.id === this.editingMaterial?.id) ||
          null;
      }
      this.editingMaterial = null;
      this.callbacks.onShowToast(`Updated PDF "${title}" in Firebase Study Vault!`);
      this.rerender();
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'open-section-folder': {
            const sec = el.dataset.section;
            if (sec) {
              this.activeOpenedSection = sec;
              window.history.pushState(
                {},
                '',
                `/study.html?section=${encodeURIComponent(sec)}`
              );
              this.rerender();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            break;
          }
          case 'close-section-view': {
            this.activeOpenedSection = null;
            window.history.pushState({}, '', '/study.html');
            this.rerender();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
          }
          case 'filter-cohort': {
            this.selectedCohort = el.dataset.cohort ?? 'ALL';
            this.rerender();
            break;
          }
          case 'filter-subject-name': {
            this.selectedSubjectName = el.dataset.subject ?? 'ALL';
            this.rerender();
            break;
          }
          case 'reset-vault-filters': {
            this.selectedCohort = 'ALL';
            this.selectedSubjectName = 'ALL';
            this.searchQuery = '';
            this.rerender();
            break;
          }
          case 'preview-material': {
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              this.previewMaterial = found;
              this.currentPageIndex = 0;
              this.zoomPercent = 100;
              this.rerender();
            }
            break;
          }
          case 'open-edit-material': {
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              this.editingMaterial = found;
              this.rerender();
            }
            break;
          }
          case 'close-edit-material': {
            this.editingMaterial = null;
            this.rerender();
            break;
          }
          case 'download-material': {
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              await dataStore.incrementMaterialDownload(found.id);
              this.triggerMaterialDownload(found);
              this.callbacks.onShowToast(`Downloading "${found.title}" PDF...`);
              this.rerender();
            }
            break;
          }
          case 'close-pdf-modal': {
            this.previewMaterial = null;
            this.rerender();
            break;
          }
          case 'pdf-zoom-in': {
            this.zoomPercent = Math.min(150, this.zoomPercent + 25);
            this.rerender();
            break;
          }
          case 'pdf-zoom-out': {
            this.zoomPercent = Math.max(75, this.zoomPercent - 25);
            this.rerender();
            break;
          }
          case 'pdf-prev-page': {
            this.currentPageIndex = Math.max(0, this.currentPageIndex - 1);
            this.rerender();
            break;
          }
          case 'pdf-next-page': {
            if (this.previewMaterial) {
              this.currentPageIndex = Math.min(
                this.previewMaterial.summaryPages.length - 1,
                this.currentPageIndex + 1
              );
              this.rerender();
            }
            break;
          }
          case 'pdf-fullscreen': {
            const box = this.containerEl?.querySelector('#secure-pdf-modal-box');
            if (box && box.requestFullscreen) {
              void box.requestFullscreen().catch(() => {});
            }
            break;
          }
          case 'select-focus-subject': {
            const sub = el.dataset.subject as SubjectName | undefined;
            if (sub) {
              this.focusSubject = sub;
              this.rerender();
            }
            break;
          }
          case 'select-focus-preset': {
            const mins = Number(el.dataset.minutes) || 25;
            const label = el.dataset.label || `${mins}m Pomodoro`;
            this.stopFocusTimerInterval();
            this.isFocusRunning = false;
            this.focusModeMinutes = mins;
            this.focusModeLabel = label;
            this.focusRemainingSeconds = mins * 60;
            this.rerender();
            break;
          }
          case 'toggle-focus-timer': {
            if (this.isFocusRunning) {
              this.stopFocusTimerInterval();
              this.isFocusRunning = false;
              this.rerender();
            } else {
              this.isFocusRunning = true;
              this.startFocusTimerInterval();
              this.rerender();
            }
            break;
          }
          case 'reset-focus-timer': {
            this.stopFocusTimerInterval();
            this.isFocusRunning = false;
            this.focusRemainingSeconds = this.focusModeMinutes * 60;
            this.rerender();
            break;
          }
          case 'complete-log-focus-session': {
            this.stopFocusTimerInterval();
            this.isFocusRunning = false;
            const logged = await dataStore.logFocusSession({
              subject: this.focusSubject,
              durationMinutes: this.focusModeMinutes,
              modeLabel: this.focusModeLabel,
            });
            this.focusRemainingSeconds = this.focusModeMinutes * 60;
            const updatedStats = dataStore.getFocusStatsSummary();
            this.callbacks.onShowToast(
              `Logged +${logged.durationMinutes}m (${logged.subject}) to Profile! Total Focus: ${updatedStats.totalFocusHours} hrs.`
            );
            this.rerender();
            break;
          }
          case 'workspace-google-signin': {
            const token = await workspaceConnector.signInWithGoogleWorkspace();
            if (token) {
              this.callbacks.onShowToast(
                'Connected Google Workspace! Fetching Classroom resources & assignments...'
              );
              this.isFetchingClassroom = true;
              this.rerender();
              await workspaceConnector.fetchClassroomResourcesAndAssignments();
              this.isFetchingClassroom = false;
              this.rerender();
            } else {
              this.callbacks.onShowToast(
                'Google Workspace sign-in cancelled or running in preview fallback mode.'
              );
            }
            break;
          }
          case 'fetch-classroom-feed': {
            this.isFetchingClassroom = true;
            this.rerender();
            const res = await workspaceConnector.fetchClassroomResourcesAndAssignments();
            this.isFetchingClassroom = false;
            this.callbacks.onShowToast(
              `Fetched ${res.items.length} Google Classroom resources, materials & assignment updates into Study Vault!`
            );
            this.rerender();
            break;
          }
          case 'import-classroom-item': {
            const itemId = el.dataset.itemId;
            if (!itemId) break;
            const imported = await workspaceConnector.importClassroomItemToStudyVault(itemId);
            if (imported) {
              this.callbacks.onShowToast(
                `Imported "${imported.title}" (${imported.subjectTag}) into Study Vault & Study Planner!`
              );
              this.rerender();
            }
            break;
          }
          case 'open-workspace-sync-confirm': {
            this.isWorkspaceSyncConfirmOpen = true;
            this.rerender();
            break;
          }
          case 'cancel-workspace-sync': {
            this.isWorkspaceSyncConfirmOpen = false;
            this.rerender();
            break;
          }
          case 'confirm-workspace-sync': {
            this.isWorkspaceSyncConfirmOpen = false;
            this.isSyncingCalendarTasks = true;
            this.rerender();
            const synced = await workspaceConnector.syncStudyScheduleWithGoogleCalendarAndTasks();
            this.isSyncingCalendarTasks = false;
            this.callbacks.onShowToast(
              `Synced ${synced.syncedCount} study events & tasks with Google Calendar & Google Tasks across all devices!`
            );
            this.rerender();
            break;
          }
        }
      });
    });
  }

  private startFocusTimerInterval(): void {
    this.stopFocusTimerInterval();
    this.focusIntervalId = window.setInterval(() => {
      if (!this.isFocusRunning) return;
      this.focusRemainingSeconds = Math.max(0, this.focusRemainingSeconds - 1);
      const clockEl = this.containerEl?.querySelector('#pomodoro-countdown-display');
      if (clockEl) {
        clockEl.textContent = formatDuration(this.focusRemainingSeconds);
      }
      if (this.focusRemainingSeconds <= 0) {
        this.stopFocusTimerInterval();
        this.isFocusRunning = false;
        void dataStore
          .logFocusSession({
            subject: this.focusSubject,
            durationMinutes: this.focusModeMinutes,
            modeLabel: this.focusModeLabel,
          })
          .then((logged) => {
            const updatedStats = dataStore.getFocusStatsSummary();
            this.focusRemainingSeconds = this.focusModeMinutes * 60;
            this.callbacks.onShowToast(
              `🎉 Pomodoro Complete! Logged +${logged.durationMinutes}m (${logged.subject}) · Total: ${updatedStats.totalFocusHours} hrs.`
            );
            this.rerender();
          });
      }
    }, 1000);
  }

  private stopFocusTimerInterval(): void {
    if (this.focusIntervalId !== null) {
      window.clearInterval(this.focusIntervalId);
      this.focusIntervalId = null;
    }
  }

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
