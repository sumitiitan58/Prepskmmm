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
    this.render();
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

    const bestScore =
      submissions.length > 0 ? Math.max(...submissions.map((s) => s.score)) : 0;
    const avgAccuracy =
      chronologicalTrend.length > 0
        ? Math.round(
            chronologicalTrend.reduce((acc, item) => acc + item.accuracyPercent, 0) /
              chronologicalTrend.length
          )
        : 0;

    const questionRows = (activeSubmission?.questionRows || []).filter((q) => {
      if (this.activeSubjectFilter !== 'ALL' && q.subject !== this.activeSubjectFilter) {
        return false;
      }
      if (this.activeStatusFilter !== 'ALL' && q.status !== this.activeStatusFilter) {
        return false;
      }
      return true;
    });

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
                Inspect subject-wise accuracy bars, multi-test improvement curves, and revisit every past question and step-by-step solution.
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
          <!-- Chart 1: D3 Subject-Wise Accuracy -->
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

          <!-- Chart 2: D3 Multi-Attempt Improvement Curve -->
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

        <!-- PAST ATTEMPTS SELECTOR & QUESTION-BY-QUESTION SOLUTION VAULT -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <!-- Left 4 Cols: Past Mock Test Attempts List -->
          <div class="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 class="text-sm font-extrabold text-slate-900">Past Mock Exam Attempts</h3>
              <span class="text-[10px] font-mono-tabular font-bold text-slate-500">${submissions.length} Saved</span>
            </div>

            <div class="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              ${submissions
                .map((sub) => {
                  const isSelected = activeSubmission?.testId === sub.testId;
                  const maxScore = sub.maxScore ?? 24;
                  return `
                  <button
                    type="button"
                    data-th-action="select-submission"
                    data-test-id="${sub.testId}"
                    class="w-full text-left p-3.5 rounded-xl border transition-all space-y-2 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-[#4F46E5] shadow-2xs'
                        : 'bg-[#F8FAFC] border-slate-200 hover:border-indigo-200'
                    }"
                  >
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
                    <div class="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2">
                      ${this.escapeHtml(sub.title || 'NTA Mock Test Attempt')}
                    </div>
                    <div class="flex items-center justify-between text-xs font-mono-tabular pt-1 border-t border-slate-200/70">
                      <span class="font-bold text-slate-800">Score: +${sub.score}/${maxScore}</span>
                      <span class="font-extrabold text-[#10B981]">${sub.accuracyPercent ?? 75}% Acc</span>
                    </div>
                  </button>
                `;
                })
                .join('')}
            </div>
          </div>

          <!-- Right 8 Cols: Revisit Past Questions & Step-by-Step Solutions -->
          <div class="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            ${
              activeSubmission
                ? `
              <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    Past Question & Solution Review
                  </span>
                  <h3 class="text-base sm:text-lg font-extrabold text-slate-900">
                    ${this.escapeHtml(activeSubmission.title || 'Mock Test Review')}
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
              <div class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
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
            `
                : ''
            }
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

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelectorAll<HTMLElement>('[data-th-action]').forEach((el) => {
      const action = el.dataset.thAction;
      el.addEventListener('click', (e) => {
        if (action === 'go-cbt') {
          e.preventDefault();
          window.history.pushState({}, '', '/test.html');
          this.onNavigatePage('test');
        } else if (action === 'select-submission') {
          this.selectedSubmissionId = el.dataset.testId || null;
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
