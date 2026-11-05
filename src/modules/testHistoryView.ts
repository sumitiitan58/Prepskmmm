import { dataStore } from '../services/firebaseService';
import type { PageId, SubjectName } from '../types';
import { computePerformanceTrendsForD3, formatDuration } from '../utils/examLogic';
import {
  renderD3ImprovementTrendGraph,
  renderD3SubjectAccuracyChart,
} from './d3Visualizations';

export class TestHistoryModule {
  private container: HTMLElement | null = null;
  private selectedSubmissionId: string | null = null;
  private isSingleResultPage = false;
  private activeSubjectFilter: SubjectName | 'ALL' = 'ALL';
  private activeStatusFilter: 'ALL' | 'CORRECT' | 'WRONG' | 'UNATTEMPTED' = 'ALL';
  private onNavigatePage: (page: PageId) => void;
  private onShowToast: (msg: string) => void;

  constructor(params: {
    onNavigatePage: (page: PageId) => void;
    onShowToast: (msg: string) => void;
  }) {
    this.onNavigatePage = params.onNavigatePage;
    this.onShowToast = params.onShowToast;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.syncFromUrl();
    this.render();
  }

  private syncFromUrl(): void {
    const params = new URLSearchParams(window.location.search);
    const testIdParam = params.get('testId');
    const viewParam = params.get('view');
    if (testIdParam) {
      this.selectedSubmissionId = testIdParam;
    }
    this.isSingleResultPage = viewParam === 'single' || Boolean(testIdParam);
  }

