import * as d3 from 'd3';
import { CBT_QUESTION_BANK, getCohortTheme } from '../constants';
import {
  generateResultsAISummaryWithAI,
  resolveResultsDoubtWithAI,
} from '../services/aiAssistantService';
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
  buildSequentialMockStream,
  evaluateCBTSubmission,
  extractIsolatedOptionLetterFromAnswer,
  formatDuration,
  generateAIStudyDiagnosis,
  generateAutomatedResultsSummaryAndPathway,
  getSubjectsForExam,
  getValidInfinitePracticeCounts,
  isolateOptionLettersOnly,
  selectAutoBalancedQuestions,
  selectInfinitePracticeEqualByChapter,
  summarizePaletteStatuses,
} from '../utils/examLogic';

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

  // Post-Submission, Test History & AI Results State
  private lastSubmission: TestSubmission | null = null;
  private selectedHistoryTestId: string | null = null;
  private historySubjectFilter: SubjectName | 'ALL' = 'ALL';
  private aiSummaryOverride: {
    executiveSummary: string;
    strengths: string[];
    focusAreas: string[];
    personalizedPathway: {
      step: number;
      subject: string;
      actionTitle: string;
      detail: string;
      timeEstimate: string;
    }[];
  } | null = null;
  private isGeneratingAISummary = false;
  private activeDoubtQuestionNumber: number | null = null;
  private activeDoubtExplanation: string = '';
  private activeDoubtQuery: string = '';
  private isResolvingDoubt = false;

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
    } else if (
      sessionParam === 'mock' &&
      this.activeQuestions.length === 0 &&
      !dataStore.getUser().isGuest
    ) {
      this.engineMode = 'MOCK';
      this.prepareExamPaper('MOCK');
      this.stage = 'exam';
    } else if (this.stage !== 'exam' && this.stage !== 'submitted' && this.stage !== 'history') {
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
    const mappedAdmin: CBTQuestion[] = adminQuestions.map((aq, idx) => {
      const isolatedOpts = isolateOptionLettersOnly(aq.options);
      const rawCorrect =
        aq.type === 'MCQ' && aq.options
          ? aq.options[Number(aq.correctVal) || 0] ?? aq.correctVal
          : aq.correctVal;
      return {
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
        options: isolatedOpts,
        correctAnswer:
          aq.type === 'NUMERICAL'
            ? aq.correctVal
            : extractIsolatedOptionLetterFromAnswer(rawCorrect, aq.options),
        solution: aq.solutionText,
      };
    });

    const normalizedBank: CBTQuestion[] = CBT_QUESTION_BANK.map((q) => {
      if (q.type === 'NAT') return q;
      return {
        ...q,
        options: isolateOptionLettersOnly(q.options),
        correctAnswer: extractIsolatedOptionLetterFromAnswer(
          q.correctAnswer,
          q.options
        ),
      };
    });

    return [...mappedAdmin, ...normalizedBank];
  }

  public rerender(): void {
    if (!this.containerEl) return;

    // 1. DEDICATED FULL-SCREEN EXAM PAGE
    if (this.stage === 'exam') {
      this.containerEl.innerHTML = this.renderDedicatedExamStage();
      this.bindEvents();
      return;
    }

    // 2. TEST HISTORY, AI PERFORMANCE SUMMARIES, PERSONALIZED STUDY PATHWAY, AI DOUBT SOLVER & SOLUTIONS VIEW
    if (this.stage === 'history' || this.stage === 'submitted') {
      this.containerEl.innerHTML = `
        <div class="space-y-6 pb-12" data-testid="cbt-history-page">
          ${this.renderTopHubBanner()}
          ${this.renderTestHistoryAndAnalyticsStage()}
        </div>
      `;
      this.bindEvents();
      this.renderD3HistoryCharts();
      return;
    }

    // 3. DEFAULT SEQUENTIAL MOCK STREAM HUB VIEW (No Custom Mock Builder)
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
        class="rounded-3xl bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#DB2777] px-5 py-4 text-white shadow-md"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 min-w-0">
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-pink-100 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
              🌸 ${this.escapeHtml(cohortTheme.badgeText)}
            </span>
            <h1 class="text-sm sm:text-base font-extrabold tracking-tight truncate">
              Sequential NTA Mock Test Stream &amp; AI Performance Results
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-action="switch-engine-mode"
              data-mode="MOCK"
              class="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                !isHistoryActive
                  ? 'bg-white text-[#7C3AED] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }"
            >
              🎯 Sequential Mock Stream
            </button>
            <button
              type="button"
              data-action="open-test-history"
              data-testid="open-test-history-btn"
              class="min-h-[42px] px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                isHistoryActive
                  ? 'bg-pink-200 text-purple-950 shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }"
            >
              📊 AI Results &amp; History (${submissions.length})
            </button>
            <button
              type="button"
              data-action="share-invite-test"
              data-testid="invite-friend-test-btn"
              class="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-xs font-extrabold text-white transition-all cursor-pointer"
            >
              🔗 Invite
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
      'Class 10',
      'Class 9',
    ];

    const submissions = dataStore.getTestSubmissions();
    const cohortTheme = getCohortTheme(this.selectedExam, this.selectedClassYear);
    const currentUser = dataStore.getUser();
    const isGuestVisitor = Boolean(currentUser.isGuest || !currentUser.email);
    const sequentialStream = buildSequentialMockStream(
      this.selectedExam,
      this.selectedClassYear,
      submissions
    );

    return `
      <div class="space-y-6" data-testid="mock-test-launcher-hub">
        ${
          isGuestVisitor
            ? `
          <section
            data-testid="guest-mock-test-lock"
            class="rounded-3xl bg-pink-50 border-2 border-pink-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
          >
            <div class="space-y-1">
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-200/80 text-pink-950 text-[10px] font-extrabold uppercase tracking-wider">
                🔒 Mandatory Google Sign-In Required for CBT Mock Tests
              </div>
              <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
                Sign In with Google OAuth to Unlock Sequential Mock Tests &amp; AI Doubt Solving
              </h2>
              <p class="text-xs text-slate-700">
                Unauthenticated visitors can browse Study Vault PDFs. Authenticate via Google OAuth to attempt Sequential Mock Tests and receive AI performance summaries.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="/study.html"
                class="min-h-[44px] px-4 py-2 rounded-2xl bg-white hover:bg-pink-100 border border-pink-300 text-xs font-extrabold text-pink-950 inline-flex items-center"
              >
                📚 Browse Study Vault
              </a>
              <button
                type="button"
                data-action="google-signin-unlock-test"
                data-testid="cbt-google-unlock-btn"
                class="min-h-[44px] px-4 py-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
              >
                Sign In with Google →
              </button>
            </div>
          </section>
        `
            : ''
        }

        <!-- Sequential Cohort & Exam Track Selector Bar -->
        <section class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F3E8FF] pb-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 rounded-full bg-purple-100 text-[#7C3AED] text-xs font-extrabold">
                  ${this.escapeHtml(cohortTheme.label)}
                </span>
                <span class="px-3 py-1 rounded-full bg-pink-100 text-[#DB2777] text-xs font-extrabold" data-testid="isolated-options-policy-badge">
                  ✓ Cropped Uploads Retain Isolated Option Letters (A, B, C, D) Only
                </span>
              </div>
              <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                Sequential NTA Mock Test Stream (${this.selectedExam} · ${this.selectedClassYear})
              </h2>
              <p class="text-xs text-slate-600 mt-0.5">
                Mock tests are structured in a clear, verified sequential stream rather than manual custom builders. Complete each stage in order or review AI performance analytics.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              ${(['JEE', 'NEET'] as TargetExam[])
                .map((exam) => {
                  const active = this.selectedExam === exam;
                  return `
                  <button
                    type="button"
                    data-action="select-cbt-exam"
                    data-exam="${exam}"
                    class="min-h-[44px] px-4 py-2 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] border-transparent text-white shadow-sm'
                        : 'bg-[#FDF2F8] border-[#F5D0FE] text-slate-700 hover:bg-white'
                    }"
                  >
                    ${exam} Track
                  </button>
                `;
                })
                .join('')}
              <button
                type="button"
                data-action="open-test-history"
                class="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-[#7C3AED] shrink-0 cursor-pointer"
              >
                📊 AI Results &amp; Solutions (${submissions.length}) →
              </button>
            </div>
          </div>

          <!-- Class Cohort Pills -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-extrabold text-slate-500 mr-1">Class Cohort:</span>
            ${classYears
              .map((cy) => {
                const active = this.selectedClassYear === cy;
                return `
                <button
                  type="button"
                  data-action="select-class-cohort"
                  data-class="${cy}"
                  class="min-h-[42px] px-3.5 py-2 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-2xs'
                      : 'bg-[#FDF2F8] border-[#F5D0FE] text-slate-700 hover:bg-white'
                  }"
                >
                  ${cy}
                </button>
              `;
              })
              .join('')}
          </div>

          <!-- SEQUENTIAL MOCK TEST STREAM CARDS -->
          <div class="space-y-4 pt-2" data-testid="sequential-mock-stream">
            ${sequentialStream
              .map((item) => {
                const statusBadge =
                  item.status === 'COMPLETED'
                    ? `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">✓ COMPLETED</span>`
                    : item.status === 'UNLOCKED_NEXT'
                      ? `<span class="px-3 py-1 rounded-full bg-pink-100 text-[#DB2777] text-[11px] font-extrabold animate-pulse">★ UP NEXT IN STREAM</span>`
                      : `<span class="px-3 py-1 rounded-full bg-purple-100 text-[#7C3AED] text-[11px] font-extrabold">SEQUENTIAL STAGE 0${item.sequenceNumber}</span>`;

                return `
                <article
                  data-testid="sequential-mock-card"
                  class="rounded-3xl border-2 ${
                    item.status === 'UNLOCKED_NEXT'
                      ? 'border-[#DB2777] bg-gradient-to-r from-[#FDF2F8] via-white to-[#F5F3FF]'
                      : 'border-[#F3E8FF] bg-white'
                  } p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-md transition-all"
                >
                  <div class="flex items-start gap-4 min-w-0">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#DB2777] text-white font-mono-tabular text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm">
                      0${item.sequenceNumber}
                    </div>
                    <div class="space-y-1.5 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        ${statusBadge}
                        <span class="px-2.5 py-0.5 rounded-full bg-[#FDF2F8] border border-[#F5D0FE] text-[10px] font-extrabold text-[#7C3AED] uppercase tracking-wider">
                          ${this.escapeHtml(item.badge)}
                        </span>
                        <span class="font-mono-tabular text-xs font-bold text-slate-600">
                          ⏱ ${item.durationMins} Mins · ${item.questionCount} Qs
                        </span>
                      </div>
                      <h3 class="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                        ${this.escapeHtml(item.title)}
                      </h3>
                      <p class="text-xs text-slate-600 leading-relaxed">
                        ${this.escapeHtml(item.syllabus)}
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                    <button
                      type="button"
                      data-action="share-invite-test"
                      data-title="${this.escapeHtml(item.title)}"
                      class="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-slate-700 cursor-pointer"
                    >
                      🔗 Invite
                    </button>
                    <button
                      type="button"
                      data-action="launch-series-mock"
                      data-testid="launch-sequential-mock-btn"
                      data-title="${this.escapeHtml(item.title)}"
                      data-count="${item.questionCount}"
                      class="min-h-[46px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] hover:opacity-95 text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all cursor-pointer"
                    >
                      ${item.status === 'COMPLETED' ? 'Re-Attempt Stage 0' + item.sequenceNumber + ' →' : 'Start Sequential Mock 0' + item.sequenceNumber + ' →'}
                    </button>
                  </div>
                </article>
              `;
              })
              .join('')}
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
    const isolatedOptions = isolateOptionLettersOnly(currentQ.options);
    const paletteSummary = summarizePaletteStatuses(
      this.activeQuestions.map((q) => q.id),
      this.statusMap
    );

    const subjectsInTest = Array.from(
      new Set(this.activeQuestions.map((q) => q.subject))
    );

    return `
      <div class="space-y-4 pb-14" data-testid="dedicated-exam-screen">
        <!-- Dedicated Full-Screen Exam Top Header -->
        <header class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              type="button"
              data-action="exit-exam-to-hub"
              data-testid="exit-exam-to-hub-btn"
              class="min-h-[42px] px-3.5 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-slate-700 cursor-pointer"
            >
              ← Exit to Stream
            </button>
            <span class="px-3 py-1 rounded-full bg-purple-100 text-[#7C3AED] text-xs font-extrabold">
              🎯 ${this.selectedExam} · ${this.selectedClassYear}
            </span>
            <div class="hidden sm:block text-xs font-bold text-slate-700 truncate max-w-xs">
              ${this.escapeHtml(this.selectedMockSeriesTitle)}
            </div>
          </div>

          <!-- Subject Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-action="filter-exam-subject"
              data-subject="ALL"
              class="min-h-[40px] px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-colors cursor-pointer ${
                this.activeSubjectFilter === 'ALL'
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#FDF2F8] text-slate-600 hover:bg-pink-100'
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
                class="min-h-[40px] px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-colors cursor-pointer ${
                  this.activeSubjectFilter === sub
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#FDF2F8] text-slate-600 hover:bg-pink-100'
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
            <div class="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white font-mono-tabular text-xs sm:text-sm font-extrabold">
              ⏱ <span id="cbt-live-timer">${formatDuration(this.remainingSeconds, true)}</span>
            </div>
            <button
              type="button"
              data-action="toggle-palette-drawer"
              class="lg:hidden min-h-[42px] px-3 py-1.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-xs font-bold text-slate-700"
            >
              Palette (${paletteSummary.answered}/${this.activeQuestions.length})
            </button>
            <button
              type="button"
              data-action="submit-cbt-paper"
              data-testid="submit-cbt-test-btn"
              class="min-h-[42px] px-4 py-2 rounded-2xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </header>

        <!-- Mobile/Tablet Swipeable Question Number Strip -->
        <div class="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar bg-white border border-[#F3E8FF] rounded-2xl p-2.5 shadow-2xs">
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
                  class="w-9 h-9 shrink-0 rounded-xl font-mono-tabular text-xs font-bold flex items-center justify-center ${badgeCls} ${
                    isCurrent ? 'ring-2 ring-[#7C3AED] ring-offset-1' : ''
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
            class="lg:col-span-8 bg-white border-2 border-[#F3E8FF] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[460px]"
          >
            <div class="space-y-5">
              <!-- Question Meta Header -->
              <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F3E8FF]">
                <div class="flex items-center gap-2">
                  <span class="px-3 py-1 rounded-xl bg-[#7C3AED] text-white font-mono-tabular text-xs font-bold">
                    Q.${currentQ.number}
                  </span>
                  <span class="px-3 py-1 rounded-xl bg-[#FDF2F8] text-[#DB2777] text-xs font-extrabold">
                    ${currentQ.subject}
                  </span>
                  <span class="text-xs text-slate-500 font-medium">
                    ${this.escapeHtml(currentQ.topic)}
                  </span>
                </div>
                <div class="flex items-center gap-2 font-mono-tabular text-xs">
                  <span class="px-2 py-0.5 rounded bg-emerald-50 text-[#10B981] font-bold">+4</span>
                  <span class="px-2 py-0.5 rounded bg-red-50 text-[#EF4444] font-bold">-1</span>
                  <span class="px-2 py-0.5 rounded bg-purple-50 text-[#7C3AED] font-bold">${currentQ.type}</span>
                </div>
              </div>

              <!-- Question Prompt OR Large Clean Cropped Image -->
              <div class="space-y-3">
                ${
                  currentQ.questionImg
                    ? `
                  <div class="rounded-2xl overflow-hidden border border-[#F5D0FE] bg-[#FFF9FB] p-3">
                    <img
                      src="${currentQ.questionImg}"
                      alt="Question Diagram"
                      referrerpolicy="no-referrer"
                      class="max-h-[420px] w-full mx-auto object-contain rounded-xl"
                    />
                  </div>
                `
                    : `
                  <p class="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                    ${this.escapeHtml(currentQ.prompt)}
                  </p>
                  ${
                    currentQ.equationBlock
                      ? `
                    <div class="p-3.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] font-mono-tabular text-xs sm:text-sm text-purple-950 overflow-x-auto">
                      ${this.escapeHtml(currentQ.equationBlock)}
                    </div>
                  `
                      : ''
                  }
                `
                }
              </div>

              <!-- MCQ Options: STRICTLY ISOLATED OPTION LETTERS ONLY (A, B, C, D) WITH ACCOMPANYING TEXT STRIPPED -->
              ${
                currentQ.type === 'MCQ'
                  ? `
                <div class="space-y-2 pt-2">
                  <div class="flex items-center justify-between text-[11px] font-extrabold text-[#7C3AED]">
                    <span>Select Isolated Option Letter (Accompanying Option Text Stripped for Automated Processing)</span>
                    <span class="font-mono-tabular">Options: A · B · C · D</span>
                  </div>
                  <div
                    data-testid="mcq-options-single-row"
                    class="grid grid-cols-4 gap-3"
                  >
                    ${isolatedOptions
                      .map((optLetter) => {
                        const selected =
                          extractIsolatedOptionLetterFromAnswer(
                            currentAnswer,
                            currentQ.options
                          ) === optLetter && currentAnswer !== '';
                        return `
                        <button
                          type="button"
                          data-action="select-mcq-option"
                          data-testid="isolated-option-letter-btn"
                          data-option="${optLetter}"
                          class="w-full min-h-[54px] p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            selected
                              ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] border-transparent text-white font-extrabold shadow-md'
                              : 'bg-[#FDF2F8] border-[#F5D0FE] hover:bg-pink-100/70 text-slate-900 font-extrabold'
                          }"
                        >
                          <span class="w-8 h-8 rounded-xl font-mono-tabular text-sm font-extrabold flex items-center justify-center ${
                            selected
                              ? 'bg-white/20 text-white'
                              : 'bg-white border border-[#F5D0FE] text-[#7C3AED]'
                          }">${optLetter}</span>
                        </button>
                      `;
                      })
                      .join('')}
                  </div>
                </div>
              `
                  : `
                <div class="p-4 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] space-y-3 max-w-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-600 uppercase">Numerical Response</span>
                    <span class="font-mono-tabular text-sm font-bold text-[#7C3AED]">
                      ${currentAnswer || '—'}
                    </span>
                  </div>
                  <input
                    id="cbt-nat-input"
                    type="text"
                    value="${this.escapeHtml(currentAnswer)}"
                    placeholder="Enter numerical value"
                    class="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-white border border-[#F5D0FE] font-mono-tabular text-sm font-bold text-slate-900"
                  />
                  <div class="grid grid-cols-4 gap-1.5">
                    ${['7', '8', '9', 'DEL', '4', '5', '6', '-', '1', '2', '3', '.', '0', 'CLR']
                      .map(
                        (key) => `
                      <button
                        type="button"
                        data-action="nat-keypad"
                        data-key="${key}"
                        class="min-h-[40px] rounded-xl border border-[#F5D0FE] bg-white hover:bg-pink-50 font-mono-tabular text-xs font-bold text-slate-800 ${
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
            <div class="pt-5 mt-6 border-t border-[#F3E8FF] flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-action="clear-response"
                  class="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-slate-700 cursor-pointer"
                >
                  Clear Response
                </button>
                <button
                  type="button"
                  data-action="mark-review-next"
                  class="min-h-[44px] px-4 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-extrabold text-[#7C3AED] cursor-pointer"
                >
                  Mark for Review &amp; Next
                </button>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="prev-question"
                  ${this.currentQuestionIndex === 0 ? 'disabled' : ''}
                  class="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  data-action="save-and-next"
                  class="min-h-[44px] px-5 py-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                >
                  Save &amp; Next →
                </button>
              </div>
            </div>
          </section>

          <!-- Right 4 Cols: NTA Question Palette Matrix -->
          <aside
            aria-label="NTA Question Palette"
            class="${
              this.isPaletteDrawerOpen
                ? 'fixed inset-x-4 bottom-24 z-40 lg:static'
                : 'hidden lg:block'
            } lg:col-span-4 bg-white border-2 border-[#F3E8FF] rounded-3xl p-5 shadow-sm space-y-4"
          >
            <div class="flex items-center justify-between pb-3 border-b border-[#F3E8FF]">
              <h2 class="text-sm font-extrabold text-slate-900">NTA Question Palette</h2>
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
                          : 'bg-[#FDF2F8] text-slate-700 border-[#F5D0FE]';
                  return `
                  <button
                    type="button"
                    data-action="jump-to-question"
                    data-index="${idx}"
                    class="min-h-[42px] rounded-2xl border font-mono-tabular text-xs font-bold transition-all cursor-pointer ${colorClass} ${
                      isCurrent ? 'ring-2 ring-[#7C3AED] ring-offset-1' : ''
                    }"
                  >
                    ${q.number}
                  </button>
                `;
                })
                .join('')}
            </div>

            <div class="pt-3 border-t border-[#F3E8FF]">
              <button
                type="button"
                data-action="submit-cbt-paper"
                class="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                Final Submit &amp; View AI Results + Solutions →
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
        <div class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-10 text-center space-y-3">
          <h2 class="text-lg font-extrabold text-slate-900">No Test History Yet</h2>
          <p class="text-xs text-slate-500">Launch a Sequential Mock Test to record your score, D3.js graphs, AI performance summary, and row-by-row solutions.</p>
          <button
            type="button"
            data-action="reconfigure-cbt"
            class="min-h-[44px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold"
          >
            Go to Sequential Mock Stream →
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

    const aiSummaryData =
      this.aiSummaryOverride ?? generateAutomatedResultsSummaryAndPathway(activeSub);

    return `
      <div class="space-y-6" data-testid="test-history-analytics-view">
        <!-- 1. Previous Test Attempts Selector Strip -->
        <section class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                Firebase Synced Exam Archive
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                Your Previous Test History (${submissions.length} Attempts)
              </h2>
            </div>
            <button
              type="button"
              data-action="reconfigure-cbt"
              class="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-[#7C3AED] text-xs font-extrabold self-start sm:self-auto cursor-pointer"
            >
              + Attempt Next Sequential Mock
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
                    class="p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#FDF2F8] border-[#7C3AED] shadow-2xs'
                        : 'bg-white border-[#F3E8FF] hover:bg-[#FDF2F8]/50'
                    }"
                  >
                    <div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-white border border-[#F5D0FE] text-[10px] font-extrabold text-[#7C3AED] uppercase">
                          ${sub.examType ?? 'JEE'} Mock Test
                        </span>
                        <span class="font-mono-tabular text-[11px] text-slate-500">${dateStr}</span>
                      </div>
                      <div class="text-xs sm:text-sm font-extrabold text-slate-900 mt-2 line-clamp-1">
                        ${this.escapeHtml(sub.title || `${sub.examType ?? 'JEE'} Full Test (${sub.classYear ?? 'Class 12'})`)}
                      </div>
                    </div>

                    <div class="pt-2.5 border-t border-[#F3E8FF] flex items-center justify-between text-xs">
                      <span class="font-mono-tabular font-extrabold text-slate-900">
                        Score: ${sub.score} / ${subMax}
                      </span>
                      <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono-tabular text-[11px] font-bold">
                        ${sub.accuracyPercent ?? 80}% Acc
                      </span>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- 2. AUTOMATED AI PERFORMANCE SUMMARY & PERSONALIZED STUDY PATHWAY ON RESULTS SCREEN -->
        <section
          aria-label="Automated AI Performance Summary and Personalized Study Pathway"
          data-testid="ai-performance-summary-card"
          class="bg-gradient-to-br from-[#FDF2F8] via-white to-[#F5F3FF] border-2 border-[#F5D0FE] rounded-3xl p-5 sm:p-6 shadow-sm space-y-5"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3E8FF]">
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#7C3AED] text-[11px] font-extrabold uppercase tracking-wider">
                🤖 Automated AI Performance Summary &amp; Personalized Study Pathway
              </span>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900 mt-1.5">
                AI Diagnostic Report for ${this.escapeHtml(activeSub.title || 'Selected Mock Test')}
              </h3>
            </div>
            <button
              type="button"
              data-action="refresh-ai-test-summary"
              data-testid="refresh-ai-summary-btn"
              class="min-h-[44px] px-4 py-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm cursor-pointer shrink-0"
            >
              ${this.isGeneratingAISummary ? '✨ Generating Deep AI Analysis...' : '✨ Regenerate AI Performance Summary'}
            </button>
          </div>

          <p class="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed bg-white/90 border border-[#F3E8FF] rounded-2xl p-4" data-testid="ai-executive-summary-text">
            ${this.escapeHtml(aiSummaryData.executiveSummary)}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div class="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                ✓ Key Strengths Identified
              </div>
              <ul class="space-y-1.5 text-xs text-slate-700">
                ${aiSummaryData.strengths
                  .map((s) => `<li class="flex items-start gap-2"><span class="text-emerald-600 font-bold">•</span><span>${this.escapeHtml(s)}</span></li>`)
                  .join('')}
              </ul>
            </div>
            <div class="p-4 rounded-2xl bg-pink-50/70 border border-pink-200 space-y-2">
              <div class="text-xs font-extrabold uppercase tracking-wider text-[#DB2777]">
                🎯 High-Priority Focus Areas
              </div>
              <ul class="space-y-1.5 text-xs text-slate-700">
                ${aiSummaryData.focusAreas
                  .map((f) => `<li class="flex items-start gap-2"><span class="text-[#DB2777] font-bold">•</span><span>${this.escapeHtml(f)}</span></li>`)
                  .join('')}
              </ul>
            </div>
          </div>

          <!-- Personalized 3-Step Study Pathway -->
          <div class="space-y-2.5" data-testid="personalized-study-pathway">
            <div class="text-xs font-extrabold uppercase tracking-wider text-[#7C3AED]">
              🗺️ Personalized 3-Step Study Pathway
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              ${aiSummaryData.personalizedPathway
                .map(
                  (stepItem) => `
                <div class="p-4 rounded-2xl bg-white border border-[#F5D0FE] flex flex-col justify-between gap-2 shadow-2xs">
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#7C3AED] font-mono-tabular text-[10px] font-extrabold">
                        STEP 0${stepItem.step} · ${this.escapeHtml(stepItem.subject)}
                      </span>
                      <span class="text-[11px] font-mono-tabular font-bold text-slate-500">
                        ⏱ ${this.escapeHtml(stepItem.timeEstimate)}
                      </span>
                    </div>
                    <div class="text-xs sm:text-sm font-extrabold text-slate-900">
                      ${this.escapeHtml(stepItem.actionTitle)}
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      ${this.escapeHtml(stepItem.detail)}
                    </p>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </section>

        <!-- 3. Visual Performance Graphs & Subject Score Analytics -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <!-- Left 5 Cols: Score Summary & Accuracy Distribution Bar + D3 Trend Chart -->
          <section class="lg:col-span-5 bg-white border-2 border-[#F3E8FF] rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-5">
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
                <div class="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <div class="text-[10px] font-bold uppercase text-[#7C3AED]">Net Score</div>
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
                <div class="p-3 rounded-2xl bg-pink-50/70 border border-pink-100">
                  <div class="text-[10px] font-bold uppercase text-[#DB2777]">Correct / Wrong</div>
                  <div class="text-xl font-mono-tabular font-extrabold text-slate-900 mt-1">
                    <span class="text-[#10B981]">${activeSub.correctCount}</span>/<span class="text-[#EF4444]">${activeSub.wrongCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- D3.js Performance Trend Chart across Attempts -->
            <div class="pt-3 border-t border-[#F3E8FF] space-y-1.5">
              <div class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                D3.js Accuracy Progression Across Mock Tests
              </div>
              <div id="d3-performance-trend-chart" class="w-full h-[135px]"></div>
            </div>

            <!-- Visual Distribution Bar -->
            <div class="pt-3 border-t border-[#F3E8FF] space-y-2">
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

          <!-- Right 7 Cols: D3.js Subject-Wise Score & Accuracy Bar Graph -->
          <section
            aria-label="Subject Performance Graph"
            data-testid="test-performance-graph"
            class="lg:col-span-7 bg-white border-2 border-[#F3E8FF] rounded-3xl p-6 shadow-sm space-y-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-extrabold text-slate-900">
                  D3.js Subject-Wise Score &amp; Accuracy Graph
                </h3>
                <p class="text-xs text-slate-500">
                  Visual comparison of marks scored and accuracy across subjects
                </p>
              </div>
              <span class="px-3 py-1 rounded-xl bg-[#FDF2F8] border border-[#F5D0FE] font-mono-tabular text-xs font-bold text-[#7C3AED]">
                📊 D3.js Chart
              </span>
            </div>

            <div id="d3-subject-accuracy-chart" class="w-full h-[170px]"></div>

            <div class="space-y-3 pt-1">
              ${subEntries
                .map((sub) => {
                  const pct = Math.min(
                    100,
                    Math.max(8, Math.round((Math.max(0, sub.score) / Math.max(1, sub.maxScore)) * 100))
                  );
                  const barGrad =
                    sub.subject === 'Physics'
                      ? 'from-[#7C3AED] to-indigo-600'
                      : sub.subject === 'Chemistry'
                        ? 'from-emerald-500 to-teal-600'
                        : 'from-[#DB2777] to-rose-500';
                  return `
                  <div class="p-3 rounded-2xl bg-[#FDF2F8]/60 border border-[#F3E8FF] space-y-1.5">
                    <div class="flex items-center justify-between text-xs font-extrabold text-slate-800">
                      <span>${sub.subject} <span class="text-slate-400 font-normal">(+${sub.correct} / -${sub.wrong})</span></span>
                      <span class="font-mono-tabular">${sub.score} / ${sub.maxScore} Marks · ${sub.accuracyPercent}% Acc</span>
                    </div>
                    <div class="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        class="h-full rounded-full bg-gradient-to-r ${barGrad}"
                        style="width: ${pct}%"
                      ></div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </section>
        </div>

        <!-- 4. AUTOMATED AI DOUBT SOLVING DIRECTLY ON THE RESULTS SCREEN -->
        <section
          aria-label="Automated AI Doubt Solver on Results Screen"
          data-testid="results-ai-doubt-solver"
          class="bg-white border-2 border-[#F5D0FE] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="px-3 py-1 rounded-full bg-pink-100 text-[#DB2777] text-[11px] font-extrabold uppercase tracking-wider">
                🤖 Instant AI Doubt Resolution on Results Screen
              </span>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                Ask AI About Any Mistake or Click "🤖 Solve Doubt with AI" on Any Question Row Below
              </h3>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-2.5">
            <input
              id="results-ai-doubt-input"
              type="text"
              value="${this.escapeHtml(this.activeDoubtQuery)}"
              placeholder="Ask why your answer was wrong or request a shortcut formula..."
              class="flex-1 min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-xs sm:text-sm font-semibold text-slate-900"
            />
            <button
              type="button"
              data-action="submit-results-ai-doubt"
              data-testid="results-ai-doubt-submit-btn"
              class="min-h-[46px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs sm:text-sm font-extrabold shadow-sm cursor-pointer shrink-0"
            >
              ${this.isResolvingDoubt ? '🤖 Solving Doubt...' : '🤖 Solve Doubt with AI'}
            </button>
          </div>

          ${
            this.activeDoubtExplanation
              ? `
            <div
              data-testid="results-ai-doubt-output"
              class="p-4 rounded-2xl bg-gradient-to-r from-[#FDF2F8] to-[#F5F3FF] border border-[#F5D0FE] space-y-1.5"
            >
              <div class="text-xs font-extrabold text-[#7C3AED]">
                🤖 AI Step-by-Step Doubt Resolution ${this.activeDoubtQuestionNumber ? `(Question #${this.activeDoubtQuestionNumber})` : ''}:
              </div>
              <p class="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">${this.escapeHtml(
                this.activeDoubtExplanation
              )}</p>
            </div>
          `
              : ''
          }
        </section>

        <!-- 5. Row-by-Row Question, Isolated Option Key & AI Doubt Solver Table -->
        <section
          aria-label="Row-by-Row Question and Solution Review"
          data-testid="answer-key-row-list"
          class="bg-white border-2 border-[#F3E8FF] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3E8FF]">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                Complete Answer Key &amp; AI Doubt Solving In A Row
              </span>
              <h3 class="text-lg font-extrabold text-slate-900">
                Questions, Isolated Option Keys &amp; Instant AI Doubt Solver (${filteredRows.length} Rows)
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
                  class="min-h-[38px] px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-colors cursor-pointer ${
                    this.historySubjectFilter === subj
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#FDF2F8] border border-[#F5D0FE] text-slate-600 hover:bg-pink-100'
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
                    ? `<span class="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">✓ CORRECT (+${row.marks})</span>`
                    : row.status === 'WRONG'
                      ? `<span class="px-2.5 py-1 rounded-xl bg-red-100 text-[#EF4444] text-[11px] font-extrabold">✕ WRONG (${row.marks})</span>`
                      : `<span class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-extrabold">○ UNATTEMPTED (0)</span>`;

                return `
                  <div
                    data-testid="answer-review-row"
                    class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-4 rounded-2xl bg-[#FDF2F8]/50 border border-[#F3E8FF] hover:bg-white hover:border-[#F472B6] transition-all"
                  >
                    <!-- Col 1: Q# + Subject + Status (2 Cols) -->
                    <div class="lg:col-span-2 flex lg:flex-col justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-[#7C3AED] text-white font-mono-tabular text-xs font-extrabold flex items-center justify-center shrink-0">
                          Q${row.number}
                        </span>
                        <span class="px-2.5 py-1 rounded-xl bg-white border border-[#F5D0FE] text-[#DB2777] text-xs font-bold">
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
                      ${
                        row.questionImg
                          ? `<img src="${row.questionImg}" alt="Question Crop" referrerpolicy="no-referrer" class="max-h-56 w-full rounded-xl border border-slate-200 bg-white p-2 object-contain" />`
                          : `<p class="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">${this.escapeHtml(row.prompt)}</p>`
                      }
                    </div>

                    <!-- Col 3: Your Answer vs Correct Answer Key (3 Cols) -->
                    <div class="lg:col-span-3 p-3 rounded-2xl bg-white border border-[#F3E8FF] space-y-2">
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
                        <span class="block text-[10px] font-bold uppercase text-[#10B981]">Correct Key</span>
                        <span class="text-xs font-extrabold text-emerald-900">
                          ${this.escapeHtml(row.correctAnswer)}
                        </span>
                      </div>
                    </div>

                    <!-- Col 4: Official Solution + Instant AI Doubt Solver Button (3 Cols) -->
                    <div class="lg:col-span-3 p-3 rounded-2xl bg-purple-50/60 border border-[#F3E8FF] space-y-2">
                      <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#7C3AED] block">
                        Official Step-by-Step Solution
                      </span>
                      ${
                        row.solutionImg
                          ? `<img src="${row.solutionImg}" alt="Solution Crop" referrerpolicy="no-referrer" class="max-h-56 w-full rounded-xl border border-indigo-200 bg-white p-2 object-contain" />`
                          : `<p class="text-xs text-slate-700 leading-relaxed">${this.escapeHtml(row.solution)}</p>`
                      }
                      <button
                        type="button"
                        data-action="solve-row-doubt-ai"
                        data-testid="solve-row-doubt-ai-btn"
                        data-row-number="${row.number}"
                        class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FDF2F8] border border-[#F5D0FE] text-[11px] font-extrabold text-[#DB2777] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span>🤖 Ask AI Doubt Solver (Q${row.number})</span>
                      </button>
                      ${
                        this.activeDoubtExplanation &&
                        this.activeDoubtQuestionNumber === row.number
                          ? `
                        <div class="p-2.5 rounded-xl bg-white border border-pink-200 text-[11px] text-slate-800 space-y-1">
                          <div class="font-extrabold text-[#7C3AED]">🤖 AI Doubt Resolution (Q${row.number}):</div>
                          <p class="whitespace-pre-wrap leading-relaxed">${this.escapeHtml(
                            this.activeDoubtExplanation
                          )}</p>
                        </div>
                      `
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

  private renderD3HistoryCharts(): void {
    if (!this.containerEl) return;
    const submissions = dataStore.getTestSubmissions();
    if (submissions.length === 0) return;

    const activeSub =
      submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
      this.lastSubmission ??
      submissions[0];

    const subHost = this.containerEl.querySelector<HTMLElement>('#d3-subject-accuracy-chart');
    if (subHost) {
      subHost.innerHTML = '';
      const subEntries = Object.values(activeSub.subjectBreakdown || {});
      const w = Math.max(subHost.clientWidth || 500, 300);
      const h = 165;
      const m = { top: 20, right: 20, bottom: 30, left: 40 };
      const iw = w - m.left - m.right;
      const ih = h - m.top - m.bottom;

      const svg = d3
        .select(subHost)
        .append('svg')
        .attr('viewBox', `0 0 ${w} ${h}`)
        .attr('class', 'w-full h-full overflow-visible');

      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const x = d3
        .scaleBand<string>()
        .domain(subEntries.map((s) => s.subject))
        .range([0, iw])
        .padding(0.4);

      const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);

      g.append('g')
        .selectAll('line')
        .data([0, 50, 100])
        .join('line')
        .attr('x1', 0)
        .attr('x2', iw)
        .attr('y1', (d) => y(d))
        .attr('y2', (d) => y(d))
        .attr('stroke', '#F3E8FF')
        .attr('stroke-dasharray', '3,3');

      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(3)
            .tickFormat((d) => `${d}%`)
        )
        .call((ax) => ax.select('.domain').remove())
        .call((ax) => ax.selectAll('line').remove())
        .selectAll('text')
        .attr('fill', '#64748B')
        .attr('font-size', '10px')
        .attr('font-weight', '600');

      g.append('g')
        .attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x))
        .call((ax) => ax.select('.domain').attr('stroke', '#F3E8FF'))
        .call((ax) => ax.selectAll('line').remove())
        .selectAll('text')
        .attr('fill', '#1E1B4B')
        .attr('font-size', '11px')
        .attr('font-weight', '800');

      const colorForSub = (sub: string) =>
        sub === 'Physics' ? '#7C3AED' : sub === 'Chemistry' ? '#10B981' : '#DB2777';

      g.selectAll('.sub-acc-bar')
        .data(subEntries)
        .join('rect')
        .attr('class', 'sub-acc-bar')
        .attr('x', (d) => x(d.subject) ?? 0)
        .attr('y', (d) => y(d.accuracyPercent))
        .attr('width', x.bandwidth())
        .attr('height', (d) => Math.max(6, ih - y(d.accuracyPercent)))
        .attr('rx', 8)
        .attr('fill', (d) => colorForSub(d.subject));

      g.selectAll('.sub-acc-label')
        .data(subEntries)
        .join('text')
        .attr('x', (d) => (x(d.subject) ?? 0) + x.bandwidth() / 2)
        .attr('y', (d) => Math.max(12, y(d.accuracyPercent) - 6))
        .attr('text-anchor', 'middle')
        .attr('fill', '#1E1B4B')
        .attr('font-size', '11px')
        .attr('font-weight', '800')
        .text((d) => `${d.accuracyPercent}% (${d.score}/${d.maxScore})`);
    }

    const trendHost = this.containerEl.querySelector<HTMLElement>('#d3-performance-trend-chart');
    if (trendHost) {
      trendHost.innerHTML = '';
      const ordered = [...submissions].reverse();
      const trendData = ordered.map((s, idx) => ({
        label: `T${idx + 1}`,
        acc: s.accuracyPercent ?? 75,
        isCurrent: s.testId === activeSub.testId,
      }));

      const w = Math.max(trendHost.clientWidth || 340, 260);
      const h = 130;
      const m = { top: 16, right: 18, bottom: 24, left: 34 };
      const iw = w - m.left - m.right;
      const ih = h - m.top - m.bottom;

      const svg = d3
        .select(trendHost)
        .append('svg')
        .attr('viewBox', `0 0 ${w} ${h}`)
        .attr('class', 'w-full h-full overflow-visible');

      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const x = d3
        .scalePoint<string>()
        .domain(trendData.map((d) => d.label))
        .range([0, iw])
        .padding(0.3);

      const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);

      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(3)
            .tickFormat((d) => `${d}%`)
        )
        .call((ax) => ax.select('.domain').remove())
        .call((ax) => ax.selectAll('line').remove())
        .selectAll('text')
        .attr('fill', '#64748B')
        .attr('font-size', '9px');

      g.append('g')
        .attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x))
        .call((ax) => ax.select('.domain').attr('stroke', '#F3E8FF'))
        .call((ax) => ax.selectAll('line').remove())
        .selectAll('text')
        .attr('fill', '#1E1B4B')
        .attr('font-size', '10px')
        .attr('font-weight', '700');

      const lineGen = d3
        .line<(typeof trendData)[0]>()
        .x((d) => x(d.label) ?? 0)
        .y((d) => y(d.acc))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(trendData)
        .attr('fill', 'none')
        .attr('stroke', '#7C3AED')
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);

      g.selectAll('.trend-dot')
        .data(trendData)
        .join('circle')
        .attr('cx', (d) => x(d.label) ?? 0)
        .attr('cy', (d) => y(d.acc))
        .attr('r', (d) => (d.isCurrent ? 5.5 : 4))
        .attr('fill', (d) => (d.isCurrent ? '#DB2777' : '#7C3AED'))
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);
    }
  }

  private buildFallbackQuestionRows(): QuestionAttemptRow[] {
    const pool = this.activeQuestions.length > 0 ? this.activeQuestions : this.buildCombinedQuestionPool().slice(0, 6);
    return pool.map((q, idx) => {
      const userAns = this.responses[q.id] ?? '';
      const trimmed = userAns.trim();
      const isUnattempted = trimmed === '';
      const isCorrect =
        !isUnattempted &&
        (q.type === 'NAT'
          ? Math.abs(Number(trimmed) - Number(q.correctAnswer)) < 0.05
          : extractIsolatedOptionLetterFromAnswer(trimmed, q.options) ===
            extractIsolatedOptionLetterFromAnswer(q.correctAnswer, q.options));
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
    const currentUser = dataStore.getUser();
    if (currentUser.isGuest || !currentUser.email) {
      this.callbacks.onShowToast(
        'Please sign in with Google to start a Sequential Mock Test.'
      );
      window.dispatchEvent(new CustomEvent('prepskm:open-google-auth'));
      return;
    }

    this.prepareExamPaper(this.engineMode);
    this.stage = 'exam';

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('tab');
    nextUrl.searchParams.set(
      'session',
      this.engineMode === 'INFINITE_PRACTICE' ? 'infinite' : 'mock'
    );
    window.history.pushState({}, '', nextUrl.toString());

    this.callbacks.onShowToast(
      `${this.selectedExam} (${this.selectedClassYear}) Sequential Mock opened in dedicated exam page (${this.activeQuestions.length} Qs)`
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

  private async submitPaper(): Promise<void> {
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
      title: `${this.selectedMockSeriesTitle} (${this.selectedExam} · ${this.selectedClassYear})`,
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
    this.aiSummaryOverride = null;

    const firstTargetRow =
      questionRows.find((r) => r.status === 'WRONG') ?? questionRows[0];
    if (firstTargetRow) {
      this.activeDoubtQuestionNumber = firstTargetRow.number;
      const isolatedKey =
        firstTargetRow.type === 'NAT'
          ? firstTargetRow.correctAnswer
          : extractIsolatedOptionLetterFromAnswer(firstTargetRow.correctAnswer);
      this.activeDoubtExplanation = `1. Automated AI Doubt Diagnosis (${firstTargetRow.subject} · ${firstTargetRow.topic}): ${firstTargetRow.solution}\n2. Isolated Option Key Verification: Lock Option (${isolatedKey}) to eliminate negative marking (-1).`;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('session');
    nextUrl.searchParams.set('tab', 'history');
    window.history.replaceState({}, '', nextUrl.toString());

    this.stage = 'history';
    await dataStore.saveTestSubmission(submission);
    this.callbacks.onShowToast(
      `Test submitted! Net Score: ${evalResult.totalScore}/${evalResult.maxPossibleScore} — AI Performance Summary & Doubt Solver ready below.`
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

    const doubtInput = this.containerEl.querySelector<HTMLInputElement>(
      '#results-ai-doubt-input'
    );
    doubtInput?.addEventListener('input', () => {
      this.activeDoubtQuery = doubtInput.value;
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      el.addEventListener('click', async () => {
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
          case 'google-signin-unlock-test': {
            window.dispatchEvent(new CustomEvent('prepskm:open-google-auth'));
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
              this.aiSummaryOverride = null;
              this.activeDoubtExplanation = '';
              this.rerender();
            }
            break;
          }
          case 'refresh-ai-test-summary': {
            const submissions = dataStore.getTestSubmissions();
            const activeSub =
              submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
              this.lastSubmission ??
              submissions[0];
            if (!activeSub) return;
            this.isGeneratingAISummary = true;
            this.rerender();
            this.aiSummaryOverride = await generateResultsAISummaryWithAI(activeSub);
            this.isGeneratingAISummary = false;
            this.callbacks.onShowToast('✨ Updated AI Performance Summary & Personalized Study Pathway!');
            this.rerender();
            break;
          }
          case 'solve-row-doubt-ai': {
            const rowNum = Number(el.dataset.rowNumber || 1);
            const submissions = dataStore.getTestSubmissions();
            const activeSub =
              submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
              this.lastSubmission ??
              submissions[0];
            const rows =
              activeSub?.questionRows && activeSub.questionRows.length > 0
                ? activeSub.questionRows
                : this.buildFallbackQuestionRows();
            const targetRow = rows.find((r) => r.number === rowNum) ?? rows[0];
            if (!targetRow) return;
            this.isResolvingDoubt = true;
            this.activeDoubtQuestionNumber = targetRow.number;
            this.rerender();
            this.activeDoubtExplanation = await resolveResultsDoubtWithAI(
              targetRow,
              this.activeDoubtQuery
            );
            this.isResolvingDoubt = false;
            this.callbacks.onShowToast(`🤖 AI Doubt Solver resolved Question #${targetRow.number}!`);
            this.rerender();
            break;
          }
          case 'submit-results-ai-doubt': {
            const submissions = dataStore.getTestSubmissions();
            const activeSub =
              submissions.find((s) => s.testId === this.selectedHistoryTestId) ??
              this.lastSubmission ??
              submissions[0];
            const rows =
              activeSub?.questionRows && activeSub.questionRows.length > 0
                ? activeSub.questionRows
                : this.buildFallbackQuestionRows();
            const targetRow =
              rows.find((r) => r.status === 'WRONG') ?? rows[0];
            if (!targetRow) return;
            this.isResolvingDoubt = true;
            this.activeDoubtQuestionNumber = targetRow.number;
            this.rerender();
            this.activeDoubtExplanation = await resolveResultsDoubtWithAI(
              targetRow,
              this.activeDoubtQuery || 'Explain the fastest method to solve this question and avoid negative marking.'
            );
            this.isResolvingDoubt = false;
            this.callbacks.onShowToast('🤖 AI Doubt Resolution generated on results screen!');
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
