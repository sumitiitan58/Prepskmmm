import { getCohortTheme } from '../constants';
import { dataStore } from '../services/firebaseService';
import type { StudyMaterialItem } from '../types';

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

  // In-App Secure PDF Viewer Modal State
  private previewMaterial: StudyMaterialItem | null = null;
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

        <!-- COMPACT-HEIGHT, WIDE HORIZONTAL PDF ROW LIST (Shows 5 to 6 PDFs in a single viewport!) -->
        <section
          aria-label="Compact Wide Study Material PDF List"
          data-testid="compact-pdf-list"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-4 shadow-sm space-y-2"
        >
          <div class="flex items-center justify-between px-2 py-1 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
              <span class="text-xs font-extrabold text-slate-800">
                ${this.escapeHtml(this.activeOpenedSection)} — Compact Wide PDF List (5–6 Visible at Once)
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
                class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold"
              >
                Show All PDFs in Section
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

                      <!-- Right: Compact Action Buttons (Preview & Download) -->
                      <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          data-action="preview-material"
                          data-material-id="${mat.id}"
                          class="min-h-[34px] px-3 py-1 rounded-lg bg-[#4F46E5] hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          data-action="download-material"
                          data-material-id="${mat.id}"
                          class="min-h-[34px] px-3 py-1 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-800 text-[11px] font-bold transition-colors"
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
      </div>
    `;

    this.bindEvents();
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