  public render(): void {
    if (!this.container) return;

    const submissions = dataStore.getTestSubmissions();
    const { chronologicalTrend, subjectAggregates, overallImprovementDelta } =
      computePerformanceTrendsForD3(submissions);

    const activeSubmission =
      submissions.find((s) => s.testId === this.selectedSubmissionId) ??
      submissions[0] ??
      null;

    if (activeSubmission && !this.selectedSubmissionId) {
      this.selectedSubmissionId = activeSubmission.testId;
    }

    const questionRows = (activeSubmission?.questionRows || []).filter((q) => {
      if (this.activeSubjectFilter !== 'ALL' && q.subject !== this.activeSubjectFilter) {
        return false;
      }
      if (this.activeStatusFilter !== 'ALL' && q.status !== this.activeStatusFilter) {
        return false;
      }
      return true;
    });

    // Dedicated Standalone Page for a Specific Mock Test Result
    if (this.isSingleResultPage && activeSubmission) {
      const maxScore =
        activeSubmission.maxScore ?? Math.max(4, (activeSubmission.totalQuestions ?? 6) * 4);
      const totalQ = (activeSubmission.questionRows || []).length || activeSubmission.totalQuestions || 6;
      const skippedCount = Math.max(
        0,
        totalQ - activeSubmission.correctCount - activeSubmission.wrongCount
      );

      this.container.innerHTML = `
        <div class="space-y-6 pb-12" data-testid="single-test-result-page">
          <!-- Dedicated Single Test Result Top Bar -->
          <section class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                data-th-action="back-to-all-results"
                data-testid="back-to-all-results-btn"
                class="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-extrabold flex items-center gap-2 transition-colors"
              >
                <span>← Back to All Mock Test Results (${submissions.length})</span>
              </button>

              <div class="flex items-center gap-2">
                <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold">
                  ✓ Dedicated Result & Solution Page
                </span>
                <a
                  href="/test.html"
                  data-th-action="go-cbt"
                  class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-500 text-white text-xs font-extrabold inline-flex items-center"
                >
                  ⚡ Attempt New Mock
                </a>
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-xs font-mono-tabular text-indigo-300">
                Attempt ID: ${this.escapeHtml(activeSubmission.testId)} · ${this.escapeHtml(activeSubmission.examType || 'JEE')} · ${this.escapeHtml(activeSubmission.classYear || 'Class 12')}
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight">
                ${this.escapeHtml(activeSubmission.title || 'Official NTA Mock Test Result')}
              </h1>
            </div>

            <!-- 4 KPI Cards for This Specific Test Result -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                <div class="text-[10px] font-bold uppercase text-indigo-200">Final Score</div>
                <div class="text-xl sm:text-2xl font-mono-tabular font-extrabold text-white mt-0.5">
                  +${activeSubmission.score} <span class="text-xs text-slate-300">/ ${maxScore}</span>
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                <div class="text-[10px] font-bold uppercase text-emerald-300">Accuracy</div>
                <div class="text-xl sm:text-2xl font-mono-tabular font-extrabold text-[#10B981] mt-0.5">
                  ${activeSubmission.accuracyPercent ?? 75}%
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                <div class="text-[10px] font-bold uppercase text-amber-300">Correct / Wrong / Skip</div>
                <div class="text-lg sm:text-xl font-mono-tabular font-extrabold text-white mt-0.5">
                  <span class="text-[#10B981]">${activeSubmission.correctCount}C</span> ·
                  <span class="text-rose-400">${activeSubmission.wrongCount}W</span> ·
                  <span class="text-slate-300">${skippedCount}S</span>
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/15">
                <div class="text-[10px] font-bold uppercase text-indigo-200">Time Taken</div>
                <div class="text-xl sm:text-2xl font-mono-tabular font-extrabold text-white mt-0.5">
                  ${formatDuration(activeSubmission.timeTaken || 900)}
                </div>
              </div>
            </div>
          </section>

          <!-- Single-Test D3.js Subject Accuracy Graph & Diagnostic Insights -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div class="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    D3.js Subject Accuracy Breakdown (This Test)
                  </span>
                  <h2 class="text-base font-extrabold text-slate-900">
                    Subject-Wise Performance in This Attempt
                  </h2>
                </div>
              </div>
              <div id="d3-history-subject-accuracy" class="w-full min-h-[240px]"></div>
            </div>

            <div class="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#10B981]">
                  D3.js Overall Progression Context
                </span>
                <h2 class="text-base font-extrabold text-slate-900">
                  How This Attempt Compares Across Your Test History
                </h2>
              </div>
              <div id="d3-history-improvement-trend" class="w-full min-h-[240px]"></div>
            </div>
          </section>

          <!-- Question-by-Question Detailed Solutions for This Specific Test -->
          ${this.renderQuestionSolutionsSection(activeSubmission, questionRows)}
        </div>
      `;

      const subChartEl = this.container.querySelector<HTMLElement>(
        '#d3-history-subject-accuracy'
      );
      const trendChartEl = this.container.querySelector<HTMLElement>(
        '#d3-history-improvement-trend'
      );
      renderD3SubjectAccuracyChart(subChartEl, [activeSubmission]);
      renderD3ImprovementTrendGraph(trendChartEl, submissions);
      this.bindEvents();
      return;
    }

    const bestScore =
      submissions.length > 0 ? Math.max(...submissions.map((s) => s.score)) : 0;
    const avgAccuracy =
      chronologicalTrend.length > 0
        ? Math.round(
            chronologicalTrend.reduce((acc, item) => acc + item.accuracyPercent, 0) /
              chronologicalTrend.length
          )
        : 0;

    this.container.innerHTML = `
      <div class="space-y-6 pb-10" data-testid="dedicated-test-history-page">
        <!-- Top Header & Summary KPI Strip -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] text-[10px] font-extrabold uppercase tracking-wider">
                <span>📊 Firestore Cloud Synced · D3.js Analytics Engine</span>
              </div>
              <h1 data-edit-key="test-history-heading" class="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                Mock Test History & D3.js Accuracy Trends
              </h1>
              <p class="text-xs sm:text-sm text-slate-600">
                Click any specific mock test attempt below to open its <strong>Dedicated Result & Solution Page</strong>.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <a
                href="/test.html"
                data-th-action="go-cbt"
                class="min-h-[40px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
              >
                <span>⚡ Launch New Mock / Infinite Drill</span>
              </a>
            </div>
          </div>

          <!-- 4 KPI Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div class="text-[10px] font-bold uppercase text-slate-500">Total Attempts</div>
              <div class="text-lg sm:text-xl font-mono-tabular font-extrabold text-slate-900 mt-0.5">
                ${submissions.length} Tests
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div class="text-[10px] font-bold uppercase text-slate-500">Average Accuracy</div>
              <div class="text-lg sm:text-xl font-mono-tabular font-extrabold text-[#4F46E5] mt-0.5">
                ${avgAccuracy}%
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div class="text-[10px] font-bold uppercase text-slate-500">Net Accuracy Gain</div>
              <div class="text-lg sm:text-xl font-mono-tabular font-extrabold text-[#10B981] mt-0.5">
                ${overallImprovementDelta >= 0 ? `+${overallImprovementDelta}%` : `${overallImprovementDelta}%`}
              </div>
            </div>
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div class="text-[10px] font-bold uppercase text-slate-500">Best Mock Score</div>
              <div class="text-lg sm:text-xl font-mono-tabular font-extrabold text-amber-600 mt-0.5">
                +${bestScore} Marks
              </div>
            </div>
          </div>
        </section>

        <!-- D3.JS DUAL ANALYTICS ROW: Subject-Wise Accuracy Graph + Improvement Trend Graph -->
        <section class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  D3.js Subject Breakdown
                </span>
                <h2 class="text-base font-extrabold text-slate-900">
                  Subject-Wise Accuracy vs. 99%ile Benchmark
                </h2>
              </div>
              <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono-tabular font-bold">
                Target ≥ 75%
              </span>
            </div>
            <div id="d3-history-subject-accuracy" class="w-full min-h-[250px]"></div>
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              ${subjectAggregates
                .slice(0, 3)
                .map(
                  (s) => `
                <div class="p-2 rounded-lg bg-slate-50 text-center">
                  <div class="text-[10px] font-bold text-slate-500">${s.subject}</div>
                  <div class="text-xs font-mono-tabular font-extrabold text-slate-900">${s.avgAccuracy}% (${s.totalScore}/${s.totalMaxScore})</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#10B981]">
                  D3.js Progression Curve
                </span>
                <h2 class="text-base font-extrabold text-slate-900">
                  Chronological Accuracy & Score Improvement Trend
                </h2>
              </div>
              <div class="flex items-center gap-3 text-[10px] font-bold">
                <span class="flex items-center gap-1 text-[#4F46E5]">● Accuracy %</span>
                <span class="flex items-center gap-1 text-[#10B981]">● Score %</span>
              </div>
            </div>
            <div id="d3-history-improvement-trend" class="w-full min-h-[250px]"></div>
            <div class="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Synced from Firestore <code>test_submissions</code></span>
              <span class="font-mono-tabular font-bold text-[#10B981]">
                Progression: ${chronologicalTrend.map((t) => `${t.accuracyPercent}%`).join(' → ')}
              </span>
            </div>
          </div>
        </section>

        <!-- CLICKABLE PAST MOCK TEST ATTEMPTS GRID (Clicking Any Result Opens Its Dedicated Result Page!) -->
        <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                Individual Result Pages
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Past Mock Exam Results (${submissions.length} Attempts — Click Any Result to Open Dedicated Page)
              </h2>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${submissions
              .map((sub) => {
                const maxScore = sub.maxScore ?? 24;
                return `
                <button
                  type="button"
                  data-th-action="open-single-result-page"
                  data-test-id="${sub.testId}"
                  data-testid="past-attempt-card-${sub.testId}"
                  class="w-full text-left p-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] hover:bg-white hover:border-[#4F46E5] hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                >
                  <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        sub.mode === 'INFINITE_PRACTICE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-[#4F46E5]'
                      }">
                        ${sub.mode === 'INFINITE_PRACTICE' ? 'INFINITE DRILL' : 'NTA MOCK'}
                      </span>
                      <span class="text-[10px] font-mono-tabular text-slate-500">
                        ⏱ ${formatDuration(sub.timeTaken || 900)}
                      </span>
                    </div>
                    <div class="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-[#4F46E5] line-clamp-2">
                      ${this.escapeHtml(sub.title || 'NTA Mock Test Attempt')}
                    </div>
                  </div>

                  <div class="pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono-tabular">
                    <span class="font-bold text-slate-800">Score: +${sub.score}/${maxScore}</span>
                    <span class="font-extrabold text-[#10B981]">${sub.accuracyPercent ?? 75}% Acc</span>
                    <span class="text-[11px] font-sans font-extrabold text-[#4F46E5]">Open Page →</span>
                  </div>
                </button>
              `;
              })
              .join('')}
          </div>
        </section>
      </div>
    `;

    // Render D3.js Charts
    const subChartEl = this.container.querySelector<HTMLElement>(
      '#d3-history-subject-accuracy'
    );
    const trendChartEl = this.container.querySelector<HTMLElement>(
      '#d3-history-improvement-trend'
    );
    renderD3SubjectAccuracyChart(subChartEl, submissions);
    renderD3ImprovementTrendGraph(trendChartEl, submissions);

    this.bindEvents();
  }

  private renderQuestionSolutionsSection(
    activeSubmission: NonNullable<ReturnType<typeof dataStore.getTestSubmissions>[number]>,
    questionRows: NonNullable<ReturnType<typeof dataStore.getTestSubmissions>[number]['questionRows']>
  ): string {
    return `
      <section class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
              Past Question & Step-by-Step Solution Review
            </span>
            <h3 class="text-base sm:text-lg font-extrabold text-slate-900">
              ${this.escapeHtml(activeSubmission.title || 'Mock Test Review')} (${questionRows.length} Questions)
            </h3>
          </div>

          <!-- Filter by Status -->
          <div class="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
            ${(['ALL', 'CORRECT', 'WRONG', 'UNATTEMPTED'] as const)
              .map(
                (st) => `
              <button
                type="button"
                data-th-action="filter-status"
                data-status="${st}"
                class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                  this.activeStatusFilter === st
                    ? 'bg-white text-[#4F46E5] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }"
              >
                ${st}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Filter by Subject -->
        <div class="flex flex-wrap items-center gap-1.5">
          ${(['ALL', 'Physics', 'Chemistry', 'Math', 'Biology'] as const)
            .map(
              (sub) => `
            <button
              type="button"
              data-th-action="filter-subject"
              data-subject="${sub}"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                this.activeSubjectFilter === sub
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }"
            >
              ${sub}
            </button>
          `
            )
            .join('')}
        </div>

        <!-- AI Diagnosis Bullets -->
        ${
          activeSubmission.diagnosisBullets && activeSubmission.diagnosisBullets.length > 0
            ? `
          <div class="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
            <div class="text-[11px] font-extrabold text-[#4F46E5] uppercase">Post-Test Diagnostic Notes</div>
            <ul class="list-disc list-inside text-xs text-slate-700 space-y-1">
              ${activeSubmission.diagnosisBullets.map((b) => `<li>${this.escapeHtml(b)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }

        <!-- Question & Solution Cards -->
        <div class="space-y-3">
          ${
            questionRows.length === 0
              ? `
            <div class="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No questions match the selected filter in this attempt.
            </div>
          `
              : questionRows
                  .map((q) => {
                    const badgeClass =
                      q.status === 'CORRECT'
                        ? 'bg-emerald-100 text-emerald-800'
                        : q.status === 'WRONG'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700';
                    return `
                    <div class="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded bg-slate-900 text-white font-mono-tabular text-[11px] font-bold">
                            Q${q.number}
                          </span>
                          <span class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] text-[11px] font-bold">
                            ${q.subject} · ${this.escapeHtml(q.topic)}
                          </span>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tabular font-extrabold ${badgeClass}">
                          ${q.status} (${q.marks >= 0 ? `+${q.marks}` : q.marks} Marks)
                        </span>
                      </div>

                      ${
                        q.questionImg
                          ? `
                        <div class="rounded-xl bg-white border border-slate-200 p-2 flex justify-center">
                          <img src="${q.questionImg}" alt="Question ${q.number}" class="max-h-72 w-auto object-contain rounded-lg" />
                        </div>
                      `
                          : `
                        <p class="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                          ${this.escapeHtml(q.prompt)}
                        </p>
                      `
                      }

                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono-tabular">
                        <div class="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span class="text-slate-500">Your Response:</span>
                          <strong class="ml-1 ${q.status === 'CORRECT' ? 'text-emerald-700' : 'text-rose-600'}">
                            ${this.escapeHtml(q.userAnswer || 'Not Attempted')}
                          </strong>
                        </div>
                        <div class="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                          <span class="text-emerald-800">Correct Answer:</span>
                          <strong class="ml-1 text-emerald-900">
                            ${this.escapeHtml(q.correctAnswer)}
                          </strong>
                        </div>
                      </div>

                      <!-- Step-by-Step Solution Box -->
                      <div class="p-3 rounded-xl bg-white border border-indigo-100 space-y-1.5">
                        <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                          ✓ Verified Step-by-Step Solution
                        </div>
                        ${
                          q.solutionImg
                            ? `<img src="${q.solutionImg}" alt="Solution ${q.number}" class="max-h-64 w-auto object-contain rounded-lg my-1" />`
                            : ''
                        }
                        <p class="text-xs text-slate-700 leading-relaxed">
                          ${this.escapeHtml(q.solution)}
                        </p>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </section>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelectorAll<HTMLElement>('[data-th-action]').forEach((el) => {
      const action = el.dataset.thAction;
      el.addEventListener('click', (e) => {
        if (action === 'go-cbt') {
          e.preventDefault();
          window.history.pushState({}, '', '/test.html');
          this.onNavigatePage('test');
        } else if (action === 'open-single-result-page') {
          const tid = el.dataset.testId || null;
          this.selectedSubmissionId = tid;
          this.isSingleResultPage = true;
          if (tid) {
            window.history.pushState(
              {},
              '',
              `/test-history.html?testId=${encodeURIComponent(tid)}&view=single`
            );
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
          this.render();
        } else if (action === 'back-to-all-results') {
          this.isSingleResultPage = false;
          window.history.pushState({}, '', '/test-history.html');
          this.render();
        } else if (action === 'filter-status') {
          this.activeStatusFilter =
            (el.dataset.status as 'ALL' | 'CORRECT' | 'WRONG' | 'UNATTEMPTED') || 'ALL';
          this.render();
        } else if (action === 'filter-subject') {
          this.activeSubjectFilter = (el.dataset.subject as SubjectName | 'ALL') || 'ALL';
          this.render();
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
