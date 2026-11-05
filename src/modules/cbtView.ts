import { CBT_QUESTIONS } from '../constants';
import { dataStore } from '../services/firebaseService';
import type {
  CBTQuestion,
  QuestionStatus,
  SubjectName,
} from '../types';
import {
  evaluateCBTSubmission,
  formatDuration,
  getSubjectsForExam,
  summarizePaletteStatuses,
} from '../utils/examLogic';

export interface CBTCallbacks {
  onShowToast: (message: string) => void;
}

const TOTAL_EXAM_SECONDS = 180 * 60; // 180 minutes

export class CBTMockTestModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: CBTCallbacks;

  private activeSubject: SubjectName = 'Physics';
  private currentQuestionIndex = 0; // index within examQuestions
  private draftAnswer = '';
  private savedResponses: Record<string, string> = {};
  private questionStatusMap: Record<string, QuestionStatus> = {};
  private remainingSeconds = TOTAL_EXAM_SECONDS;
  private timerIntervalId: number | null = null;
  private isSubmittedModalOpen = false;

  constructor(callbacks: CBTCallbacks) {
    this.callbacks = callbacks;
  }

  private getExamQuestions(): CBTQuestion[] {
    const user = dataStore.getUser();
    const validSubjects = getSubjectsForExam(user.targetExam);
    const filtered = CBT_QUESTIONS.filter((q) => validSubjects.includes(q.subject));
    return filtered.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    const examQuestions = this.getExamQuestions();
    if (examQuestions.length > 0) {
      const firstId = examQuestions[this.currentQuestionIndex]?.id ?? examQuestions[0].id;
      if (!this.questionStatusMap[firstId]) {
        this.questionStatusMap[firstId] = 'not_answered';
      }
      this.draftAnswer = this.savedResponses[firstId] ?? '';
    }
    this.startTimer();
    this.rerender();
  }

  public unmount(): void {
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private startTimer(): void {
    if (this.timerIntervalId !== null) return;
    this.timerIntervalId = window.setInterval(() => {
      if (this.isSubmittedModalOpen) return;
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      const timerEl = this.containerEl?.querySelector('#cbt-countdown-timer');
      if (timerEl) {
        timerEl.textContent = formatDuration(this.remainingSeconds, true);
      }
      if (this.remainingSeconds === 0) {
        void this.submitExam();
      }
    }, 1000);
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const subjects = getSubjectsForExam(user.targetExam);
    const examQuestions = this.getExamQuestions();

    if (this.currentQuestionIndex >= examQuestions.length) {
      this.currentQuestionIndex = 0;
    }

    const currentQ = examQuestions[this.currentQuestionIndex];
    this.activeSubject = currentQ.subject;

    const paletteSummary = summarizePaletteStatuses(
      examQuestions.map((q) => q.id),
      this.questionStatusMap
    );

    const evaluation = this.isSubmittedModalOpen
      ? evaluateCBTSubmission(examQuestions, this.savedResponses)
      : null;

    this.containerEl.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <!-- Authentic NTA CBT Examination Header -->
        <header aria-label="NTA CBT Examination Header" class="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-xs text-zinc-400">
              <span class="text-indigo-400 font-semibold">NATIONAL TESTING AGENCY (NTA) REPLICA</span>
              <span aria-hidden="true"> · </span>
              <span>${user.targetExam === 'JEE' ? 'JEE (Main & Advanced) Paper-1' : 'NEET (UG) Pen & CBT Simulation'}</span>
            </div>
            <h1 class="text-lg sm:text-xl font-bold text-zinc-100">
              All-India High-Yield Full-Pattern Mock Test #04
            </h1>
            <div class="text-xs text-zinc-400 font-mono">
              Candidate: <span class="text-zinc-200 font-semibold">${this.escapeHtml(user.name)}</span> · Roll No: ${user.targetExam}2609418
            </div>
          </div>

          <!-- 180-Minute Countdown Timer & Direct Submit -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="px-4 py-2.5 rounded-xl bg-zinc-950 border ${
              this.remainingSeconds < 900 ? 'border-rose-500/70' : 'border-zinc-800'
            } flex items-center gap-3">
              <div>
                <div class="text-[10px] text-zinc-400">Time Remaining</div>
                <div
                  id="cbt-countdown-timer"
                  class="text-lg font-mono tabular-nums font-bold ${
                    this.remainingSeconds < 900 ? 'text-rose-400' : 'text-emerald-400'
                  }"
                >
                  ${formatDuration(this.remainingSeconds, true)}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-action="submit-exam"
              class="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
            >
              Submit Test & View Scorecard
            </button>
          </div>
        </header>

        <!-- Main Examination Split Layout: Question Area (8 Cols) + Question Palette (4 Cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left 8 Cols: Subject Tabs, Question Prompt, Options / NAT Keypad, Bottom Action Bar -->
          <div class="lg:col-span-8 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-6">
            <div class="space-y-5">
              <!-- Subject Section Tabs -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div role="tablist" aria-label="Exam Subject Sections" class="flex flex-wrap gap-2">
                  ${subjects
                    .map(
                      (sub) => `
                    <button
                      type="button"
                      role="tab"
                      aria-selected="${this.activeSubject === sub}"
                      data-action="switch-cbt-subject"
                      data-subject="${sub}"
                      class="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        this.activeSubject === sub
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }"
                    >
                      ${sub}
                    </button>
                  `
                    )
                    .join('')}
                </div>

                <div class="text-xs font-mono tabular-nums text-zinc-400">
                  <span>Marking: <strong class="text-emerald-400">+4</strong></span>
                  <span aria-hidden="true"> · </span>
                  <span>Negative: <strong class="text-rose-400">-1</strong></span>
                  <span aria-hidden="true"> · </span>
                  <span>Type: <strong class="text-indigo-300">${currentQ.type}</strong></span>
                </div>
              </div>

              <!-- Question Number & Topic Header -->
              <div class="space-y-3">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="font-bold text-zinc-100 text-sm font-mono tabular-nums">
                    Question ${currentQ.number} of ${examQuestions.length}
                  </span>
                  <span>${currentQ.subject} · ${this.escapeHtml(currentQ.topic)}</span>
                </div>

                <p class="text-sm sm:text-base text-zinc-100 leading-relaxed font-medium">
                  ${this.escapeHtml(currentQ.prompt)}
                </p>

                ${
                  currentQ.equationBlock
                    ? `
                  <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs sm:text-sm text-indigo-300 overflow-x-auto">
                    ${this.escapeHtml(currentQ.equationBlock)}
                  </div>
                `
                    : ''
                }
              </div>

              <!-- Response Input Area: MCQ Radio Options OR Virtual Numeric Keypad (NAT) -->
              ${
                currentQ.type === 'MCQ' && currentQ.options
                  ? `
                <div class="space-y-2.5 pt-2" role="radiogroup" aria-label="Question ${currentQ.number} Options">
                  ${currentQ.options
                    .map((optText, optIdx) => {
                      const isChecked = this.draftAnswer === String(optIdx);
                      const optionLetter = ['A', 'B', 'C', 'D'][optIdx];
                      return `
                      <label
                        class="flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-indigo-950/50 border-indigo-500 text-white'
                            : 'bg-zinc-950/80 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                        }"
                      >
                        <input
                          type="radio"
                          name="cbt-mcq-option"
                          value="${optIdx}"
                          ${isChecked ? 'checked' : ''}
                          data-action="select-mcq-option"
                          aria-label="Option ${optionLetter}: ${this.escapeHtml(optText)}"
                          class="w-4 h-4 text-indigo-600 bg-zinc-900 border-zinc-700 focus:ring-indigo-500"
                        />
                        <span class="font-mono font-bold text-xs text-indigo-400">(${optionLetter})</span>
                        <span class="text-xs sm:text-sm font-medium">${this.escapeHtml(optText)}</span>
                      </label>
                    `;
                    })
                    .join('')}
                </div>
              `
                  : `
                <!-- Numerical Answer Type (NAT) Virtual Numeric Keypad -->
                <div class="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 max-w-sm">
                  <div class="space-y-1">
                    <label for="nat-display-input" class="text-xs font-semibold text-zinc-300">
                      Numerical Answer Value (Use Keypad or Keyboard)
                    </label>
                    <input
                      id="nat-display-input"
                      type="text"
                      value="${this.escapeHtml(this.draftAnswer)}"
                      placeholder="Enter numerical value..."
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-indigo-500/60 font-mono text-base font-bold text-zinc-100 focus:outline-none"
                    />
                  </div>

                  <div class="grid grid-cols-3 gap-2" role="group" aria-label="Virtual Numeric Keypad">
                    ${['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-']
                      .map(
                        (key) => `
                      <button
                        type="button"
                        data-action="nat-key"
                        data-key="${key}"
                        aria-label="Keypad ${key}"
                        class="min-h-[42px] py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-mono text-sm font-bold text-zinc-100 transition-colors"
                      >
                        ${key}
                      </button>
                    `
                      )
                      .join('')}
                    <button
                      type="button"
                      data-action="nat-backspace"
                      class="col-span-2 min-h-[42px] py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-amber-300 transition-colors"
                    >
                      ⌫ Backspace
                    </button>
                    <button
                      type="button"
                      data-action="clear-response"
                      class="min-h-[42px] py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-rose-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              `
              }
            </div>

            <!-- NTA Bottom Action Bar -->
            <div class="pt-5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-action="save-and-next"
                  class="min-h-[44px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
                >
                  Save & Next
                </button>
                <button
                  type="button"
                  data-action="mark-review-next"
                  class="min-h-[44px] px-4 py-2.5 bg-violet-600/25 hover:bg-violet-600/35 border border-violet-500/50 text-violet-200 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Mark for Review & Next
                </button>
                <button
                  type="button"
                  data-action="clear-response"
                  class="min-h-[44px] px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Clear Response
                </button>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="prev-question"
                  ${this.currentQuestionIndex === 0 ? 'disabled' : ''}
                  class="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  data-action="next-question"
                  ${this.currentQuestionIndex === examQuestions.length - 1 ? 'disabled' : ''}
                  class="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          <!-- Right 4 Cols: Question Palette & Legend -->
          <aside aria-label="NTA Question Palette" class="lg:col-span-4 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-5">
            <div>
              <h2 class="text-base font-bold text-zinc-100">Question Palette & Status Legend</h2>
              <p class="text-xs text-zinc-400">Click any question number to jump directly.</p>
            </div>

            <!-- Status Counters Legend (Color + Explicit Text Label + Count) -->
            <div class="grid grid-cols-2 gap-2.5 text-xs">
              <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span class="text-emerald-400 font-medium">Answered</span>
                <span id="palette-answered-count" class="font-mono tabular-nums font-bold text-emerald-400">${paletteSummary.answered}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span class="text-rose-400 font-medium">Not Answered</span>
                <span id="palette-not-answered-count" class="font-mono tabular-nums font-bold text-rose-400">${paletteSummary.notAnswered}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span class="text-violet-400 font-medium">Marked Review</span>
                <span id="palette-review-count" class="font-mono tabular-nums font-bold text-violet-400">${paletteSummary.markedReview}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span class="text-zinc-400 font-medium">Not Visited</span>
                <span id="palette-not-visited-count" class="font-mono tabular-nums font-bold text-zinc-300">${paletteSummary.notVisited}</span>
              </div>
            </div>

            <!-- 15-Question Grid -->
            <div class="grid grid-cols-5 gap-2.5 pt-2" role="group" aria-label="Question Number Navigation Grid">
              ${examQuestions
                .map((q, idx) => {
                  const st = this.questionStatusMap[q.id] ?? 'not_visited';
                  const isCurrent = idx === this.currentQuestionIndex;
                  const colorClasses =
                    st === 'answered'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : st === 'not_answered'
                        ? 'bg-rose-600/80 text-white border-rose-500'
                        : st === 'marked_review' || st === 'answered_marked_review'
                          ? 'bg-violet-600 text-white border-violet-400'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200';

                  return `
                  <button
                    type="button"
                    data-action="jump-question"
                    data-index="${idx}"
                    aria-label="Go to Question ${q.number} (${st.replace('_', ' ')})"
                    class="min-h-[44px] rounded-xl border font-mono tabular-nums text-xs font-bold transition-transform ${colorClasses} ${
                      isCurrent ? 'ring-2 ring-white scale-105' : ''
                    }"
                  >
                    ${String(q.number).padStart(2, '0')}
                  </button>
                `;
                })
                .join('')}
            </div>

            <div class="pt-4 border-t border-zinc-800 space-y-2">
              <button
                type="button"
                data-action="submit-exam"
                class="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Finish & Evaluate Paper (+4 / -1)
              </button>
            </div>
          </aside>
        </div>
      </div>

      <!-- Post-Submission Scorecard & Step-by-Step Solutions Modal -->
      ${
        this.isSubmittedModalOpen && evaluation
          ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="cbt-scorecard-title">
          <div class="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 max-h-[88vh] overflow-y-auto">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <div class="text-xs text-emerald-400 font-semibold">
                  <span>NTA CBT Evaluation Complete</span>
                  <span aria-hidden="true"> · </span>
                  <span>Synced to Profile & Leaderboard</span>
                </div>
                <h2 id="cbt-scorecard-title" class="text-2xl font-bold text-zinc-100 mt-0.5">
                  Official Performance Scorecard & Solutions
                </h2>
              </div>
              <button
                type="button"
                data-action="close-scorecard"
                aria-label="Close Scorecard Modal"
                class="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
              >
                Return to Question Paper
              </button>
            </div>

            <!-- KPI Summary Row -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400 font-sans">Net Score (+4 / -1)</div>
                <div class="text-2xl font-bold text-indigo-400 mt-1">
                  ${evaluation.totalScore} / ${evaluation.maxPossibleScore}
                </div>
              </div>
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400 font-sans">Accuracy Rate</div>
                <div class="text-2xl font-bold text-emerald-400 mt-1">
                  ${evaluation.accuracyPercent}%
                </div>
              </div>
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400 font-sans">Correct (+4) / Wrong (-1)</div>
                <div class="text-2xl font-bold text-zinc-100 mt-1">
                  ${evaluation.correctCount}C · ${evaluation.wrongCount}W
                </div>
              </div>
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div class="text-xs text-zinc-400 font-sans">Time Taken</div>
                <div class="text-2xl font-bold text-zinc-200 mt-1">
                  ${formatDuration(TOTAL_EXAM_SECONDS - this.remainingSeconds)}
                </div>
              </div>
            </div>

            <!-- Subject-Wise Breakdown Table -->
            <div class="space-y-2">
              <h3 class="text-sm font-bold text-zinc-200">Subject-Wise Strengths & Accuracy</h3>
              <div class="overflow-x-auto rounded-xl border border-zinc-800">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th class="p-3">Subject</th>
                      <th class="p-3 text-right">Net Score</th>
                      <th class="p-3 text-right">Correct (+4)</th>
                      <th class="p-3 text-right">Wrong (-1)</th>
                      <th class="p-3 text-right">Unattempted</th>
                      <th class="p-3 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-800 bg-zinc-900/60 font-mono tabular-nums">
                    ${Object.values(evaluation.subjectBreakdown)
                      .map(
                        (s) => `
                      <tr>
                        <td class="p-3 font-sans font-bold text-zinc-100">${s.subject}</td>
                        <td class="p-3 text-right font-bold text-indigo-400">${s.score} / ${s.maxScore}</td>
                        <td class="p-3 text-right text-emerald-400">${s.correct}</td>
                        <td class="p-3 text-right text-rose-400">${s.wrong}</td>
                        <td class="p-3 text-right text-zinc-400">${s.unattempted}</td>
                        <td class="p-3 text-right text-zinc-200">${s.accuracyPercent}%</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Question-by-Question Detailed Solutions -->
            <div class="space-y-3">
              <h3 class="text-sm font-bold text-zinc-200">Question-by-Question Answer Key & Step-by-Step Solutions</h3>
              <div class="space-y-3">
                ${examQuestions
                  .map((q) => {
                    const res = evaluation.perQuestionResult[q.id];
                    const statusLabel =
                      res.status === 'correct'
                        ? 'Correct (+4)'
                        : res.status === 'wrong'
                          ? 'Wrong (-1)'
                          : 'Unattempted (0)';
                    const statusColor =
                      res.status === 'correct'
                        ? 'text-emerald-400'
                        : res.status === 'wrong'
                          ? 'text-rose-400'
                          : 'text-zinc-400';

                    const formattedCorrect =
                      q.type === 'MCQ' && q.options
                        ? `(${['A', 'B', 'C', 'D'][Number(q.correctAnswer)]}) ${
                            q.options[Number(q.correctAnswer)]
                          }`
                        : q.correctAnswer;

                    return `
                    <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-bold text-zinc-100">
                          Q${q.number}. ${q.subject} · ${this.escapeHtml(q.topic)}
                        </span>
                        <span class="font-mono font-bold ${statusColor}">
                          ${statusLabel}
                        </span>
                      </div>
                      <p class="text-xs text-zinc-300">${this.escapeHtml(q.prompt)}</p>
                      <div class="text-xs font-mono text-indigo-300">
                        Correct Answer: ${this.escapeHtml(formattedCorrect)}
                      </div>
                      <p class="text-xs text-zinc-400 leading-relaxed">
                        <strong class="text-zinc-200">Solution:</strong> ${this.escapeHtml(q.solution)}
                      </p>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      `
          : ''
      }
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.containerEl) return;

    const examQuestions = this.getExamQuestions();
    const currentQ = examQuestions[this.currentQuestionIndex];

    // NAT keyboard input
    const natInput = this.containerEl.querySelector<HTMLInputElement>(
      '#nat-display-input'
    );
    natInput?.addEventListener('input', () => {
      this.draftAnswer = natInput.value.replace(/[^0-9.-]/g, '');
      natInput.value = this.draftAnswer;
    });

    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;

      if (action === 'select-mcq-option') {
        el.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          this.draftAnswer = target.value;
          this.rerender();
        });
        return;
      }

      el.addEventListener('click', async () => {
        switch (action) {
          case 'switch-cbt-subject': {
            const sub = el.dataset.subject as SubjectName;
            const firstIdx = examQuestions.findIndex((q) => q.subject === sub);
            if (firstIdx >= 0) {
              this.navigateToQuestion(firstIdx);
            }
            break;
          }
          case 'nat-key': {
            const key = el.dataset.key ?? '';
            this.draftAnswer = `${this.draftAnswer}${key}`.slice(0, 12);
            this.rerender();
            break;
          }
          case 'nat-backspace': {
            this.draftAnswer = this.draftAnswer.slice(0, -1);
            this.rerender();
            break;
          }
          case 'clear-response': {
            this.draftAnswer = '';
            delete this.savedResponses[currentQ.id];
            this.questionStatusMap[currentQ.id] = 'not_answered';
            this.rerender();
            break;
          }
          case 'save-and-next': {
            if (this.draftAnswer.trim() !== '') {
              this.savedResponses[currentQ.id] = this.draftAnswer.trim();
              this.questionStatusMap[currentQ.id] = 'answered';
            } else {
              delete this.savedResponses[currentQ.id];
              this.questionStatusMap[currentQ.id] = 'not_answered';
            }
            const nextIdx = (this.currentQuestionIndex + 1) % examQuestions.length;
            this.navigateToQuestion(nextIdx);
            break;
          }
          case 'mark-review-next': {
            if (this.draftAnswer.trim() !== '') {
              this.savedResponses[currentQ.id] = this.draftAnswer.trim();
              this.questionStatusMap[currentQ.id] = 'answered_marked_review';
            } else {
              this.questionStatusMap[currentQ.id] = 'marked_review';
            }
            const nextIdx = (this.currentQuestionIndex + 1) % examQuestions.length;
            this.navigateToQuestion(nextIdx);
            break;
          }
          case 'prev-question': {
            if (this.currentQuestionIndex > 0) {
              this.navigateToQuestion(this.currentQuestionIndex - 1);
            }
            break;
          }
          case 'next-question': {
            if (this.currentQuestionIndex < examQuestions.length - 1) {
              this.navigateToQuestion(this.currentQuestionIndex + 1);
            }
            break;
          }
          case 'jump-question': {
            const idx = Number(el.dataset.index);
            if (!Number.isNaN(idx)) {
              this.navigateToQuestion(idx);
            }
            break;
          }
          case 'submit-exam': {
            // Save current draft if user selected an option right before clicking Submit
            if (this.draftAnswer.trim() !== '') {
              this.savedResponses[currentQ.id] = this.draftAnswer.trim();
              this.questionStatusMap[currentQ.id] = 'answered';
            }
            await this.submitExam();
            break;
          }
          case 'close-scorecard': {
            this.isSubmittedModalOpen = false;
            this.rerender();
            break;
          }
        }
      });
    });
  }

  private navigateToQuestion(targetIndex: number): void {
    const examQuestions = this.getExamQuestions();
    const targetQ = examQuestions[targetIndex];
    if (!targetQ) return;

    this.currentQuestionIndex = targetIndex;
    if (!this.questionStatusMap[targetQ.id] || this.questionStatusMap[targetQ.id] === 'not_visited') {
      this.questionStatusMap[targetQ.id] = 'not_answered';
    }
    this.draftAnswer = this.savedResponses[targetQ.id] ?? '';
    this.rerender();
  }

  private async submitExam(): Promise<void> {
    const examQuestions = this.getExamQuestions();
    const evaluation = evaluateCBTSubmission(examQuestions, this.savedResponses);
    const user = dataStore.getUser();

    await dataStore.saveTestSubmission({
      testId: `mock_${user.targetExam.toLowerCase()}_04`,
      uid: user.uid,
      score: evaluation.totalScore,
      correctCount: evaluation.correctCount,
      wrongCount: evaluation.wrongCount,
      timeTaken: Math.max(1, TOTAL_EXAM_SECONDS - this.remainingSeconds),
      subjectBreakdown: evaluation.subjectBreakdown,
    });

    this.isSubmittedModalOpen = true;
    this.callbacks.onShowToast(
      `CBT Mock Test Submitted! Net Score: ${evaluation.totalScore}/${evaluation.maxPossibleScore} · Leaderboard Updated`
    );
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
