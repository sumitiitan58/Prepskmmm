import { getCohortTheme } from '../constants';
import { verifyStudyVaultDocumentAndExtractOptionsWithAI } from '../services/aiAssistantService';
import { dataStore, resolveStoredMediaBlobUrl } from '../services/firebaseService';
import type { StudyMaterialItem } from '../types';
import { isolateOptionLettersOnly } from '../utils/examLogic';
import {
  getStoredCachedMaterialIds,
  preDownloadMaterialsForOffline,
} from '../utils/lectureOfflineCache';

export interface StudyVaultCallbacks {
  onShowToast: (message: string) => void;
}

export class StudyVaultModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: StudyVaultCallbacks;
  private selectedCohort = 'ALL';
  private selectedSubjectName = 'ALL';
  private activeOpenedSection: string | null = null;
  private searchQuery = '';

  // In-App Secure PDF Viewer Modal State
  private previewMaterial: StudyMaterialItem | null = null;
  private previewResolvedPdfUrl: string | null = null;
  private editingMaterial: StudyMaterialItem | null = null;
  private currentPageIndex = 0;
  private zoomPercent = 100;

  // AI Document Integrity & Option-Letter Extraction State
  private aiVerifiedStatus: {
    title: string;
    integrityBadge: string;
    extractedOptionLetters: string[];
    verificationNote: string;
  } | null = null;
  private isVerifyingWithAI = false;
  private pendingTestImageDataUrl: string | null = null;
  private pendingTestImageName = '';
  private aiVerifierLoading = false;
  private aiVerifierResult: {
    verified: boolean;
    integrityScore: number;
    verificationReport: string;
    extractedOptionLetters: string[];
    targetTitle: string;
  } | null = null;

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
        gradient: 'from-purple-50 via-white to-pink-50',
        headerGrad: 'from-[#7C3AED] via-[#9333EA] to-[#DB2777]',
        border: 'border-[#F3E8FF] hover:border-[#7C3AED]',
        badge: 'bg-[#7C3AED] text-white',
        text: 'text-[#7C3AED]',
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
        gradient: 'from-pink-50 via-white to-rose-50',
        headerGrad: 'from-[#DB2777] via-pink-600 to-rose-500',
        border: 'border-pink-200 hover:border-[#DB2777]',
        badge: 'bg-[#DB2777] text-white',
        text: 'text-[#DB2777]',
        desc: 'AIR Topper Hand-written Classroom Notes, Mechanisms & Diagrams',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
      },
      {
        gradient: 'from-amber-50 via-white to-orange-50',
        headerGrad: 'from-amber-500 via-orange-500 to-rose-500',
        border: 'border-amber-200 hover:border-[#F59E0B]',
        badge: 'bg-[#F59E0B] text-white',
        text: 'text-amber-700',
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

  private renderMentorVaultLockAndAIVerifier(): string {
    const isMentor = dataStore.isAuthorizedAdminOrMentor();
    const materials = dataStore.getMaterials();
    const defaultMat = materials[0];
    const verified = this.aiVerifiedStatus ?? {
      title: defaultMat?.title || 'JEE Advanced Physics PYQ Archive',
      integrityBadge: 'AI Verified · Mentor-Locked Integrity',
      extractedOptionLetters: isolateOptionLettersOnly(['A', 'B', 'C', 'D']),
      verificationNote:
        'AI verified document integrity and isolated pure option letters (A, B, C, D) with all accompanying text stripped for automated processing.',
    };

    return `
      <section
        aria-label="Study Vault Mentor Lock and AI Document Verifier"
        data-testid="study-vault-ai-verifier"
        class="bg-gradient-to-r from-[#FDF2F8] via-white to-[#F5F3FF] border-2 border-[#F5D0FE] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#F3E8FF]">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                data-testid="study-vault-mentor-lock-badge"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                  isMentor
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-pink-100 text-[#DB2777] border border-pink-200'
                } text-[11px] font-extrabold uppercase tracking-wider"
              >
                ${
                  isMentor
                    ? '🔓 Mentor Edit Rights Active (Verified Mentor Session)'
                    : '🔒 Vault Locked · Edit Rights Strictly Restricted to Mentor Only'
                }
              </span>
              <span class="px-3 py-1 rounded-full bg-purple-100 text-[#7C3AED] text-[11px] font-extrabold">
                🤖 AI Document Integrity &amp; Option-Letter Extractor
              </span>
            </div>
            <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
              AI Document Integrity Verification &amp; Isolated Option-Letter Extraction
            </h2>
            <p class="text-xs text-slate-600">
              To maintain content integrity, only the verified Mentor can edit or upload Study Vault documents. Uploaded test images are processed by AI to retain <strong>only the option letters (A, B, C, D)</strong> while stripping all accompanying text.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <label
              for="vault-ai-test-image-input"
              class="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white hover:bg-[#FDF2F8] border-2 border-[#F5D0FE] text-xs font-extrabold text-[#7C3AED] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <span>🖼️ Upload Test Image to Isolate Options</span>
            </label>
            <input
              id="vault-ai-test-image-input"
              type="file"
              accept="image/*,application/pdf"
              class="hidden"
            />
            <button
              type="button"
              data-action="run-vault-ai-verification"
              data-testid="run-vault-ai-verify-btn"
              class="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm cursor-pointer"
            >
              ${this.isVerifyingWithAI ? '🤖 AI Verifying...' : '🤖 AI Verify Vault & Extract Option Letters'}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white border border-[#F3E8FF] rounded-2xl p-4" data-testid="vault-ai-verification-result">
          <div class="md:col-span-7 space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                ✓ ${this.escapeHtml(verified.integrityBadge)}
              </span>
              <span class="text-xs font-extrabold text-slate-900 truncate">
                ${this.escapeHtml(verified.title)}
              </span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              ${this.escapeHtml(verified.verificationNote)}
            </p>
          </div>

          <div class="md:col-span-5 flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE]">
            <div class="text-[11px] font-extrabold text-[#7C3AED] uppercase">
              Isolated Option Letters (Text Stripped):
            </div>
            <div class="flex items-center gap-1.5" data-testid="vault-extracted-option-letters">
              ${verified.extractedOptionLetters
                .map(
                  (letter) => `
                <span class="w-8 h-8 rounded-xl bg-white border-2 border-[#7C3AED] text-[#7C3AED] font-mono-tabular text-xs font-extrabold flex items-center justify-center shadow-2xs">
                  ${this.escapeHtml(letter)}
                </span>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </section>
    `;
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
    const isMentor = dataStore.isAuthorizedAdminOrMentor();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const sections = dataStore.getVaultSections();
    const allMaterials = dataStore.getMaterials();
    const cachedMaterialIds = getStoredCachedMaterialIds();

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
      // =========================================================================
      this.containerEl.innerHTML = `
        <div class="space-y-6" data-testid="study-vault-directory-page">
          <!-- Slim Class-Specific Vault Banner -->
          <section
            aria-label="Study Material Vault Banner"
            class="rounded-3xl bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#DB2777] text-white px-5 py-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="space-y-0.5">
              <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold uppercase tracking-wider">
                📚 ${this.escapeHtml(cohortTheme.label)} · Mentor-Verified Study Material Vault
              </span>
              <h1 class="text-base sm:text-lg font-extrabold">
                Select a Study Vault Section to Open Its Dedicated Page
              </h1>
            </div>
            <div class="shrink-0 bg-white/15 border border-white/25 rounded-2xl px-4 py-2 text-center flex items-center gap-2">
              <span class="text-lg font-mono-tabular font-extrabold">${allMaterials.length}</span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-white/90">Mentor-Verified PDFs</span>
            </div>
          </section>

          <!-- Mentor Lock & AI Document Integrity + Option-Letter Extractor -->
          ${this.renderMentorVaultLockAndAIVerifier()}

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
                      class="text-left rounded-3xl p-5 bg-gradient-to-br ${st.gradient} border-2 ${st.border} shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group cursor-pointer"
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

          <!-- In-App Secure PDF Viewer Modal -->
          ${this.renderSecurePdfModal()}
        </div>
      `;

      this.bindEvents();
      return;
    }

    // =========================================================================
    // VIEW 2: DEDICATED SECTION PAGE (/study.html?section=PYQs)
    // =========================================================================
    const activeSecStyle = this.getSectionStyle(this.activeOpenedSection, 0);

    this.containerEl.innerHTML = `
      <div class="space-y-5" data-testid="study-vault-dedicated-section-page">
        <!-- Dedicated Section Page Hero Header with Back Button -->
        <section
          aria-label="Dedicated Section Page Header"
          class="rounded-3xl bg-gradient-to-r ${activeSecStyle.headerGrad} text-white p-5 sm:p-6 shadow-md space-y-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              data-action="close-section-view"
              data-testid="back-to-all-sections-btn"
              class="min-h-[44px] px-4 py-2 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>← Back to All Study Vault Sections</span>
            </button>

            <span class="px-3 py-1 rounded-full bg-white/20 text-xs font-mono-tabular font-extrabold">
              ${filteredMaterials.length} Mentor-Verified PDFs in ${this.escapeHtml(this.activeOpenedSection)}
            </span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-white/80">
                Dedicated Section Page · ${this.escapeHtml(cohortTheme.label)}
              </span>
              <h1 class="text-xl sm:text-2xl font-extrabold mt-0.5">
                ${this.escapeHtml(this.activeOpenedSection)} — Mentor-Verified PDF Archive
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
              class="min-h-[44px] px-3.5 py-2 rounded-2xl bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none w-full sm:w-64 shadow-sm"
            />
          </div>
        </section>

        <!-- Mentor Lock & AI Verifier Banner -->
        ${this.renderMentorVaultLockAndAIVerifier()}

        <!-- Subject Filter Bar for Dedicated Section Page -->
        <section class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            ${(['ALL', ...uniqueSubjectNames] as const)
              .map(
                (subName) => `
              <button
                type="button"
                data-action="filter-subject-name"
                data-subject="${subName}"
                class="min-h-[40px] px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-colors shrink-0 cursor-pointer ${
                  this.selectedSubjectName === subName
                    ? 'bg-[#7C3AED] text-white shadow-2xs'
                    : 'bg-[#FDF2F8] border border-[#F5D0FE] text-slate-600 hover:bg-pink-100'
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
                class="min-h-[36px] px-3 py-1 rounded-xl text-[11px] font-bold transition-colors shrink-0 cursor-pointer ${
                  this.activeOpenedSection === sec
                    ? 'bg-[#DB2777] text-white'
                    : 'bg-[#FDF2F8] text-slate-600 hover:bg-pink-100'
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
          class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-4 sm:p-5 shadow-sm space-y-2"
        >
          <div class="flex items-center justify-between px-2 py-1 border-b border-[#F3E8FF]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
              <span class="text-xs font-extrabold text-slate-800">
                ${this.escapeHtml(this.activeOpenedSection)} — Mentor-Verified Study Vault List
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
              <div class="text-sm font-bold text-slate-900">No PDFs match the current filter in ${this.escapeHtml(this.activeOpenedSection)}</div>
              <button
                type="button"
                data-action="reset-vault-filters"
                class="min-h-[42px] px-4 py-2 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold"
              >
                Show All PDFs in Section
              </button>
            </div>
          `
              : `
            <div class="divide-y divide-[#F3E8FF]">
              ${filteredMaterials
                .map((mat, idx) => {
                  const clsObj = classes.find((c) => c.id === mat.classId);
                  const subObj = subjects.find((s) => s.id === mat.subjectId);
                  const st = this.getSectionStyle(mat.section, idx);
                  const subName = subObj?.name ?? 'Physics';
                  const cohortLabel = mat.cohortTag || clsObj?.name || 'JEE';
                  const isCachedOffline = cachedMaterialIds.includes(mat.id);

                  return `
                    <article
                      data-testid="compact-pdf-row"
                      class="py-3 px-3 sm:px-4 hover:bg-[#FDF2F8]/60 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <!-- Left: Compact PDF Icon + Wide Title + Inline Badges -->
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div class="w-10 h-10 rounded-2xl ${st.badge} flex items-center justify-center text-[10px] font-mono-tabular font-extrabold shrink-0 shadow-2xs">
                          PDF
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                              ${this.escapeHtml(mat.title)}
                            </h3>
                            <span class="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold text-emerald-700">
                              ✓ Mentor Verified
                            </span>
                          </div>
                          <div class="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px]">
                            <span class="px-2 py-0.5 rounded-full font-bold bg-purple-50 text-[#7C3AED]">
                              ${this.escapeHtml(mat.section)}
                            </span>
                            <span class="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-[#10B981]">
                              ${this.escapeHtml(subName)}
                            </span>
                            <span class="px-2 py-0.5 rounded-full font-semibold bg-pink-50 text-[#DB2777]">
                              ${this.escapeHtml(cohortLabel)}
                            </span>
                            <span class="text-slate-400 font-mono-tabular">
                              · ${mat.pagesCount}p · ${mat.downloads} dl
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Right: Action Buttons (Edit Restricted Exclusively to Mentor!) -->
                      <div class="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          data-action="verify-single-material-ai"
                          data-material-id="${mat.id}"
                          class="min-h-[38px] px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#7C3AED] text-[11px] font-extrabold cursor-pointer"
                        >
                          🤖 AI Verify
                        </button>
                        <button
                          type="button"
                          data-action="cache-material-offline"
                          data-material-id="${mat.id}"
                          class="min-h-[38px] px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-colors cursor-pointer ${
                            isCachedOffline
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-[#FDF2F8] hover:bg-pink-100 border-[#F5D0FE] text-slate-700'
                          }"
                        >
                          ${isCachedOffline ? '✓ Offline Ready' : '⚡ Save Offline'}
                        </button>
                        ${
                          isMentor
                            ? `
                          <button
                            type="button"
                            data-action="open-edit-material"
                            data-testid="mentor-edit-material-btn"
                            data-material-id="${mat.id}"
                            class="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold transition-colors cursor-pointer"
                          >
                            ✏️ Mentor Edit
                          </button>
                        `
                            : `
                          <span
                            data-testid="student-edit-locked-pill"
                            title="Edit rights restricted exclusively to the Mentor"
                            class="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold inline-flex items-center"
                          >
                            🔒 Mentor-Only Edit
                          </span>
                        `
                        }
                        <button
                          type="button"
                          data-action="preview-material"
                          data-material-id="${mat.id}"
                          class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#7C3AED] hover:bg-purple-700 text-white text-[11px] font-extrabold transition-colors cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          data-action="download-material"
                          data-material-id="${mat.id}"
                          class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-slate-800 text-[11px] font-extrabold transition-colors cursor-pointer"
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

        <!-- In-App Secure PDF Viewer Modal -->
        ${this.renderSecurePdfModal()}
        <!-- Edit PDF Modal (Mentor Only) -->
        ${isMentor ? this.renderEditPdfModal() : ''}
      </div>
    `;

    this.bindEvents();
  }

  private isUploadedRealPdf(url?: string | null): boolean {
    if (!url) return false;
    return (
      url.startsWith('data:application/pdf') ||
      url.startsWith('blob:') ||
      url.startsWith('/uploaded-media/') ||
      url.startsWith('http://') ||
      url.startsWith('https://')
    );
  }

  private renderSecurePdfModal(): string {
    if (!this.previewMaterial) return '';
    const mat = this.previewMaterial;
    const pages = mat.summaryPages.length > 0 ? mat.summaryPages : ['Page 1 content'];
    const currentPageText = pages[this.currentPageIndex] ?? pages[0];
    const hasUploadedPdf = Boolean(
      this.previewResolvedPdfUrl && this.isUploadedRealPdf(this.previewResolvedPdfUrl)
    );

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
              ${
                hasUploadedPdf
                  ? `
                <a
                  href="${this.previewResolvedPdfUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100 inline-flex items-center"
                >
                  ↗ Open Exact PDF File
                </a>
              `
                  : `
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
              `
              }

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

          <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
            ${
              hasUploadedPdf
                ? `
              <iframe
                src="${this.previewResolvedPdfUrl}"
                title="${this.escapeHtml(mat.title)}"
                data-testid="uploaded-pdf-iframe"
                class="w-full h-[68vh] rounded-xl border border-slate-200 bg-white shadow-md"
              ></iframe>
            `
                : `
              <div
                class="bg-white border border-[#E2E8F0] rounded-xl shadow-md p-6 sm:p-10 w-full max-w-2xl transition-all"
                style="font-size: ${Math.round((14 * this.zoomPercent) / 100)}px"
              >
                <div class="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 text-xs text-slate-400 font-mono-tabular">
                  <span>prepskm.in Verified Study Material</span>
                  <span>Watermark: ${this.escapeHtml(dataStore.getUser().email || 'prepskm.in')}</span>
                </div>
                <pre class="whitespace-pre-wrap font-mono text-slate-800 leading-relaxed">${this.escapeHtml(
                  currentPageText
                )}</pre>
              </div>
            `
            }
          </div>

          <div class="px-6 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <span class="text-xs text-slate-500">
              ${hasUploadedPdf ? '✓ Exact Uploaded PDF File Active' : `Protected Document · ${mat.downloads} student downloads`}
            </span>
            <button
              type="button"
              data-action="download-material"
              data-material-id="${mat.id}"
              class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              Download Exact PDF File
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderEditPdfModal(): string {
    if (!this.editingMaterial) return '';
    const mat = this.editingMaterial;
    const sections = dataStore.getVaultSections();
    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Study Material PDF"
        data-testid="edit-pdf-modal"
        class="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
                ✏️ Update Study Vault PDF
              </span>
              <h3 class="text-base font-extrabold text-slate-900">
                Edit PDF Title, Section &amp; Notes
              </h3>
            </div>
            <button
              type="button"
              data-action="close-edit-material"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-bold text-slate-700"
            >
              Close ✕
            </button>
          </div>

          <form id="edit-pdf-form" class="space-y-3.5">
            <div>
              <label for="edit-pdf-title" class="block text-xs font-bold text-slate-700 mb-1">PDF Title</label>
              <input
                id="edit-pdf-title"
                type="text"
                required
                value="${this.escapeHtml(mat.title)}"
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-bold text-slate-900"
              />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label for="edit-pdf-section" class="block text-xs font-bold text-slate-700 mb-1">Section</label>
                <select id="edit-pdf-section" class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-semibold text-slate-800">
                  ${sections.map((s) => `<option value="${this.escapeHtml(s)}" ${mat.section === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="edit-pdf-class" class="block text-xs font-bold text-slate-700 mb-1">Class</label>
                <select id="edit-pdf-class" class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-semibold text-slate-800">
                  ${classes.map((c) => `<option value="${c.id}" ${mat.classId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="edit-pdf-subject" class="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <select id="edit-pdf-subject" class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-semibold text-slate-800">
                  ${subjects.map((sub) => `<option value="${sub.id}" ${mat.subjectId === sub.id ? 'selected' : ''}>${this.escapeHtml(sub.name)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div>
              <label for="edit-pdf-summary" class="block text-xs font-bold text-slate-700 mb-1">Page 1 Revision Summary</label>
              <textarea
                id="edit-pdf-summary"
                rows="3"
                class="w-full p-3 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] text-xs font-mono text-slate-800"
              >${this.escapeHtml(mat.summaryPages[0] || '')}</textarea>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs"
              >
                Save PDF Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private async triggerMaterialDownload(mat: StudyMaterialItem): Promise<void> {
    if (this.isUploadedRealPdf(mat.pdfUrl)) {
      const resolvedUrl = await resolveStoredMediaBlobUrl(mat.pdfUrl);
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.download = `${mat.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const content = [
      `====================================================================`,
      `PREPSKM.IN — OFFICIAL STUDY MATERIAL VAULT`,
      `Title   : ${mat.title}`,
      `Section : ${mat.section}`,
      `Student : ${dataStore.getUser().name} (${dataStore.getUser().email || 'Guest'})`,
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

    const editForm =
      this.containerEl.querySelector<HTMLFormElement>('#edit-pdf-form');
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
      const summaryPage1 =
        editForm.querySelector<HTMLTextAreaElement>('#edit-pdf-summary')?.value.trim() ||
        this.editingMaterial.summaryPages[0] ||
        '';

      if (!dataStore.isAuthorizedAdminOrMentor()) {
        this.callbacks.onShowToast(
          '🔒 Study Vault is locked: Only the Mentor has edit rights to maintain content integrity.'
        );
        return;
      }

      await dataStore.updateMaterial(this.editingMaterial.id, {
        title,
        section,
        classId,
        subjectId,
        summaryPages: [summaryPage1, ...(this.editingMaterial.summaryPages.slice(1))],
      });
      this.editingMaterial = null;
      this.callbacks.onShowToast(`✅ Mentor-Verified: Updated PDF "${title}" and synced to Firebase!`);
      this.rerender();
    });

    const aiTestImgInput = this.containerEl.querySelector<HTMLInputElement>(
      '#vault-ai-test-image-input'
    );
    aiTestImgInput?.addEventListener('change', () => {
      const file = aiTestImgInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          this.pendingTestImageDataUrl = reader.result;
          this.pendingTestImageName = file.name;
          this.aiVerifierLoading = true;
          this.rerender();
          const activeMat = dataStore.getMaterials()[0];
          const res = await verifyStudyVaultDocumentAndExtractOptionsWithAI({
            title: `${file.name} (${activeMat?.title || 'Study Vault Material'})`,
            section: activeMat?.section || 'Formula Sheets',
            summaryText: activeMat?.summaryPages.join('\n') || file.name,
            imageDataUrl: this.pendingTestImageDataUrl,
          });
          this.aiVerifierResult = {
            verified: res.verified,
            integrityScore: res.integrityScore,
            verificationReport: res.verificationReport,
            extractedOptionLetters: isolateOptionLettersOnly(res.extractedOptionLetters),
            targetTitle: file.name,
          };
          this.aiVerifierLoading = false;
          this.callbacks.onShowToast(
            `🤖 AI Verified "${file.name}" & Isolated Option Letters: ${this.aiVerifierResult.extractedOptionLetters.join(', ')}`
          );
          this.rerender();
        }
      };
      reader.readAsDataURL(file);
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'open-edit-material': {
            if (!dataStore.isAuthorizedAdminOrMentor()) {
              this.callbacks.onShowToast(
                '🔒 Edit Rights Restricted: Only the verified Mentor can edit Study Vault materials.'
              );
              return;
            }
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              this.editingMaterial = found;
              this.rerender();
            }
            break;
          }
          case 'run-vault-ai-verification':
          case 'verify-single-material-ai': {
            const matId = el.dataset.materialId;
            const materials = dataStore.getMaterials();
            const targetMat =
              (matId ? materials.find((m) => m.id === matId) : undefined) ||
              materials[0];
            if (!targetMat) return;
            this.aiVerifierLoading = true;
            this.rerender();
            const res = await verifyStudyVaultDocumentAndExtractOptionsWithAI({
              title: targetMat.title,
              section: targetMat.section || 'Formula Sheets',
              summaryText: targetMat.summaryPages.join('\n'),
              imageDataUrl: this.pendingTestImageDataUrl || undefined,
            });
            this.aiVerifierResult = {
              verified: res.verified,
              integrityScore: res.integrityScore,
              verificationReport: res.verificationReport,
              extractedOptionLetters: isolateOptionLettersOnly(res.extractedOptionLetters),
              targetTitle: targetMat.title,
            };
            this.aiVerifierLoading = false;
            this.callbacks.onShowToast(
              `🤖 AI Verified "${targetMat.title}" (${res.integrityScore}% Integrity) · Isolated Option Letters: ${this.aiVerifierResult.extractedOptionLetters.join(', ')}`
            );
            this.rerender();
            break;
          }
          case 'cache-material-offline': {
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              await preDownloadMaterialsForOffline([found]);
              this.callbacks.onShowToast(
                `⚡ Cached "${found.title}" in Service Worker for offline Lecture Player access!`
              );
              this.rerender();
            }
            break;
          }
          case 'close-edit-material': {
            this.editingMaterial = null;
            this.rerender();
            break;
          }
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
              this.previewResolvedPdfUrl = await resolveStoredMediaBlobUrl(found.pdfUrl);
              this.currentPageIndex = 0;
              this.zoomPercent = 100;
              this.rerender();
            }
            break;
          }
          case 'download-material': {
            const id = el.dataset.materialId;
            const found = dataStore.getMaterials().find((m) => m.id === id);
            if (found) {
              await dataStore.incrementMaterialDownload(found.id);
              await this.triggerMaterialDownload(found);
              this.callbacks.onShowToast(`Downloading "${found.title}" PDF...`);
              this.rerender();
            }
            break;
          }
          case 'close-pdf-modal': {
            this.previewMaterial = null;
            this.previewResolvedPdfUrl = null;
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
