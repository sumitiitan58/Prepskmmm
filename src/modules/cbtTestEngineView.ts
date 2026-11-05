import { CBT_QUESTION_BANK, getCohortTheme } from '../constants';
import { dataStore } from '../services/firebaseService';
import type {
  AdminQuestionItem,
  CBTQuestion,
  ChapterEntity,
  QuestionAttemptRow,
  QuestionStatus,
  StudentClassYear,
  SubjectName,
  TargetExam,
  TestSubmission,
} from '../types';
import {
  evaluateCBTSubmission,
  formatDuration,
  generateAIStudyDiagnosis,
  getSubjectsForExam,
  getValidInfinitePracticeCounts,
  selectAutoBalancedQuestions,
  selectInfinitePracticeEqualByChapter,
  summarizePaletteStatuses,
} from '../utils/examLogic';
import {
  renderD3ImprovementTrendGraph,
  renderD3SubjectAccuracyChart,
} from './d3Visualizations';

export interface CBTTestEngineCallbacks {
  onShowToast: (message: string) => void;
}

type CBTViewStage = 'hub' | 'exam' | 'history' | 'submitted';
type CBTEngineMode = 'MOCK' | 'INFINITE_PRACTICE';

export class CBTTestEngineModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: CBTTestEngineCallbacks;

  private stage: CBTViewStage = 'hub';
  private engineMode: CBTEngineMode = 'MOCK';

  // Configuration State
  private selectedExam: TargetExam = 'JEE';
  private selectedClassYear: StudentClassYear = 'Class 12';
  private selectedSubjects: Set<SubjectName> = new Set([
    'Physics',
    'Chemistry',
    'Math',
  ]);
  private totalQuestionCount = 10;
  private selectedMockSeriesTitle = 'All-India Full Syllabus NTA Major Mock #14';

  // Infinite Practice Equal-Per-Chapter State
  private selectedChapterIds: Set<string> = new Set([
    'ch_rotational',
    'ch_electrostatics',
    'ch_goc',
  ]);
  private infiniteTotalCount = 6;
  private activePerChapterCounts: Record<string, number> = {};

  // Active Test State
  private activeQuestions: CBTQuestion[] = [];
  private activeSubjectFilter: SubjectName | 'ALL' = 'ALL';
  private currentQuestionIndex = 0;
  private responses: Record<string, string> = {};
  private statusMap: Record<string, QuestionStatus> = {};
  private remainingSeconds = 180 * 60;
  private initialDurationSeconds = 180 * 60;
  private timerIntervalId: number | null = null;
  private isPaletteDrawerOpen = false;

  // Post-Submission & Test History State
  private lastSubmission: TestSubmission | null = null;
  private selectedHistoryTestId: string | null = null;
  private historySubjectFilter: SubjectName | 'ALL' = 'ALL';

  constructor(callbacks: CBTTestEngineCallbacks) {
    this.callbacks = callbacks;
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const user = dataStore.getUser();
    this.selectedExam = user.targetExam;
    this.selectedClassYear = user.classYear;
    this.selectedSubjects = new Set(getSubjectsForExam(user.targetExam));

    this.syncStageFromUrl();
    this.rerender();
  }

  private syncStageFromUrl(): void {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const tabParam = params.get('tab');
    const examParam = params.get('exam') as TargetExam | null;
    const classParam = params.get('class') as StudentClassYear | null;
    const titleParam = params.get('title');

    if (examParam === 'JEE' || examParam === 'NEET') {
      this.selectedExam = examParam;
      this.selectedSubjects = new Set(getSubjectsForExam(examParam));
    }
    if (classParam) {
      this.selectedClassYear = classParam;
    }
    if (titleParam) {
      this.selectedMockSeriesTitle = titleParam;
    }

    if (tabParam === 'history') {
      this.stage = 'history';
    } else if (sessionParam === 'mock' && this.activeQuestions.length === 0) {
      this.engineMode = 'MOCK';
      this.prepareExamPaper('MOCK');
      this.stage = 'exam';
    } else if (sessionParam === 'infinite' && this.activeQuestions.length === 0) {
      this.engineMode = 'INFINITE_PRACTICE';
      this.prepareExamPaper('INFINITE_PRACTICE');
      this.stage = 'exam';
    } else if (this.stage !== 'exam' && this.stage !== 'submitted' && this.stage !== 'history') {
      // Never auto-open the exam paper underneath the hub cards on /test.html
      this.stage = 'hub';
    }
  }

  public unmount(): void {
    this.stopTimer();
  }

  public refreshTargetExam(): void {
    if (this.stage === 'hub' || this.stage === 'history') {
      const user = dataStore.getUser();
      this.selectedExam = user.targetExam;
      this.selectedClassYear = user.classYear;
      this.selectedSubjects = new Set(getSubjectsForExam(user.targetExam));
      this.rerender();
    }
  }

  private buildCombinedQuestionPool(): CBTQuestion[] {
    const adminQuestions: AdminQuestionItem[] = dataStore.getAdminQuestions();
    const mappedAdmin: CBTQuestion[] = adminQuestions.map((aq, idx) => ({
      id: aq.id,
      number: 100 + idx,
      subject: aq.subjectName,
      type: aq.type === 'NUMERICAL' ? 'NAT' : 'MCQ',
      topic: aq.chapterName || `${aq.subjectName} Concept Problem`,
      classId: aq.classId,
      chapterId: aq.chapterId,
      prompt: aq.prompt,
      equationBlock: aq.equationBlock,
      questionImg: aq.questionImg,
      solutionImg: aq.solutionImg,
      options: aq.options ?? [
        'Option A (See Question Image)',
        'Option B (See Question Image)',
        'Option C (See Question Image)',
        'Option D (See Question Image)',
      ],
      correctAnswer:
        aq.type === 'MCQ' && aq.options
          ? aq.options[Number(aq.correctVal) || 0] ?? aq.correctVal
          : aq.correctVal,
      solution: aq.solutionText,
    }));

    return [...mappedAdmin, ...CBT_QUESTION_BANK];
  }

  public rerender(): void {
    if (!this.containerEl) return;

    // 1. DEDICATED FULL-SCREEN EXAM PAGE (Opened only when user launches Mock Test or Infinite Practice!)
    if (this.stage === 'exam') {
      this.containerEl.innerHTML = this.renderDedicatedExamStage();
      this.bindEvents();
      return;
    }

    // 2. TEST HISTORY, PERFORMANCE GRAPHS & ROW-BY-ROW SOLUTIONS VIEW
    if (this.stage === 'history' || this.stage === 'submitted') {
      this.containerEl.innerHTML = `
        <div class="space-y-6 pb-12" data-testid="cbt-history-page">
          ${this.renderTopHubBanner()}
          ${this.renderTestHistoryAndAnalyticsStage()}
        </div>
      `;
      this.mountHistoryD3Charts();
      this.bindEvents();
      return;
    }

    // 3. DEFAULT HUB VIEW (Choose Mock Test OR Infinite Practice OR Test History — no active paper cluttered below!)
    this.containerEl.innerHTML = `
      <div class="space-y-6 pb-12" data-testid="cbt-test-hub-page">
        ${this.renderTopHubBanner()}
        ${this.renderHubConfigStage()}
      </div>
    `;
    this.bindEvents();
  }

  private renderTopHubBanner(): string {
    const submissions = dataStore.getTestSubmissions();
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const isHistoryActive = this.stage === 'history' || this.stage === 'submitted';

    return `
      <section
        aria-label="CBT Mode & Test History Switcher"
        class="rounded-3xl bg-gradient-to-r from-[#4F46E5] via-indigo-600 to-violet-600 p-5 sm:p-6 text-white shadow-md"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-amber-200 text-[11px] font-extrabold uppercase tracking-wider">
              ⚡ ${this.escapeHtml(cohortTheme.badgeText)} · CBT Examination Portal
            </span>
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight">
              Mock Test Hub, Infinite Practice & Test History
            </h1>
            <p class="text-xs text-indigo-100 max-w-2xl">
              Every Mock Test & Infinite Practice launches in its own dedicated full-screen exam page. Inspect your previous tests, performance graphs & row-by-row answer keys anytime.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-action="switch-engine-mode"
              data-mode="MOCK"
              class="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
                !isHistoryActive && this.engineMode === 'MOCK'
                  ? 'bg-white text-[#4F46E5] shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }"
            >
              🎯 1. Official Mock Test
            </button>
            <button
              type="button"
              data-action="switch-engine-mode"
              data-mode="INFINITE_PRACTICE"
              class="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
                !isHistoryActive && this.engineMode === 'INFINITE_PRACTICE'
                  ? 'bg-[#10B981] text-white shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }"
            >
              ♾️ 2. Infinite Practice
            </button>
            <button
              type="button"
              data-action="open-test-history"
              data-testid="open-test-history-btn"
              class="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
                isHistoryActive
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }"
            >
              📊 Test History & Solutions (${submissions.length})
            </button>
            <button
              type="button"
              data-action="share-invite-test"
              data-testid="invite-friend-test-btn"
              class="min-h-[42px] px-3.5 py-2 rounded-2xl bg-slate-900/40 hover:bg-slate-900/60 border border-white/30 text-xs font-extrabold text-white transition-all"
            >
              🔗 Invite Friend
            </button>
          </div>
        </div>
      </section>
    `;
  }

  private renderHubConfigStage(): string {
    const classYears: StudentClassYear[] = [
      'Class 12',
      'Class 11',
      'Dropper',
      'Class 11 Foundation',
      'Class 10 Foundation',
      'Class 10',
      'Class 9',
    ];

    if (this.engineMode === 'INFINITE_PRACTICE') {
      return this.renderInfinitePracticeConfig(classYears);
    }

    const validSubjects = getSubjectsForExam(this.selectedExam);
    const submissions = dataStore.getTestSubmissions();
    const cohortTheme = getCohortTheme(this.selectedExam, this.selectedClassYear);

    const mockSeriesCards = [
      {
        title: `All-India ${this.selectedExam} (${this.selectedClassYear}) Full Syllabus Major Mock #14`,
        badge: 'LIVE OFFICIAL NTA PATTERN',
        questionCount: 10,
        durationMins: 20,
        syllabus: 'High-Weightage Physics, Chemistry & Mathematics/Biology PYQ + New Pattern',
        borderCls: 'border-indigo-200 bg-indigo-50/40',
      },
      {
        title: `${this.selectedClassYear} High-Yield Part Syllabus Rank Booster #15`,
        badge: 'RANK BOOSTER SERIES',
        questionCount: 15,
        durationMins: 30,
        syllabus: 'Core Mechanics, Electrostatics, Organic Mechanisms & Calculus/Genetics Drill',
        borderCls: 'border-emerald-200 bg-emerald-50/40',
      },
      {
        title: `Rapid Fire ${this.selectedExam} Speed & Accuracy Sprint #16`,
        badge: 'SPEED SPRINT',
        questionCount: 20,
        durationMins: 40,
        syllabus: 'Topper Trap MCQs & Numerical Value (NAT) Precision Test',
        borderCls: 'border-amber-200 bg-amber-50/40',
      },
    ];

    return `
      <div class="space-y-6" data-testid="mock-test-launcher-hub">
        <!-- Quick-Launch Mock Test Series Cards (Opens in Dedicated Exam Page + Invite Friend) -->
        <section class="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4F46E5] text-xs font-extrabold">
                  ${this.escapeHtml(cohortTheme.label)}
                </span>
                <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#10B981] text-xs font-extrabold">
                  Opens in Separate Full-Screen Exam Page
                </span>
              </div>
              <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-1.5">
                Featured All-India Mock Tests for ${this.selectedExam} · ${this.selectedClassYear}
              </h2>
              <p class="text-xs text-slate-500">
                Click "Open Mock in New Exam Page" to enter the dedicated NTA test room, or click "Invite Friend" to share a direct test link.
              </p>
            </div>
            <button
              type="button"
              data-action="open-test-history"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-extrabold text-slate-700 shrink-0"
            >
              📊 View Previous Tests & Solutions (${submissions.length}) →
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            ${mockSeriesCards
              .map(
                (series) => `
              <div class="rounded-2xl border ${series.borderCls} p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-all">
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 rounded-md bg-white text-[#4F46E5] text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                      ${series.badge}
                    </span>
                    <span class="font-mono-tabular text-xs font-bold text-slate-600">
                      ${series.durationMins} Mins · ${series.questionCount} Qs
                    </span>
                  </div>
                  <h3 class="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                    ${this.escapeHtml(series.title)}
                  </h3>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    ${this.escapeHtml(series.syllabus)}
                  </p>
                </div>

                <div class="pt-3 border-t border-slate-200/70 flex items-center gap-2">
                  <button
                    type="button"
                    data-action="launch-series-mock"
                    data-title="${this.escapeHtml(series.title)}"
                    data-count="${series.questionCount}"
                    class="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-[#4F46E5] text-white text-xs font-extrabold transition-colors"
                  >
                    Open Mock Page →
                  </button>
                  <button
                    type="button"
                    data-action="share-invite-test"
                    data-title="${this.escapeHtml(series.title)}"
                    class="min-h-[40px] px-3 py-2 rounded-xl bg-white hover:bg-indigo-50 border border-slate-300 text-xs font-bold text-slate-700"
                    title="Copy Invite Link for Friends"
                  >
                    🔗 Invite
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Custom Auto-Balanced NTA Mock Builder -->
        <section
          aria-label="CBT Mock Test Configuration"
          class="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div class="space-y-1.5 border-b border-slate-100 pb-4">
            <span class="px-2.5 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] text-xs font-extrabold uppercase tracking-wider">
              Custom NTA Mock Builder · Dedicated Exam Room
            </span>
            <h2 class="text-lg sm:text-xl font-extrabold text-slate-900">
              Or Customize Your Own Auto-Balanced NTA Mock Test
            </h2>
            <p class="text-xs sm:text-sm text-slate-500">
              Choose JEE, NEET, Class 9, 10, 11, 12, or Dropper. JEE enforces <strong>80% Single-Choice MCQs + 20% Numerical (NAT)</strong>; NEET enforces <strong>100% MCQs</strong>.
            </p>
          </div>

          <!-- Step 1: Class / Cohort Selection -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Select Class / Cohort (9th, 10th, 11th, 12th, Dropper)
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              ${classYears
                .map((cy) => {
                  const active = this.selectedClassYear === cy;
                  return `
                  <button
                    type="button"
                    data-action="select-class-cohort"
                    data-class="${cy}"
                    class="min-h-[42px] px-3 py-2 rounded-xl border text-xs font-extrabold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#4F46E5] to-violet-600 border-transparent text-white shadow-sm'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-white'
                    }"
                  >
                    ${cy}
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Step 2: Target Exam Stream -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Select Exam Pattern
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${(['JEE', 'NEET'] as TargetExam[])
                .map((exam) => {
                  const active = this.selectedExam === exam;
                  return `
                  <button
                    type="button"
                    data-action="select-cbt-exam"
                    data-exam="${exam}"
                    class="min-h-[54px] p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                      active
                        ? 'bg-indigo-50/70 border-[#4F46E5] ring-2 ring-[#4F46E5]/15'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white'
                    }"
                  >
                    <div>
                      <div class="text-sm font-bold text-slate-900">
                        ${exam === 'JEE' ? 'JEE Main / Advanced Pattern' : 'NEET UG Medical Pattern'}
                      </div>
                      <div class="text-xs text-slate-500 mt-0.5">
                        ${
                          exam === 'JEE'
                            ? '80% Single-Choice MCQ + 20% Numerical Value (NAT)'
                            : '100% Single-Choice MCQ (Physics, Chemistry, Biology)'
                        }
                      </div>
                    </div>
                    <span class="w-5 h-5 rounded-full border flex items-center justify-center ${
                      active ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-slate-300'
                    }">
                      ${active ? '✓' : ''}
                    </span>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Step 3: Subject Selection -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Include Subjects
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              ${validSubjects
                .map((sub) => {
                  const checked = this.selectedSubjects.has(sub);
                  return `
                  <button
                    type="button"
                    data-action="toggle-cbt-subject"
                    data-subject="${sub}"
                    class="min-h-[46px] px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      checked
                        ? 'bg-emerald-50/70 border-[#10B981] text-slate-900 font-bold'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600'
                    }"
                  >
                    <span class="text-xs sm:text-sm">${sub}</span>
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold ${
                      checked ? 'bg-[#10B981] text-white' : 'bg-slate-200 text-slate-600'
                    }">
                      ${checked ? 'Included' : 'Excluded'}
                    </span>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Step 4: Total Questions Count -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              4. Number of Questions
            </label>
            <div class="grid grid-cols-3 gap-3">
              ${[5, 10, 15]
                .map((cnt) => {
                  const active = this.totalQuestionCount === cnt;
                  const mcqCnt =
                    this.selectedExam === 'JEE' ? cnt - Math.round(cnt * 0.2) : cnt;
                  const natCnt =
                    this.selectedExam === 'JEE' ? Math.round(cnt * 0.2) : 0;
                  return `
                  <button
                    type="button"
                    data-action="select-cbt-count"
                    data-count="${cnt}"
                    class="min-h-[52px] p-3 rounded-xl border text-center transition-all ${
                      active
                        ? 'bg-[#4F46E5] border-[#4F46E5] text-white font-bold shadow-sm'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-white'
                    }"
                  >
                    <div class="text-sm font-mono-tabular font-bold">${cnt} Questions</div>
                    <div class="text-[11px] ${active ? 'text-indigo-100' : 'text-slate-500'}">
                      ${mcqCnt} MCQ${natCnt > 0 ? ` + ${natCnt} NAT` : ''}
                    </div>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-xs text-slate-500 font-mono-tabular">
              Marking: <strong class="text-[#10B981]">+4 Correct</strong> · <strong class="text-[#EF4444]">-1 Wrong</strong> · <strong>0 Unattempted</strong>
            </div>
            <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                data-action="share-invite-test"
                class="min-h-[48px] px-4 py-3 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 text-xs font-extrabold"
              >
                🔗 Invite Friend
              </button>
              <button
                type="button"
                data-action="start-cbt-exam"
                data-testid="launch-dedicated-mock-btn"
                class="flex-1 sm:flex-initial min-h-[48px] px-6 py-3 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-sm font-extrabold shadow-sm transition-colors"
              >
                Launch Dedicated ${this.selectedExam} (${this.selectedClassYear}) Mock Page →
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private renderInfinitePracticeConfig(classYears: StudentClassYear[]): string {
    const allChapters = dataStore.getChapters();
    const allSubjects = dataStore.getSubjects();
    const selectedChapterCount = Math.max(1, this.selectedChapterIds.size);
    const validMultiples = getValidInfinitePracticeCounts(selectedChapterCount);

    if (!validMultiples.includes(this.infiniteTotalCount)) {
      this.infiniteTotalCount = validMultiples[1] ?? validMultiples[0];
    }
    const questionsPerChapter = Math.round(
      this.infiniteTotalCount / selectedChapterCount
    );

    return `
      <div class="max-w-4xl mx-auto">
        <section
          aria-label="Infinite Practice Configuration"
          class="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div class="space-y-1">
              <span class="px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#10B981] text-xs font-extrabold uppercase tracking-wider">
                Infinite Practice Engine · Equal Questions Per Chapter Rule
              </span>
              <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900">
                Multi-Chapter Equal Distribution Practice
              </h2>
              <p class="text-xs sm:text-sm text-slate-600">
                Select any number of chapters (<strong>N</strong>). Total questions is strictly a multiple of <strong>N</strong> so every selected chapter receives the exact same number of questions.
              </p>
            </div>

            <div class="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-200 text-center shrink-0">
              <div class="text-[11px] font-bold text-slate-500 uppercase">Equal Split</div>
              <div class="text-lg font-mono-tabular font-extrabold text-[#4F46E5]">
                ${selectedChapterCount} Ch × ${questionsPerChapter} Q = ${this.infiniteTotalCount} Qs
              </div>
            </div>
          </div>

          <!-- Step 1: Class / Cohort Selection -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Choose Class / Target Cohort
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
              ${classYears
                .map((cy) => {
                  const active = this.selectedClassYear === cy;
                  return `
                  <button
                    type="button"
                    data-action="select-class-cohort"
                    data-class="${cy}"
                    class="min-h-[40px] px-3 py-2 rounded-xl border text-xs font-extrabold transition-all ${
                      active
                        ? 'bg-[#10B981] border-[#10B981] text-white shadow-xs'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-white'
                    }"
                  >
                    ${cy}
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Step 2: Select Any Number of Chapters (Dynamic N-Multiplier Rule) -->
          <div class="space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Select Any Number of Chapters (${selectedChapterCount} Selected — Not Fixed to 3!)
              </label>
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-action="quick-select-chapter-count"
                  data-count="1"
                  class="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-indigo-50 border border-[#E2E8F0] text-[11px] font-bold text-slate-700"
                >
                  Select 1 Ch
                </button>
                <button
                  type="button"
                  data-action="quick-select-chapter-count"
                  data-count="2"
                  class="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-indigo-50 border border-[#E2E8F0] text-[11px] font-bold text-slate-700"
                >
                  Select 2 Ch
                </button>
                <button
                  type="button"
                  data-action="quick-select-chapter-count"
                  data-count="4"
                  class="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-indigo-50 border border-[#E2E8F0] text-[11px] font-bold text-slate-700"
                >
                  Select 4 Ch
                </button>
                <button
                  type="button"
                  data-action="quick-select-chapter-count"
                  data-count="${allChapters.length}"
                  class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-extrabold text-[#4F46E5]"
                >
                  Select All (${allChapters.length} Ch)
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
              ${allChapters
                .map((ch) => {
                  const checked = this.selectedChapterIds.has(ch.id);
                  const sub = allSubjects.find((s) => s.id === ch.subjectId);
                  return `
                  <button
                    type="button"
                    data-action="toggle-infinite-chapter"
                    data-chapter-id="${ch.id}"
                    class="min-h-[50px] p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                      checked
                        ? 'bg-indigo-50/80 border-[#4F46E5] text-slate-900 shadow-2xs'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:bg-white'
                    }"
                  >
                    <div class="min-w-0">
                      <div class="text-xs font-bold truncate">${this.escapeHtml(ch.name)}</div>
                      <div class="text-[10px] text-slate-500">${this.escapeHtml(sub?.name ?? 'Subject')}</div>
                    </div>
                    <span class="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      checked ? 'bg-[#4F46E5] text-white' : 'border border-slate-300 bg-white'
                    }">
                      ${checked ? '✓' : ''}
                    </span>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Step 3: Total Question Count (Multiples of Selected Chapters Only) -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Total Questions (Multiples of ${selectedChapterCount} Selected Chapter${selectedChapterCount > 1 ? 's' : ''}: ${validMultiples.slice(0, 6).join(', ')}...)
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              ${validMultiples.slice(0, 8).map((totalQ) => {
                const perCh = Math.round(totalQ / selectedChapterCount);
                const active = this.infiniteTotalCount === totalQ;
                return `
                  <button
                    type="button"
                    data-action="select-infinite-multiple"
                    data-total="${totalQ}"
                    class="min-h-[54px] p-3 rounded-xl border text-center transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#10B981] to-teal-600 border-transparent text-white font-extrabold shadow-sm'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-700 hover:bg-white'
                    }"
                  >
                    <div class="text-sm font-mono-tabular font-extrabold">${totalQ} Questions</div>
                    <div class="text-[11px] ${active ? 'text-emerald-100' : 'text-slate-500'}">
                      ${perCh} Q per chapter
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-xs text-slate-600">
              Guaranteed equal distribution: <strong>${questionsPerChapter} questions</strong> from each of the <strong>${selectedChapterCount} chapters</strong>.
            </div>
            <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                data-action="share-invite-test"
                class="min-h-[48px] px-4 py-3 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-700 text-xs font-extrabold"
              >
                🔗 Invite Friend
              </button>
              <button
                type="button"
                data-action="start-cbt-exam"
                data-testid="launch-infinite-session-btn"
                class="flex-1 sm:flex-initial min-h-[48px] px-6 py-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-sm font-extrabold shadow-sm transition-colors"
              >
                Start Infinite Practice in Dedicated Page (${this.infiniteTotalCount} Qs) →
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private renderDedicatedExamStage(): string {
    const filteredQuestions =
      this.activeSubjectFilter === 'ALL'
        ? this.activeQuestions
        : this.activeQuestions.filter((q) => q.subject === this.activeSubjectFilter);

    const currentQ =
      this.activeQuestions[this.currentQuestionIndex] ?? this.activeQuestions[0];
    if (!currentQ) return '';

    const currentAnswer = this.responses[currentQ.id] ?? '';
    const paletteSummary = summarizePaletteStatuses(
      this.activeQuestions.map((q) => q.id),
      this.statusMap
    );

    const subjectsInTest = Array.from(
      new Set(this.activeQuestions.map((q) => q.subject))
    );

    return `
      <div class="space-y-4 pb-14" data-testid="dedicated-exam-screen">
        <!-- Dedicated Full-Screen Exam Top Header (No Mode Switcher Clutter!) -->
        <header class="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              type="button"
              data-action="exit-exam-to-hub"
              data-testid="exit-exam-to-hub-btn"
              class="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-extrabold text-slate-700"
            >
              ← Exit to Hub
            </button>
            <span class="px-2.5 py-1 rounded-lg ${
              this.engineMode === 'INFINITE_PRACTICE'
                ? 'bg-emerald-50 text-[#10B981]'
                : 'bg-indigo-50 text-[#4F46E5]'
            } text-xs font-extrabold">
              ${this.engineMode === 'INFINITE_PRACTICE' ? '♾️ Infinite Practice' : `🎯 ${this.selectedExam}`} · ${this.selectedClassYear}
            </span>
            <div class="hidden sm:block text-xs font-bold text-slate-700 truncate max-w-xs">
              ${
                this.engineMode === 'INFINITE_PRACTICE'
                  ? `${this.selectedChapterIds.size} Chapters Equal Split`
                  : this.escapeHtml(this.selectedMockSeriesTitle)
              }
            </div>
          </div>

          <!-- Subject Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-action="filter-exam-subject"
              data-subject="ALL"
              class="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                this.activeSubjectFilter === 'ALL'
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
              }"
            >
              All (${this.activeQuestions.length})
            </button>
            ${subjectsInTest
              .map(
                (sub) => `
              <button
                type="button"
                data-action="filter-exam-subject"
                data-subject="${sub}"
                class="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  this.activeSubjectFilter === sub
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-100'
                }"
              >
                ${sub}
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Countdown Timer, Invite Friend, Mobile/Tablet Drawer Toggle & Submit -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-action="share-invite-test"
              class="hidden md:inline-flex min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-xs font-extrabold items-center gap-1"
            >
              🔗 Invite Friend
            </button>
            <div class="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono-tabular text-xs sm:text-sm font-bold">
              ⏱ <span id="cbt-live-timer">${formatDuration(this.remainingSeconds, true)}</span>
            </div>
            <button
              type="button"
              data-action="toggle-palette-drawer"
              class="lg:hidden min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-700"
            >
              Palette (${paletteSummary.answered}/${this.activeQuestions.length})
            </button>
            <button
              type="button"
              data-action="submit-cbt-paper"
              data-testid="submit-cbt-test-btn"
              class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
            >
              Submit Test
            </button>
          </div>
        </header>

        <!-- Mobile/Tablet Swipeable Question Number Strip -->
        <div class="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar bg-white border border-[#E2E8F0] rounded-2xl p-2.5 shadow-2xs">
          ${this.activeQuestions
            .map((q, idx) => {
              const st = this.statusMap[q.id] ?? 'not_visited';
              const isCurrent = idx === this.currentQuestionIndex;
              const badgeCls =
                st === 'answered'
                  ? 'bg-[#10B981] text-white'
                  : st === 'not_answered'
                    ? 'bg-[#EF4444] text-white'
                    : st === 'marked_review' || st === 'answered_marked_review'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700';
              return `
                <button
                  type="button"
                  data-action="jump-to-question"
                  data-index="${idx}"
                  class="w-8 h-8 shrink-0 rounded-lg font-mono-tabular text-xs font-bold flex items-center justify-center ${badgeCls} ${
                    isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                  }"
                >
                  ${q.number}
                </button>
              `;
            })
            .join('')}
        </div>

        <!-- Split Screen: Left 70% Question Canvas | Right 30% Question Palette -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <!-- Left 8 Cols: Single-Question Viewport -->
          <section
            aria-label="Active Question Viewport"
            class="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[460px]"
          >
            <div class="space-y-5">
              <!-- Question Meta Header -->
              <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono-tabular text-xs font-bold">
                    Q.${currentQ.number}
                  </span>
                  <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#4F46E5] text-xs font-bold">
                    ${currentQ.subject}
                  </span>
                  <span class="text-xs text-slate-500 font-medium">
                    ${this.escapeHtml(currentQ.topic)}
                  </span>
                </div>
                <div class="flex items-center gap-2 font-mono-tabular text-xs">
                  <span class="px-2 py-0.5 rounded bg-emerald-50 text-[#10B981] font-bold">+4</span>
                  <span class="px-2 py-0.5 rounded bg-red-50 text-[#EF4444] font-bold">-1</span>
                  <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">${currentQ.type}</span>
                </div>
              </div>

              <!-- Question Viewport: Enlarged Question Image (No Cluttered Text Above Image) -->
              <div class="space-y-3" data-testid="cbt-question-display">
                ${
                  currentQ.questionImg
                    ? `
                  <div class="rounded-2xl overflow-hidden border-2 border-indigo-200 bg-white p-2 sm:p-4 shadow-xs">
                    <img
                      src="${currentQ.questionImg}"
                      alt="Question Diagram"
                      data-testid="cbt-enlarged-question-image"
                      referrerpolicy="no-referrer"
                      class="w-full max-h-[420px] sm:max-h-[480px] mx-auto object-contain rounded-xl"
                    />
                  </div>
                `
                    : `
                  <p class="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                    ${this.escapeHtml(currentQ.prompt)}
                  </p>
                  ${
                    currentQ.equationBlock
                      ? `
                    <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono-tabular text-xs sm:text-sm text-indigo-950 overflow-x-auto">
                      ${this.escapeHtml(currentQ.equationBlock)}
                    </div>
                  `
                      : ''
                  }
                `
                }
              </div>

              <!-- MCQ Options (Compact Single Row A B C D) OR Virtual Numerical Keypad -->
              ${
                currentQ.type === 'MCQ' && currentQ.options
                  ? `
                <div class="space-y-3 pt-2">
                  ${
                    !currentQ.questionImg
                      ? `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                      ${currentQ.options
                        .map((opt, idx) => {
                          const optLetter = ['A', 'B', 'C', 'D'][idx] ?? 'A';
                          return `<div class="flex items-start gap-2"><span class="font-mono-tabular font-extrabold text-[#4F46E5]">(${optLetter})</span><span>${this.escapeHtml(opt)}</span></div>`;
                        })
                        .join('')}
                    </div>
                  `
                      : ''
                  }
                  <div class="space-y-1.5">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Select Option (Single Compact Row A · B · C · D)
                    </span>
                    <div
                      data-testid="single-row-abcd-options"
                      class="grid grid-cols-4 gap-2 sm:gap-3"
                    >
                      ${currentQ.options
                        .slice(0, 4)
                        .map((opt, idx) => {
                          const optLetter = ['A', 'B', 'C', 'D'][idx] ?? 'A';
                          const selected = currentAnswer === opt;
                          return `
                          <button
                            type="button"
                            data-action="select-mcq-option"
                            data-option="${this.escapeHtml(opt)}"
                            data-option-letter="${optLetter}"
                            class="min-h-[44px] px-2.5 py-2 rounded-xl border text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#4F46E5] border-[#4F46E5] text-white font-extrabold shadow-sm ring-2 ring-[#4F46E5]/25'
                                : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-indigo-50/60 hover:border-indigo-300 text-slate-800 font-bold'
                            }"
                          >
                            <span class="w-6 h-6 rounded-lg font-mono-tabular text-xs font-extrabold flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-white text-[#4F46E5]'
                                : 'bg-white border border-slate-200 text-slate-800'
                            }">
                              ${optLetter}
                            </span>
                            <span class="text-xs font-extrabold hidden sm:inline truncate">Option ${optLetter}</span>
                          </button>
                        `;
                        })
                        .join('')}
                    </div>
                  </div>
                </div>
              `
                  : `
                <div class="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 max-w-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-600 uppercase">Numerical Response</span>
                    <span class="font-mono-tabular text-sm font-bold text-[#4F46E5]">
                      ${currentAnswer || '—'}
                    </span>
                  </div>
                  <input
                    id="cbt-nat-input"
                    type="text"
                    value="${this.escapeHtml(currentAnswer)}"
                    placeholder="Enter numerical value"
                    class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] font-mono-tabular text-sm font-bold text-slate-900"
                  />
                  <div class="grid grid-cols-4 gap-1.5">
                    ${['7', '8', '9', 'DEL', '4', '5', '6', '-', '1', '2', '3', '.', '0', 'CLR']
                      .map(
                        (key) => `
                      <button
                        type="button"
                        data-action="nat-keypad"
                        data-key="${key}"
                        class="min-h-[38px] rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-100 font-mono-tabular text-xs font-bold text-slate-800 ${
                          key === 'CLR' ? 'col-span-2 text-[#EF4444]' : ''
                        }"
                      >
                        ${key}
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
              }
            </div>

            <!-- Bottom NTA Control Bar -->
            <div class="pt-5 mt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-action="clear-response"
                  class="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-semibold text-slate-700"
                >
                  Clear Response
                </button>
                <button
                  type="button"
                  data-action="mark-review-next"
                  class="min-h-[40px] px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-bold text-purple-700"
                >
                  Mark for Review & Next
                </button>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="prev-question"
                  ${this.currentQuestionIndex === 0 ? 'disabled' : ''}
                  class="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  data-action="save-and-next"
                  class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  Save & Next →
                </button>
              </div>
            </div>
          </section>

          <!-- Right 4 Cols: NTA Question Palette Matrix -->
          <aside
            aria-label="NTA Question Palette"
            class="${
              this.isPaletteDrawerOpen
                ? 'fixed inset-x-4 bottom-20 z-40 lg:static'
                : 'hidden lg:block'
            } lg:col-span-4 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 class="text-sm font-bold text-slate-900">NTA Question Palette</h2>
              <span class="text-xs font-mono-tabular text-slate-500">
                ${filteredQuestions.length} Shown
              </span>
            </div>

            <!-- Legend -->
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 rounded bg-[#10B981] inline-block"></span>
                <span class="text-slate-600">Answered (${paletteSummary.answered})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 rounded bg-[#EF4444] inline-block"></span>
                <span class="text-slate-600">Not Answered (${paletteSummary.notAnswered})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 rounded bg-purple-600 inline-block"></span>
                <span class="text-slate-600">Marked (${paletteSummary.markedReview})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 rounded bg-slate-200 inline-block"></span>
                <span class="text-slate-600">Not Visited (${paletteSummary.notVisited})</span>
              </div>
            </div>

            <!-- Question Number Buttons -->
            <div class="grid grid-cols-5 gap-2 pt-2">
              ${this.activeQuestions
                .map((q, idx) => {
                  const st = this.statusMap[q.id] ?? 'not_visited';
                  const isCurrent = idx === this.currentQuestionIndex;
                  const colorClass =
                    st === 'answered'
                      ? 'bg-[#10B981] text-white border-[#10B981]'
                      : st === 'not_answered'
                        ? 'bg-[#EF4444] text-white border-[#EF4444]'
                        : st === 'marked_review' || st === 'answered_marked_review'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-[#F8FAFC] text-slate-700 border-[#E2E8F0]';
                  return `
                  <button
                    type="button"
                    data-action="jump-to-question"
                    data-index="${idx}"
                    class="min-h-[40px] rounded-xl border font-mono-tabular text-xs font-bold transition-all ${colorClass} ${
                      isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                    }"
                  >
                    ${q.number}
                  </button>
                `;
                })
                .join('')}
            </div>

            <div class="pt-3 border-t border-slate-100">
              <button
                type="button"
                data-action="submit-cbt-paper"
                class="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors"
              >
                Final Submit & View Solutions Row-by-Row →
              </button>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private renderTestHistoryAndAnalyticsStage(): string {
    const submissions = dataStore.getTestSubmissions();
    if (submissions.length === 0) {
      return `
        <div class="bg-white border border-[#E2E8F0] rounded-3xl p-10 text-center space-y-3">
          <h2 class="text-lg font-extrabold text-slate-900">No Test History Yet</h2>
          <p class="text-xs text-slate-500">Launch a Mock Test or Infinite Practice session to record your score, graphs, and row-by-row solutions.</p>
          <button
            type="button"
            data-action="reconfigure-cbt"
            class="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold"
          >
            Go to Mock Test Hub →
          </button>
        </div>
      `;
    }

    const activeSub =
      submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
      this.lastSubmission ??
      submissions[0];
    this.selectedHistoryTestId = activeSub.testId;

    const maxScore = activeSub.maxScore ?? Math.max(4, (activeSub.totalQuestions ?? 6) * 4);
    const accuracy = activeSub.accuracyPercent ?? 0;
    const subEntries = Object.values(activeSub.subjectBreakdown || {});

    // Ensure questionRows are always available
    const questionRows: QuestionAttemptRow[] =
      activeSub.questionRows && activeSub.questionRows.length > 0
        ? activeSub.questionRows
        : this.buildFallbackQuestionRows();

    const filteredRows =
      this.historySubjectFilter === 'ALL'
        ? questionRows
        : questionRows.filter((r) => r.subject === this.historySubjectFilter);

    const skippedCount = Math.max(
      0,
      questionRows.length - activeSub.correctCount - activeSub.wrongCount
    );

    return `
      <div class="space-y-6" data-testid="test-history-analytics-view">
        <!-- 1. Previous Test Attempts Selector Strip -->
        <section class="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Firebase Synced Exam Archive
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                Your Previous Test History (${submissions.length} Attempts)
              </h2>
            </div>
            <button
              type="button"
              data-action="reconfigure-cbt"
              class="min-h-[38px] px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-xs font-extrabold self-start sm:self-auto"
            >
              + Attempt New Mock / Practice Test
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${submissions
              .map((sub) => {
                const isSelected = sub.testId === activeSub.testId;
                const subMax = sub.maxScore ?? (sub.totalQuestions ?? 6) * 4;
                const dateStr = sub.timestamp ? sub.timestamp.split('T')[0] : '2026-11-04';
                return `
                  <button
                    type="button"
                    data-action="select-history-test"
                    data-test-id="${sub.testId}"
                    class="p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-[#4F46E5] ring-2 ring-[#4F46E5]/15'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white'
                    }"
                  >
                    <div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="px-2 py-0.5 rounded bg-white border border-indigo-100 text-[10px] font-extrabold text-[#4F46E5] uppercase">
                          ${sub.mode === 'INFINITE_PRACTICE' ? 'Infinite Practice' : `${sub.examType ?? 'JEE'} Mock`}
                        </span>
                        <span class="font-mono-tabular text-[11px] text-slate-500">${dateStr}</span>
                      </div>
                      <div class="text-xs sm:text-sm font-extrabold text-slate-900 mt-2 line-clamp-1">
                        ${this.escapeHtml(sub.title || `${sub.examType ?? 'JEE'} Full Test (${sub.classYear ?? 'Class 12'})`)}
                      </div>
                    </div>

                    <div class="pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                      <span class="font-mono-tabular font-extrabold text-slate-900">
                        Score: ${sub.score} / ${subMax}
                      </span>
                      <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono-tabular text-[11px] font-bold">
                        ${sub.accuracyPercent ?? 80}% Acc
                      </span>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- 2. Visual Performance Graphs & Subject Score Analytics -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <!-- Left 5 Cols: Score Summary & Accuracy Distribution Bar -->
          <section class="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div class="space-y-2">
              <span class="px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#10B981] text-xs font-extrabold uppercase">
                Selected Attempt Scorecard
              </span>
              <h3 class="text-lg font-extrabold text-slate-900">
                ${this.escapeHtml(activeSub.title || `${activeSub.examType ?? 'JEE'} Assessment`)}
              </h3>
              <p class="text-xs text-slate-500">
                Time Taken: ${formatDuration(activeSub.timeTaken)} · Cohort: ${activeSub.classYear ?? 'Class 12'}
              </p>

              <div class="grid grid-cols-3 gap-2.5 pt-3 text-center">
                <div class="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                  <div class="text-[10px] font-bold uppercase text-[#4F46E5]">Net Score</div>
                  <div class="text-xl font-mono-tabular font-extrabold text-slate-900 mt-1">
                    ${activeSub.score}<span class="text-xs text-slate-400">/${maxScore}</span>
                  </div>
                </div>
                <div class="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <div class="text-[10px] font-bold uppercase text-[#10B981]">Accuracy</div>
                  <div class="text-xl font-mono-tabular font-extrabold text-[#10B981] mt-1">
                    ${accuracy}%
                  </div>
                </div>
                <div class="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <div class="text-[10px] font-bold uppercase text-amber-700">Correct / Wrong</div>
                  <div class="text-xl font-mono-tabular font-extrabold text-slate-900 mt-1">
                    <span class="text-[#10B981]">${activeSub.correctCount}</span>/<span class="text-[#EF4444]">${activeSub.wrongCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Visual Distribution Bar -->
            <div class="pt-4 border-t border-slate-100 space-y-2">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="text-[#10B981]">✓ Correct: ${activeSub.correctCount}</span>
                <span class="text-[#EF4444]">✕ Wrong: ${activeSub.wrongCount}</span>
                <span class="text-slate-500">○ Unattempted: ${skippedCount}</span>
              </div>
              <div class="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div style="width: ${(activeSub.correctCount / Math.max(1, questionRows.length)) * 100}%" class="bg-[#10B981]"></div>
                <div style="width: ${(activeSub.wrongCount / Math.max(1, questionRows.length)) * 100}%" class="bg-[#EF4444]"></div>
                <div style="width: ${(skippedCount / Math.max(1, questionRows.length)) * 100}%" class="bg-slate-300"></div>
              </div>
            </div>
          </section>

          <!-- Right 7 Cols: D3.js Subject-Wise Score & Accuracy Graph + Trend -->
          <section
            aria-label="Subject Performance Graph"
            data-testid="test-performance-graph"
            class="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm space-y-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-extrabold text-slate-900">
                  D3.js Subject-Wise Accuracy & Performance Trend
                </h3>
                <p class="text-xs text-slate-500">
                  Interactive D3.js SVG visualization of subject accuracy and chronological mock improvement
                </p>
              </div>
              <a
                href="/test-history.html"
                class="px-3 py-1.5 rounded-xl bg-[#4F46E5] text-white text-xs font-extrabold hover:bg-indigo-700 transition-colors"
              >
                Open Dedicated Test History Page →
              </a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div id="d3-cbt-subject-accuracy" class="w-full min-h-[210px]"></div>
              <div id="d3-cbt-improvement-trend" class="w-full min-h-[210px]"></div>
            </div>
          </section>
        </div>

        <!-- 3. Row-by-Row Question, User Answer, Correct Key & Solution Table ("in a row") -->
        <section
          aria-label="Row-by-Row Question and Solution Review"
          data-testid="answer-key-row-list"
          class="bg-white border border-[#E2E8F0] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Complete Answer Key & Solutions In A Row
              </span>
              <h3 class="text-lg font-extrabold text-slate-900">
                Questions, Your Answers, Correct Keys & Official Solutions (${filteredRows.length} Rows)
              </h3>
            </div>

            <div class="flex flex-wrap gap-1.5">
              ${(['ALL', 'Physics', 'Chemistry', 'Math', 'Biology'] as const)
                .map(
                  (subj) => `
                <button
                  type="button"
                  data-action="filter-history-subject"
                  data-subject="${subj}"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    this.historySubjectFilter === subj
                      ? 'bg-slate-900 text-white'
                      : 'bg-[#F8FAFC] border border-[#E2E8F0] text-slate-600 hover:bg-slate-100'
                  }"
                >
                  ${subj === 'ALL' ? 'All Subjects' : subj}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="space-y-3">
            ${filteredRows
              .map((row) => {
                const statusBadge =
                  row.status === 'CORRECT'
                    ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">✓ CORRECT (+${row.marks})</span>`
                    : row.status === 'WRONG'
                      ? `<span class="px-2.5 py-1 rounded-lg bg-red-100 text-[#EF4444] text-[11px] font-extrabold">✕ WRONG (${row.marks})</span>`
                      : `<span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-extrabold">○ UNATTEMPTED (0)</span>`;

                return `
                  <div
                    data-testid="answer-review-row"
                    class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-white hover:border-indigo-200 transition-all"
                  >
                    <!-- Col 1: Q# + Subject + Status (2 Cols) -->
                    <div class="lg:col-span-2 flex lg:flex-col justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-slate-900 text-white font-mono-tabular text-xs font-extrabold flex items-center justify-center shrink-0">
                          Q${row.number}
                        </span>
                        <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#4F46E5] text-xs font-bold">
                          ${row.subject}
                        </span>
                      </div>
                      <div>${statusBadge}</div>
                    </div>

                    <!-- Col 2: Question Statement & Cropped Image (4 Cols) -->
                    <div class="lg:col-span-4 space-y-1.5">
                      <div class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        ${this.escapeHtml(row.topic)} · ${row.type}
                      </div>
                      <p class="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                        ${this.escapeHtml(row.prompt)}
                      </p>
                      ${
                        row.questionImg
                          ? `<img src="${row.questionImg}" alt="Question Crop" referrerpolicy="no-referrer" class="max-h-24 rounded-lg border border-slate-200 bg-white p-1 object-contain" />`
                          : ''
                      }
                    </div>

                    <!-- Col 3: Your Answer vs Correct Answer Key (3 Cols) -->
                    <div class="lg:col-span-3 p-3 rounded-xl bg-white border border-[#E2E8F0] space-y-2">
                      <div>
                        <span class="block text-[10px] font-bold uppercase text-slate-400">Your Response</span>
                        <span class="text-xs font-extrabold ${
                          row.status === 'CORRECT'
                            ? 'text-[#10B981]'
                            : row.status === 'WRONG'
                              ? 'text-[#EF4444]'
                              : 'text-slate-500'
                        }">
                          ${this.escapeHtml(row.userAnswer || 'Not Attempted')}
                        </span>
                      </div>
                      <div class="pt-1.5 border-t border-slate-100">
                        <span class="block text-[10px] font-bold uppercase text-[#10B981]">Correct Answer Key</span>
                        <span class="text-xs font-extrabold text-emerald-900">
                          ${this.escapeHtml(row.correctAnswer)}
                        </span>
                      </div>
                    </div>

                    <!-- Col 4: Step-by-Step Solution & Cropped Solution Image (3 Cols) -->
                    <div class="lg:col-span-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                      <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5] block">
                        Official Step-by-Step Solution
                      </span>
                      <p class="text-xs text-slate-700 leading-relaxed">
                        ${this.escapeHtml(row.solution)}
                      </p>
                      ${
                        row.solutionImg
                          ? `<img src="${row.solutionImg}" alt="Solution Crop" referrerpolicy="no-referrer" class="max-h-24 rounded-lg border border-indigo-200 bg-white p-1 object-contain" />`
                          : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  private buildFallbackQuestionRows(): QuestionAttemptRow[] {
    const pool = this.activeQuestions.length > 0 ? this.activeQuestions : CBT_QUESTION_BANK.slice(0, 6);
    return pool.map((q, idx) => {
      const userAns = this.responses[q.id] ?? '';
      const trimmed = userAns.trim();
      const isUnattempted = trimmed === '';
      const isCorrect =
        !isUnattempted &&
        (q.type === 'NAT'
          ? Math.abs(Number(trimmed) - Number(q.correctAnswer)) < 0.05
          : trimmed === q.correctAnswer);
      return {
        id: q.id,
        number: idx + 1,
        subject: q.subject,
        topic: q.topic,
        type: q.type,
        prompt: q.prompt,
        userAnswer: trimmed || 'Not Attempted',
        correctAnswer: q.correctAnswer,
        status: isUnattempted ? 'UNATTEMPTED' : isCorrect ? 'CORRECT' : 'WRONG',
        marks: isUnattempted ? 0 : isCorrect ? 4 : -1,
        solution: q.solution,
        questionImg: q.questionImg,
        solutionImg: q.solutionImg,
      };
    });
  }

  private mountHistoryD3Charts(): void {
    if (!this.containerEl) return;
    const submissions = dataStore.getTestSubmissions();
    const activeSub =
      submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
      this.lastSubmission ??
      submissions[0];

    const accEl = this.containerEl.querySelector<HTMLElement>(
      '#d3-cbt-subject-accuracy'
    );
    if (accEl) {
      renderD3SubjectAccuracyChart(
        accEl,
        activeSub ? [activeSub] : submissions
      );
    }

    const trendEl = this.containerEl.querySelector<HTMLElement>(
      '#d3-cbt-improvement-trend'
    );
    if (trendEl) {
      renderD3ImprovementTrendGraph(trendEl, submissions);
    }
  }

  private prepareExamPaper(mode: CBTEngineMode): void {
    const combinedPool = this.buildCombinedQuestionPool();

    if (mode === 'INFINITE_PRACTICE') {
      const allChapters: ChapterEntity[] = dataStore.getChapters();
      const chosenChapters = allChapters.filter((ch) =>
        this.selectedChapterIds.has(ch.id)
      );
      const result = selectInfinitePracticeEqualByChapter(
        combinedPool,
        chosenChapters,
        this.infiniteTotalCount
      );
      this.activeQuestions = result.questions;
      this.activePerChapterCounts = result.perChapterCounts;
    } else {
      const subjects = Array.from(this.selectedSubjects);
      this.activeQuestions = selectAutoBalancedQuestions(
        combinedPool,
        this.selectedExam,
        subjects,
        this.totalQuestionCount
      );
      this.activePerChapterCounts = {};
    }

    this.responses = {};
    this.statusMap = {};
    for (const q of this.activeQuestions) {
      this.statusMap[q.id] = 'not_visited';
    }
    if (this.activeQuestions[0]) {
      this.statusMap[this.activeQuestions[0].id] = 'not_answered';
    }
    this.currentQuestionIndex = 0;
    this.activeSubjectFilter = 'ALL';
    this.initialDurationSeconds = this.activeQuestions.length * 120;
    this.remainingSeconds = this.initialDurationSeconds;
    this.startTimer();
  }

  private startExam(): void {
    this.prepareExamPaper(this.engineMode);
    this.stage = 'exam';

    // Update URL so active Mock Test / Infinite Practice lives on its own dedicated page view
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('tab');
    nextUrl.searchParams.set(
      'session',
      this.engineMode === 'INFINITE_PRACTICE' ? 'infinite' : 'mock'
    );
    window.history.pushState({}, '', nextUrl.toString());

    this.callbacks.onShowToast(
      this.engineMode === 'INFINITE_PRACTICE'
        ? `Infinite Practice started in dedicated exam page: ${this.activeQuestions.length} questions (${Object.keys(this.activePerChapterCounts).length} chapters)`
        : `${this.selectedExam} (${this.selectedClassYear}) Mock Test opened in dedicated exam page (${this.activeQuestions.length} Qs)`
    );
    this.rerender();
  }

  private copyTestInviteLink(customTitle?: string): void {
    const inviteUrl = new URL(window.location.origin + '/test.html');
    inviteUrl.searchParams.set(
      'session',
      this.engineMode === 'INFINITE_PRACTICE' ? 'infinite' : 'mock'
    );
    inviteUrl.searchParams.set('exam', this.selectedExam);
    inviteUrl.searchParams.set('class', this.selectedClassYear);
    if (customTitle) {
      inviteUrl.searchParams.set('title', customTitle);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl.toString()).catch(() => {});
    }
    this.callbacks.onShowToast(
      `Invite link copied! Share with friends to attempt this ${this.selectedExam} (${this.selectedClassYear}) test together.`
    );
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerIntervalId = window.setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds -= 1;
        const timerEl = this.containerEl?.querySelector('#cbt-live-timer');
        if (timerEl) {
          timerEl.textContent = formatDuration(this.remainingSeconds, true);
        }
      } else {
        this.submitPaper();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private submitPaper(): void {
    this.stopTimer();
    const evalResult = evaluateCBTSubmission(this.activeQuestions, this.responses);
    const diagnosis = generateAIStudyDiagnosis(
      this.activeQuestions,
      this.responses,
      this.selectedExam
    );
    const questionRows = this.buildFallbackQuestionRows();

    const user = dataStore.getUser();
    const testId = `test_${Date.now()}`;
    const submission: TestSubmission = {
      testId,
      uid: user.uid,
      title:
        this.engineMode === 'INFINITE_PRACTICE'
          ? `Infinite Practice Equal-Distribution Drill (${this.activeQuestions.length} Qs · ${this.selectedClassYear})`
          : `${this.selectedMockSeriesTitle} (${this.selectedExam} · ${this.selectedClassYear})`,
      classYear: this.selectedClassYear,
      examType: this.selectedExam,
      mode: this.engineMode,
      totalQuestions: this.activeQuestions.length,
      score: evalResult.totalScore,
      maxScore: evalResult.maxPossibleScore,
      accuracyPercent: evalResult.accuracyPercent,
      correctCount: evalResult.correctCount,
      wrongCount: evalResult.wrongCount,
      timeTaken: Math.max(1, this.initialDurationSeconds - this.remainingSeconds),
      subjectBreakdown: evalResult.subjectBreakdown,
      chapterBreakdown: diagnosis.chapterBreakdown,
      questionRows,
      diagnosisBullets: diagnosis.diagnosisBullets,
      timestamp: new Date().toISOString(),
    };

    this.lastSubmission = submission;
    this.selectedHistoryTestId = testId;
    void dataStore.saveTestSubmission(submission);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('session');
    nextUrl.searchParams.set('tab', 'history');
    window.history.replaceState({}, '', nextUrl.toString());

    this.stage = 'history';
    this.callbacks.onShowToast(
      `Test submitted! Net Score: ${evalResult.totalScore}/${evalResult.maxPossibleScore} — View graphs & row-by-row solutions below.`
    );
    this.rerender();
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    const natInput =
      this.containerEl.querySelector<HTMLInputElement>('#cbt-nat-input');
    if (natInput) {
      natInput.addEventListener('input', () => {
        const currentQ = this.activeQuestions[this.currentQuestionIndex];
        if (currentQ) {
          this.responses[currentQ.id] = natInput.value.trim();
        }
      });
    }

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', () => {
        switch (action) {
          case 'switch-engine-mode': {
            const mode = el.dataset.mode as CBTEngineMode;
            if (mode === 'MOCK' || mode === 'INFINITE_PRACTICE') {
              this.engineMode = mode;
              this.stage = 'hub';
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.delete('session');
              nextUrl.searchParams.delete('tab');
              window.history.replaceState({}, '', nextUrl.toString());
              this.rerender();
            }
            break;
          }
          case 'open-test-history': {
            this.stage = 'history';
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('session');
            nextUrl.searchParams.set('tab', 'history');
            window.history.replaceState({}, '', nextUrl.toString());
            this.rerender();
            break;
          }
          case 'share-invite-test': {
            this.copyTestInviteLink(el.dataset.title);
            break;
          }
          case 'launch-series-mock': {
            const title = el.dataset.title;
            const count = Number(el.dataset.count) || 10;
            if (title) this.selectedMockSeriesTitle = title;
            this.totalQuestionCount = count;
            this.engineMode = 'MOCK';
            this.startExam();
            break;
          }
          case 'exit-exam-to-hub': {
            this.stopTimer();
            this.stage = 'hub';
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('session');
            nextUrl.searchParams.delete('tab');
            window.history.pushState({}, '', nextUrl.toString());
            this.rerender();
            break;
          }
          case 'select-history-test': {
            const tid = el.dataset.testId;
            if (tid) {
              this.selectedHistoryTestId = tid;
              window.location.href = `/test-history.html?testId=${encodeURIComponent(tid)}&view=single`;
            }
            break;
          }
          case 'quick-select-chapter-count': {
            const targetCount = Math.max(1, Number(el.dataset.count) || 1);
            const allChapters = dataStore.getChapters();
            this.selectedChapterIds = new Set(
              allChapters.slice(0, targetCount).map((c) => c.id)
            );
            const validMultiples = getValidInfinitePracticeCounts(
              this.selectedChapterIds.size
            );
            this.infiniteTotalCount = validMultiples[1] ?? validMultiples[0];
            this.rerender();
            break;
          }
          case 'filter-history-subject': {
            const subj = el.dataset.subject as SubjectName | 'ALL';
            if (subj) {
              this.historySubjectFilter = subj;
              this.rerender();
            }
            break;
          }
          case 'select-class-cohort': {
            const cy = el.dataset.class as StudentClassYear;
            if (cy) {
              this.selectedClassYear = cy;
              void dataStore.updateUser({ classYear: cy });
              this.rerender();
            }
            break;
          }
          case 'select-cbt-exam': {
            const exam = el.dataset.exam as TargetExam;
            if (exam === 'JEE' || exam === 'NEET') {
              this.selectedExam = exam;
              this.selectedSubjects = new Set(getSubjectsForExam(exam));
              void dataStore.updateUser({ targetExam: exam });
              this.rerender();
            }
            break;
          }
          case 'toggle-cbt-subject': {
            const sub = el.dataset.subject as SubjectName;
            if (!sub) return;
            if (this.selectedSubjects.has(sub)) {
              if (this.selectedSubjects.size > 1) {
                this.selectedSubjects.delete(sub);
              }
            } else {
              this.selectedSubjects.add(sub);
            }
            this.rerender();
            break;
          }
          case 'select-cbt-count': {
            const cnt = Number(el.dataset.count);
            if ([5, 10, 15].includes(cnt)) {
              this.totalQuestionCount = cnt;
              this.rerender();
            }
            break;
          }
          case 'toggle-infinite-chapter': {
            const chId = el.dataset.chapterId;
            if (!chId) return;
            if (this.selectedChapterIds.has(chId)) {
              if (this.selectedChapterIds.size > 1) {
                this.selectedChapterIds.delete(chId);
              }
            } else {
              this.selectedChapterIds.add(chId);
            }
            const validMultiples = getValidInfinitePracticeCounts(
              this.selectedChapterIds.size
            );
            this.infiniteTotalCount = validMultiples[1] ?? validMultiples[0];
            this.rerender();
            break;
          }
          case 'select-infinite-multiple': {
            const total = Number(el.dataset.total);
            if (total > 0) {
              this.infiniteTotalCount = total;
              this.rerender();
            }
            break;
          }
          case 'start-cbt-exam': {
            this.startExam();
            break;
          }
          case 'select-mcq-option': {
            const opt = el.dataset.option;
            const currentQ = this.activeQuestions[this.currentQuestionIndex];
            if (currentQ && opt !== undefined) {
              this.responses[currentQ.id] = opt;
              this.statusMap[currentQ.id] = 'answered';
              this.rerender();
            }
            break;
          }
          case 'nat-keypad': {
            const key = el.dataset.key;
            const currentQ = this.activeQuestions[this.currentQuestionIndex];
            if (!currentQ || !key) return;
            const existing = this.responses[currentQ.id] ?? '';
            if (key === 'CLR') {
              this.responses[currentQ.id] = '';
            } else if (key === 'DEL') {
              this.responses[currentQ.id] = existing.slice(0, -1);
            } else {
              this.responses[currentQ.id] = existing + key;
            }
            this.statusMap[currentQ.id] = this.responses[currentQ.id]
              ? 'answered'
              : 'not_answered';
            this.rerender();
            break;
          }
          case 'clear-response': {
            const currentQ = this.activeQuestions[this.currentQuestionIndex];
            if (currentQ) {
              delete this.responses[currentQ.id];
              this.statusMap[currentQ.id] = 'not_answered';
              this.rerender();
            }
            break;
          }
          case 'mark-review-next': {
            const currentQ = this.activeQuestions[this.currentQuestionIndex];
            if (currentQ) {
              const hasAns = Boolean(this.responses[currentQ.id]?.trim());
              this.statusMap[currentQ.id] = hasAns
                ? 'answered_marked_review'
                : 'marked_review';
              this.advanceQuestion(1);
            }
            break;
          }
          case 'save-and-next': {
            const currentQ = this.activeQuestions[this.currentQuestionIndex];
            if (currentQ) {
              const hasAns = Boolean(this.responses[currentQ.id]?.trim());
              this.statusMap[currentQ.id] = hasAns ? 'answered' : 'not_answered';
              this.advanceQuestion(1);
            }
            break;
          }
          case 'prev-question': {
            this.advanceQuestion(-1);
            break;
          }
          case 'jump-to-question': {
            const idx = Number(el.dataset.index);
            if (!Number.isNaN(idx) && idx >= 0 && idx < this.activeQuestions.length) {
              this.currentQuestionIndex = idx;
              const targetQ = this.activeQuestions[idx];
              if (this.statusMap[targetQ.id] === 'not_visited') {
                this.statusMap[targetQ.id] = 'not_answered';
              }
              this.isPaletteDrawerOpen = false;
              this.rerender();
            }
            break;
          }
          case 'filter-exam-subject': {
            const sub = el.dataset.subject as SubjectName | 'ALL';
            this.activeSubjectFilter = sub;
            const firstMatchIdx =
              sub === 'ALL'
                ? 0
                : this.activeQuestions.findIndex((q) => q.subject === sub);
            if (firstMatchIdx >= 0) {
              this.currentQuestionIndex = firstMatchIdx;
            }
            this.rerender();
            break;
          }
          case 'toggle-palette-drawer': {
            this.isPaletteDrawerOpen = !this.isPaletteDrawerOpen;
            this.rerender();
            break;
          }
          case 'submit-cbt-paper': {
            this.submitPaper();
            break;
          }
          case 'reconfigure-cbt': {
            this.stage = 'hub';
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('session');
            nextUrl.searchParams.delete('tab');
            window.history.replaceState({}, '', nextUrl.toString());
            this.rerender();
            break;
          }
        }
      });
    });
  }

  private advanceQuestion(delta: number): void {
    const nextIdx = this.currentQuestionIndex + delta;
    if (nextIdx >= 0 && nextIdx < this.activeQuestions.length) {
      this.currentQuestionIndex = nextIdx;
      const nextQ = this.activeQuestions[nextIdx];
      if (this.statusMap[nextQ.id] === 'not_visited') {
        this.statusMap[nextQ.id] = 'not_answered';
      }
    }
    this.rerender();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
