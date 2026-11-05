import { FORMULA_SHEETS, MENTOR_AVATAR_PATH } from '../constants';
import { dataStore } from '../services/firebaseService';
import type {
  FormulaSheet,
  ModuleId,
  ProficiencyLevel,
  SubjectName,
  TaskBucket,
} from '../types';
import {
  calculateMentorshipPrice,
  computeUpdatedStreak,
  getSubjectsForExam,
} from '../utils/examLogic';
import { downloadFormulaSheetFile, generateUpiQrSvg } from '../utils/qrGenerator';

export interface DashboardCallbacks {
  onNavigateModule: (module: ModuleId) => void;
  onShowToast: (message: string) => void;
}

export class DashboardModule {
  private activeTaskTab: TaskBucket = 'Today';
  private activeSubjectFilter: 'ALL' | SubjectName = 'ALL';
  private activeClassFilter: 'ALL' | 'Class 11' | 'Class 12' = 'ALL';
  private selectedMentorshipDuration = 30;
  private selectedUpiApp: 'GPay' | 'PhonePe' | 'Paytm' = 'GPay';
  private isMentorshipDrawerOpen = false;
  private inspectedFormulaSheet: FormulaSheet | null = null;

  // Personalized Study Plan Generator state
  private planDailyHours = 6;
  private planProficiency: Record<SubjectName, ProficiencyLevel> = {
    Physics: 'Weak',
    Chemistry: 'Moderate',
    Math: 'Strong',
    Biology: 'Moderate',
  };
  private selectedPlanWeek = 1;
  private initializedFromStoredPlan = false;

  private callbacks: DashboardCallbacks;
  private containerEl: HTMLElement | null = null;

  constructor(callbacks: DashboardCallbacks) {
    this.callbacks = callbacks;
  }

  public openMentorshipDrawer(durationMinutes?: number): void {
    if (durationMinutes) {
      this.selectedMentorshipDuration = durationMinutes;
    }
    this.isMentorshipDrawerOpen = true;
    this.rerender();
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    if (!this.initializedFromStoredPlan) {
      const existingPlan = dataStore.getStudyPlan();
      this.planDailyHours = existingPlan.dailyHours;
      this.planProficiency = {
        Physics: existingPlan.proficiency.Physics ?? 'Weak',
        Chemistry: existingPlan.proficiency.Chemistry ?? 'Moderate',
        Math: existingPlan.proficiency.Math ?? 'Strong',
        Biology: existingPlan.proficiency.Biology ?? 'Moderate',
      };
      this.initializedFromStoredPlan = true;
    }
    this.rerender();
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const tasks = dataStore.getTasks();
    const studyPlan = dataStore.getStudyPlan();
    const leaderboardStandings = dataStore.getLeaderboardStandings();
    const examSubjects = getSubjectsForExam(user.targetExam);

    if (
      this.activeSubjectFilter !== 'ALL' &&
      !examSubjects.includes(this.activeSubjectFilter)
    ) {
      this.activeSubjectFilter = 'ALL';
    }

    const filteredTasks = tasks.filter((t) => {
      if (t.type !== this.activeTaskTab) return false;
      if (!examSubjects.includes(t.subject)) return false;
      if (this.activeSubjectFilter !== 'ALL' && t.subject !== this.activeSubjectFilter) {
        return false;
      }
      return true;
    });

    const examTasksToday = tasks.filter(
      (t) => t.type === 'Today' && examSubjects.includes(t.subject)
    );
    const completedTodayCount = examTasksToday.filter((t) => t.isCompleted).length;
    const totalTodayCount = examTasksToday.length;
    const progressPercent =
      totalTodayCount > 0
        ? Math.round((completedTodayCount / totalTodayCount) * 100)
        : 0;

    const filteredSheets = FORMULA_SHEETS.filter((sheet) => {
      const matchesExam =
        sheet.examTrack === 'BOTH' || sheet.examTrack === user.targetExam;
      const matchesClass =
        this.activeClassFilter === 'ALL' || sheet.classLevel === this.activeClassFilter;
      return matchesExam && matchesClass;
    });

    const mentorshipInfo = calculateMentorshipPrice(this.selectedMentorshipDuration);
    const upiColors: Record<'GPay' | 'PhonePe' | 'Paytm', string> = {
      GPay: '#4f46e5',
      PhonePe: '#7c3aed',
      Paytm: '#0284c7',
    };
    const qrSvg = generateUpiQrSvg(
      `${mentorshipInfo.upiUri}&app=${this.selectedUpiApp}`,
      upiColors[this.selectedUpiApp]
    );

    const daysOfWeek = [
      { day: 'Fri', date: '30', active: true },
      { day: 'Sat', date: '31', active: true },
      { day: 'Sun', date: '01', active: false },
      { day: 'Mon', date: '02', active: true },
      { day: 'Tue', date: '03', active: true },
      {
        day: 'Wed',
        date: '04',
        active: user.currentStreak >= 5 || completedTodayCount > 0,
        isToday: true,
      },
      { day: 'Thu', date: '05', active: false },
    ];

    const activeWeekObj =
      studyPlan.weeks.find((w) => w.weekNumber === this.selectedPlanWeek) ??
      studyPlan.weeks[0];

    this.containerEl.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <!-- Workspace Command & Target Switcher Bar -->
        <section aria-label="Aspirant Workspace Controls" class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div class="space-y-1">
            <p class="text-xs font-medium text-zinc-400">
              <span>Target Preparation Track</span>
              <span aria-hidden="true"> · </span>
              <span>Academic Session 2026–27</span>
              <span aria-hidden="true"> · </span>
              <span class="font-mono tabular-nums text-indigo-400">${
                user.targetExam === 'JEE' ? 'JEE Main & Advanced' : 'NEET UG Medical'
              }</span>
            </p>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Welcome back, ${this.escapeHtml(user.name)}
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- Target Exam Switcher (JEE <-> NEET) -->
            <div role="group" aria-label="Target Exam Switcher" class="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                type="button"
                data-action="switch-exam"
                data-exam="JEE"
                aria-pressed="${user.targetExam === 'JEE'}"
                class="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  user.targetExam === 'JEE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100'
                }"
              >
                JEE Main/Adv
              </button>
              <button
                type="button"
                data-action="switch-exam"
                data-exam="NEET"
                aria-pressed="${user.targetExam === 'NEET'}"
                class="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  user.targetExam === 'NEET'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100'
                }"
              >
                NEET UG
              </button>
            </div>

            <!-- Quick Search Palette Trigger -->
            <button
              type="button"
              data-action="open-command-palette"
              aria-label="Open Command Search Palette"
              class="min-h-[44px] px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 rounded-xl flex items-center gap-2.5 text-xs text-zinc-300 transition-colors whitespace-nowrap shrink-0"
            >
              <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z" />
              </svg>
              <span>Search formulas, lectures</span>
              <kbd class="font-mono text-[11px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">⌘K</kbd>
            </button>
          </div>
        </section>

        <!-- Habit & Streak Hub + Quick Launch Strip -->
        <section aria-label="Habit and Streak Hub" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <!-- 7-Day Study Streak Card -->
          <div class="lg:col-span-7 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1">
                <div class="text-xs text-zinc-400">
                  <span>Habit & Consistency Engine</span>
                  <span aria-hidden="true"> · </span>
                  <span>Auto-syncs on task completion</span>
                </div>
                <div class="flex items-baseline gap-2.5">
                  <h2 id="streak-heading" class="text-xl sm:text-2xl font-bold text-zinc-100 font-mono tabular-nums">
                    ${user.currentStreak}-Day Streak • Iron Will
                  </h2>
                </div>
              </div>
              <div class="text-left sm:text-right">
                <div class="text-xs text-zinc-400">Today's Target Velocity</div>
                <div class="text-sm font-mono tabular-nums font-semibold text-indigo-400">
                  ${completedTodayCount} / ${totalTodayCount} Completed (${progressPercent}%)
                </div>
              </div>
            </div>

            <!-- 7-Day Visual Calendar Strip -->
            <div class="grid grid-cols-7 gap-2" role="list" aria-label="7-Day Study Streak Calendar">
              ${daysOfWeek
                .map(
                  (d) => `
                <div
                  role="listitem"
                  class="rounded-xl p-2.5 text-center border transition-colors ${
                    d.active
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-zinc-100'
                      : 'bg-zinc-950/70 border-zinc-800/80 text-zinc-500'
                  } ${d.isToday ? 'ring-1 ring-indigo-400' : ''}"
                >
                  <div class="text-[11px] font-medium ${
                    d.active ? 'text-indigo-300' : 'text-zinc-500'
                  }">${d.day}</div>
                  <div class="mt-1 text-sm font-mono tabular-nums font-bold">${d.date}</div>
                  <div class="mt-1 text-[10px] font-medium ${
                    d.active ? 'text-emerald-400' : 'text-zinc-600'
                  }">
                    ${d.active ? 'Done' : d.isToday ? 'Active' : '—'}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1.5">
              <div class="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
                <div
                  class="h-full bg-indigo-500 transition-transform duration-200 origin-left"
                  style="transform: scaleX(${Math.max(0.04, progressPercent / 100)})"
                ></div>
              </div>
              <p class="text-xs text-zinc-400">
                Complete any pending target below to lock in today's streak milestone and boost your Leaderboard rank.
              </p>
            </div>
          </div>

          <!-- Interactive Portal Modules Quick-Access -->
          <div class="lg:col-span-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div class="space-y-1">
              <div class="text-xs text-zinc-400">
                <span>Active Study Environment</span>
                <span aria-hidden="true"> · </span>
                <span>Zero-Distraction Suite</span>
              </div>
              <h2 class="text-lg font-bold text-zinc-100">
                Jump into Live Class, Lecture Player, or NTA Mock Test
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
              <button
                type="button"
                data-action="goto-module"
                data-module="player"
                class="min-h-[48px] w-full px-4 py-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800/80 flex items-center justify-between text-left transition-colors group"
              >
                <div>
                  <div class="text-sm font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                    Private Lecture Player
                  </div>
                  <div class="text-xs text-zinc-400 font-mono tabular-nums">
                    Resume Rotational Mechanics @ 08:45
                  </div>
                </div>
                <span class="text-xs font-medium text-indigo-400 whitespace-nowrap shrink-0">Watch →</span>
              </button>

              <button
                type="button"
                data-action="goto-module"
                data-module="live"
                class="min-h-[48px] w-full px-4 py-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800/80 flex items-center justify-between text-left transition-colors group"
              >
                <div>
                  <div class="text-sm font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                    Live Smartboard Classroom
                  </div>
                  <div class="text-xs text-zinc-400">
                    Sumit (IITR) · Interactive Canvas & Live Polls
                  </div>
                </div>
                <span class="text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">Join Live →</span>
              </button>

              <button
                type="button"
                data-action="goto-module"
                data-module="cbt"
                class="min-h-[48px] w-full px-4 py-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800/80 flex items-center justify-between text-left transition-colors group"
              >
                <div>
                  <div class="text-sm font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                    Authentic NTA CBT Mock Test
                  </div>
                  <div class="text-xs text-zinc-400 font-mono tabular-nums">
                    180-Min Timer · +4 / -1 Marking · NAT Keypad
                  </div>
                </div>
                <span class="text-xs font-medium text-violet-400 whitespace-nowrap shrink-0">Start Test →</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Dual Task & Backlog Manager + 1:1 Mentorship Pass Column -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Left 8 Cols: Dual Task & Backlog Manager -->
          <div class="lg:col-span-8 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              <div>
                <div class="text-xs text-zinc-400">
                  <span>Dual Execution Planner</span>
                  <span aria-hidden="true"> · </span>
                  <span>${user.targetExam} Syllabus</span>
                </div>
                <h2 class="text-xl font-bold text-zinc-100">Task & Backlog Clearance Engine</h2>
              </div>

              <!-- Dual Tab Switcher: Today vs Backlog -->
              <div role="tablist" aria-label="Task Manager Views" class="inline-flex p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTaskTab === 'Today'}"
                  data-action="switch-task-tab"
                  data-tab="Today"
                  class="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    this.activeTaskTab === 'Today'
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }"
                >
                  Today's High-Yield Targets
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected="${this.activeTaskTab === 'Backlog'}"
                  data-action="switch-task-tab"
                  data-tab="Backlog"
                  class="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    this.activeTaskTab === 'Backlog'
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }"
                >
                  Backlog Clearance Engine
                </button>
              </div>
            </div>

            <!-- Inline Task Creation Form -->
            <form id="create-task-form" class="flex flex-col sm:flex-row gap-2.5" aria-label="Create Study Target">
              <label for="new-task-title" class="sr-only">Study Target Title</label>
              <input
                id="new-task-title"
                name="title"
                type="text"
                required
                maxlength="200"
                placeholder="${
                  this.activeTaskTab === 'Today'
                    ? 'Add high-yield target (e.g., Solve 30 Electrostatics PYQs)...'
                    : 'Add chapter backlog to clear (e.g., Ionic Equilibrium Buffer Solutions)...'
                }"
                class="flex-1 min-h-[44px] px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <div class="flex gap-2">
                <label for="new-task-subject" class="sr-only">Subject</label>
                <select
                  id="new-task-subject"
                  name="subject"
                  aria-label="Select Task Subject"
                  class="min-h-[44px] px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  ${examSubjects
                    .map((sub) => `<option value="${sub}">${sub}</option>`)
                    .join('')}
                </select>
                <button
                  type="submit"
                  class="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Add to ${this.activeTaskTab}
                </button>
              </div>
            </form>

            <!-- Interactive Subject Filter Bar -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Filter tasks by subject" class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-action="filter-subject"
                  data-subject="ALL"
                  class="min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    this.activeSubjectFilter === 'ALL'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }"
                >
                  All Subjects
                </button>
                ${examSubjects
                  .map(
                    (sub) => `
                  <button
                    type="button"
                    data-action="filter-subject"
                    data-subject="${sub}"
                    class="min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      this.activeSubjectFilter === sub
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }"
                  >
                    ${sub}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <span class="text-xs text-zinc-400 font-mono tabular-nums">
                Showing ${filteredTasks.length} ${filteredTasks.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <!-- Task List Items -->
            <div class="divide-y divide-zinc-800/80 border-t border-zinc-800/80" role="list" aria-label="${this.activeTaskTab} Tasks">
              ${
                filteredTasks.length === 0
                  ? `
                <div class="py-8 text-center space-y-2">
                  <p class="text-sm font-medium text-zinc-300">No ${this.activeTaskTab.toLowerCase()} targets matching this filter.</p>
                  <p class="text-xs text-zinc-500">Use the input bar above to schedule your next high-yield problem set.</p>
                </div>
              `
                  : filteredTasks
                      .map(
                        (task) => `
                  <div role="listitem" class="py-3.5 flex items-center justify-between gap-3 group">
                    <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        data-action="toggle-task"
                        data-task-id="${task.taskId}"
                        ${task.isCompleted ? 'checked' : ''}
                        aria-label="Mark '${this.escapeHtml(task.title)}' as completed"
                        class="mt-0.5 w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium transition-colors ${
                          task.isCompleted
                            ? 'line-through text-zinc-500'
                            : 'text-zinc-100'
                        }">
                          ${this.escapeHtml(task.title)}
                        </p>
                        <div class="mt-0.5 text-xs text-zinc-400">
                          <span>${task.subject}</span>
                          <span aria-hidden="true"> · </span>
                          <span>${task.type === 'Today' ? 'High-Yield Target' : 'Backlog Sprint'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>${task.isCompleted ? 'Completed' : 'Pending'}</span>
                        </div>
                      </div>
                    </label>
                    <button
                      type="button"
                      data-action="delete-task"
                      data-task-id="${task.taskId}"
                      aria-label="Delete task '${this.escapeHtml(task.title)}'"
                      class="min-h-[38px] min-w-[38px] p-2 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors shrink-0"
                    >
                      <svg class="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                `
                      )
                      .join('')
              }
            </div>
          </div>

          <!-- Right 4 Cols: 1:1 Mentorship Pass Booking Card -->
          <aside aria-label="1:1 Mentorship Booking" class="lg:col-span-4 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            <div class="flex items-center gap-3.5">
              <div class="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                <img
                  src="${MENTOR_AVATAR_PATH}"
                  alt="Mentor Sumit Portrait"
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover"
                />
              </div>
              <div>
                <div class="text-xs text-indigo-400 font-medium">
                  <span>1:1 Mentorship Pass</span>
                  <span aria-hidden="true"> · </span>
                  <span>IITian Guidance</span>
                </div>
                <h2 class="text-lg font-bold text-zinc-100">Book Strategy Session with Sumit</h2>
                <p class="text-xs text-zinc-400">Personal backlog audit, mock test dissection & rank roadmap</p>
              </div>
            </div>

            <!-- Duration Slider & Tier Selector -->
            <div class="space-y-3 pt-2 border-t border-zinc-800/80">
              <div class="flex items-center justify-between">
                <label for="dashboard-duration-slider" class="text-xs font-medium text-zinc-300">
                  Session Duration: <span class="font-mono tabular-nums font-bold text-zinc-100">${mentorshipInfo.durationMinutes} mins</span>
                </label>
                <span class="text-base font-mono tabular-nums font-bold text-indigo-400">
                  ₹${mentorshipInfo.priceInr}
                </span>
              </div>

              <input
                id="dashboard-duration-slider"
                type="range"
                min="15"
                max="45"
                step="15"
                value="${mentorshipInfo.durationMinutes}"
                aria-label="Mentorship session duration in minutes"
                class="w-full accent-indigo-500 cursor-pointer"
              />

              <div class="grid grid-cols-3 gap-2">
                ${[
                  { mins: 15, price: 75, label: '15m · ₹75' },
                  { mins: 30, price: 150, label: '30m · ₹150' },
                  { mins: 45, price: 225, label: '45m · ₹225' },
                ]
                  .map(
                    (tier) => `
                  <button
                    type="button"
                    data-action="select-mentorship-tier"
                    data-mins="${tier.mins}"
                    class="min-h-[40px] px-2 py-1.5 rounded-xl border text-xs font-mono tabular-nums font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      mentorshipInfo.durationMinutes === tier.mins
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }"
                  >
                    ${tier.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="text-xs text-zinc-400 space-y-1">
              <div>Plan: <span class="text-zinc-200 font-medium">${mentorshipInfo.tierName}</span></div>
              <div>Includes custom 14-day study timetable & WhatsApp doubt follow-up.</div>
            </div>

            <button
              type="button"
              data-action="open-mentorship-drawer"
              class="w-full min-h-[44px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Proceed to Instant UPI Checkout (₹${mentorshipInfo.priceInr})
            </button>
          </aside>
        </section>

        <!-- Personalized Study Plan Generator & Gamified Top 10 Leaderboard -->
        <section aria-label="Personalized Study Plan and Leaderboard" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-zinc-800/80">
          <!-- Left 7 Cols: Personalized Study Plan Generator -->
          <div class="lg:col-span-7 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-800/80">
              <div>
                <div class="text-xs text-zinc-400">
                  <span>Adaptive Schedule Engine</span>
                  <span aria-hidden="true"> · </span>
                  <span>Stored under Firestore User Profile</span>
                </div>
                <h2 class="text-xl font-bold text-zinc-100">Personalized 4-Week Study Plan Generator</h2>
              </div>
              <span class="text-xs font-mono tabular-nums text-indigo-400">
                ${studyPlan.dailyHours}h/day · ${studyPlan.dailyHours * 7}h/week
              </span>
            </div>

            <!-- Configuration Controls: Target Exam, Daily Hours, and Subject Understanding -->
            <div class="space-y-4 bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="space-y-1 flex-1">
                  <div class="flex items-center justify-between">
                    <label for="study-plan-hours-slider" class="text-xs font-semibold text-zinc-200">
                      Preferred Daily Study Duration
                    </label>
                    <span class="text-xs font-mono tabular-nums font-bold text-indigo-400">
                      ${this.planDailyHours} Hours / Day (${this.planDailyHours * 7} hrs/wk)
                    </span>
                  </div>
                  <input
                    id="study-plan-hours-slider"
                    type="range"
                    min="3"
                    max="14"
                    step="1"
                    value="${this.planDailyHours}"
                    aria-label="Preferred daily study hours"
                    class="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <!-- Subject Understanding Level Selectors -->
              <div class="space-y-2.5 pt-2 border-t border-zinc-800/70">
                <div class="text-xs font-semibold text-zinc-300">
                  Current Subject Understanding (Weak subjects receive 50% higher weekly hour weightage)
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${examSubjects
                    .map((sub) => {
                      const currentProf = this.planProficiency[sub] ?? 'Moderate';
                      return `
                      <div class="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-zinc-100">${sub}</span>
                          <span class="text-[11px] font-mono ${
                            currentProf === 'Weak'
                              ? 'text-rose-400'
                              : currentProf === 'Moderate'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }">${currentProf}</span>
                        </div>
                        <div role="group" aria-label="${sub} understanding level" class="grid grid-cols-3 gap-1">
                          ${(['Weak', 'Moderate', 'Strong'] as const)
                            .map(
                              (lvl) => `
                            <button
                              type="button"
                              data-action="set-proficiency"
                              data-subject="${sub}"
                              data-level="${lvl}"
                              aria-pressed="${currentProf === lvl}"
                              class="min-h-[32px] px-1.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                                currentProf === lvl
                                  ? lvl === 'Weak'
                                    ? 'bg-rose-600 text-white'
                                    : lvl === 'Moderate'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-600 text-white'
                                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                              }"
                            >
                              ${lvl}
                            </button>
                          `
                            )
                            .join('')}
                        </div>
                      </div>
                    `;
                    })
                    .join('')}
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 pt-2">
                <p class="text-xs text-zinc-400">
                  Target Track: <span class="text-zinc-200 font-semibold">${user.targetExam}</span>
                </p>
                <button
                  type="button"
                  data-action="generate-study-plan"
                  class="min-h-[42px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Generate & Save 4-Week Schedule
                </button>
              </div>
            </div>

            <!-- Week-by-Week Schedule Selector Tabs -->
            <div class="space-y-4">
              <div role="tablist" aria-label="Study Plan Weeks" class="grid grid-cols-4 gap-2">
                ${studyPlan.weeks
                  .map(
                    (wk) => `
                  <button
                    type="button"
                    role="tab"
                    aria-selected="${activeWeekObj.weekNumber === wk.weekNumber}"
                    data-action="select-plan-week"
                    data-week="${wk.weekNumber}"
                    class="min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeWeekObj.weekNumber === wk.weekNumber
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }"
                  >
                    Week 0${wk.weekNumber}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <!-- Active Week Schedule Details -->
              <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                  <div>
                    <h3 class="text-sm font-bold text-zinc-100">${this.escapeHtml(activeWeekObj.theme)}</h3>
                    <p class="text-xs text-zinc-400 mt-0.5">
                      Milestone: <span class="text-zinc-200">${this.escapeHtml(activeWeekObj.practiceTestGoal)}</span>
                    </p>
                  </div>
                  <span class="text-xs font-mono tabular-nums text-indigo-400 shrink-0">
                    ${activeWeekObj.totalWeeklyHours} hrs total
                  </span>
                </div>

                <div class="space-y-3" role="list" aria-label="Week ${activeWeekObj.weekNumber} Subject Allocations">
                  ${activeWeekObj.allocations
                    .map(
                      (item) => `
                    <div role="listitem" class="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div class="space-y-1">
                        <div class="text-xs text-zinc-400">
                          <span class="font-bold text-zinc-100">${item.subject}</span>
                          <span aria-hidden="true"> · </span>
                          <span class="${
                            item.proficiency === 'Weak'
                              ? 'text-rose-400 font-semibold'
                              : item.proficiency === 'Moderate'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }">Priority: ${item.proficiency}</span>
                          <span aria-hidden="true"> · </span>
                          <span class="font-mono tabular-nums text-indigo-300 font-semibold">${item.allocatedHoursPerWeek} hrs/week</span>
                        </div>
                        <p class="text-xs text-zinc-300">
                          Focus: ${this.escapeHtml(item.focusTopics)}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-action="goto-module"
                        data-module="${item.recommendedModule}"
                        class="min-h-[38px] px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        ${this.escapeHtml(item.moduleActionLabel)} →
                      </button>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Right 5 Cols: Gamified Top 10 Leaderboard -->
          <div class="lg:col-span-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            <div class="flex items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
              <div>
                <div class="text-xs text-zinc-400">
                  <span>All-India Cohort Standings</span>
                  <span aria-hidden="true"> · </span>
                  <span>Live Firebase Sync</span>
                </div>
                <h2 class="text-xl font-bold text-zinc-100">Top 10 Aspirant Leaderboard</h2>
              </div>
              <div class="text-right">
                <div class="text-[11px] text-zinc-400">Your Standing</div>
                <div id="user-leaderboard-rank" class="text-base font-mono tabular-nums font-bold text-indigo-400">
                  Rank #${leaderboardStandings.currentUserRank} of ${leaderboardStandings.totalParticipants}
                </div>
              </div>
            </div>

            <!-- Current User Relative Standing Callout -->
            ${
              leaderboardStandings.currentUserEntry
                ? `
              <div class="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs font-semibold text-indigo-200">
                    ${this.escapeHtml(leaderboardStandings.currentUserEntry.name)} (You · Rank #${leaderboardStandings.currentUserRank})
                  </div>
                  <div class="text-[11px] text-zinc-300 font-mono tabular-nums mt-0.5">
                    Tasks: ${leaderboardStandings.currentUserEntry.taskCompletionRate}% · Best Mock: ${leaderboardStandings.currentUserEntry.bestMockScore} pts · Streak: ${leaderboardStandings.currentUserEntry.currentStreak}d
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-mono tabular-nums font-bold text-indigo-300">
                    ${leaderboardStandings.currentUserEntry.compositePoints} XP
                  </div>
                  <div class="text-[10px] text-zinc-400">Composite Score</div>
                </div>
              </div>
            `
                : ''
            }

            <!-- Top 10 Leaderboard Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse" aria-label="Top 10 Aspirants Leaderboard">
                <thead>
                  <tr class="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400">
                    <th class="py-2 pr-2">Rank</th>
                    <th class="py-2 px-2">Aspirant</th>
                    <th class="py-2 px-2 text-right">Tasks</th>
                    <th class="py-2 px-2 text-right">Mock</th>
                    <th class="py-2 pl-2 text-right">XP Score</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/70 text-xs">
                  ${leaderboardStandings.top10
                    .map((entry) => {
                      const isCurrentUser = entry.uid === user.uid;
                      return `
                      <tr class="${
                        isCurrentUser ? 'bg-indigo-950/30 text-zinc-100 font-semibold' : 'text-zinc-300'
                      }">
                        <td class="py-2.5 pr-2 font-mono tabular-nums font-bold ${
                          entry.rank === 1
                            ? 'text-amber-400'
                            : entry.rank === 2
                              ? 'text-zinc-200'
                              : entry.rank === 3
                                ? 'text-amber-600'
                                : 'text-zinc-400'
                        }">
                          #${entry.rank}
                        </td>
                        <td class="py-2.5 px-2">
                          <div class="truncate max-w-[140px]">
                            ${this.escapeHtml(entry.name)}${isCurrentUser ? ' (You)' : ''}
                          </div>
                          <div class="text-[10px] text-zinc-500">
                            ${entry.targetExam} · ${entry.currentStreak}d streak
                          </div>
                        </td>
                        <td class="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          ${entry.taskCompletionRate}%
                        </td>
                        <td class="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          ${entry.bestMockScore}
                        </td>
                        <td class="py-2.5 pl-2 text-right font-mono tabular-nums font-bold text-indigo-400">
                          ${entry.compositePoints}
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>

            <p class="text-[11px] text-zinc-400 leading-relaxed">
              Ranking Formula: <span class="font-mono text-zinc-300">(Task Rate × 12) + (Mock Score × 15) + (Streak × 40)</span>. Complete daily tasks or submit a CBT mock test to climb the Top 10!
            </p>
          </div>
        </section>

        <!-- Formula Sheets & PDF Repository -->
        <section aria-label="Formula Sheets and PDF Repository" class="space-y-5 pt-4 border-t border-zinc-800/80">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="text-xs text-zinc-400">
                <span>Condensed Revision Vault</span>
                <span aria-hidden="true"> · </span>
                <span>Class 11 & Class 12</span>
              </div>
              <h2 class="text-xl font-bold text-zinc-100">Formula Sheets & High-Yield PDF Repository</h2>
            </div>

            <div role="group" aria-label="Filter Formula Sheets by Class" class="inline-flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              ${(['ALL', 'Class 11', 'Class 12'] as const)
                .map(
                  (cls) => `
                <button
                  type="button"
                  data-action="filter-class"
                  data-class="${cls}"
                  class="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    this.activeClassFilter === cls
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }"
                >
                  ${cls === 'ALL' ? 'All Classes' : cls}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            ${filteredSheets
              .map(
                (sheet) => `
              <article class="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div class="space-y-2">
                  <div class="text-xs text-zinc-400">
                    <span class="text-indigo-400 font-medium">${sheet.subject}</span>
                    <span aria-hidden="true"> · </span>
                    <span>${sheet.classLevel}</span>
                    <span aria-hidden="true"> · </span>
                    <span class="font-mono tabular-nums">${sheet.pageCount} Pages</span>
                  </div>
                  <h3 class="text-base font-bold text-zinc-100 leading-snug">
                    ${this.escapeHtml(sheet.title)}
                  </h3>
                  <div class="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 font-mono text-xs text-zinc-300 overflow-x-auto">
                    ${this.escapeHtml(sheet.highYieldFormulas[0].equation)}
                  </div>
                </div>

                <div class="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    data-action="inspect-sheet"
                    data-sheet-id="${sheet.id}"
                    class="flex-1 min-h-[42px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                  >
                    Preview Formulas
                  </button>
                  <button
                    type="button"
                    data-action="download-sheet"
                    data-sheet-id="${sheet.id}"
                    aria-label="Download ${this.escapeHtml(sheet.title)} PDF Sheet"
                    class="min-h-[42px] px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Download
                  </button>
                </div>
              </article>
            `
              )
              .join('')}
          </div>
        </section>
      </div>

      <!-- Slide-Out 1:1 Mentorship Checkout Drawer -->
      ${
        this.isMentorshipDrawerOpen
          ? `
        <div class="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="mentorship-drawer-title">
          <div class="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 flex flex-col justify-between gap-6">
            <div class="space-y-5">
              <div class="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div>
                  <div class="text-xs text-indigo-400 font-medium">Instant UPI Pass</div>
                  <h2 id="mentorship-drawer-title" class="text-lg font-bold text-zinc-100">1:1 Mentorship Checkout</h2>
                </div>
                <button
                  type="button"
                  data-action="close-mentorship-drawer"
                  aria-label="Close Mentorship Checkout Drawer"
                  class="min-h-[40px] min-w-[40px] rounded-xl bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <!-- Duration Selector inside Drawer -->
              <div class="space-y-2">
                <label class="text-xs font-medium text-zinc-300">Select Mentorship Duration Tier</label>
                <div class="grid grid-cols-3 gap-2">
                  ${[
                    { mins: 15, price: 75, title: 'Rapid Audit' },
                    { mins: 30, price: 150, title: 'Deep Sprint' },
                    { mins: 45, price: 225, title: 'Full Roadmap' },
                  ]
                    .map(
                      (t) => `
                    <button
                      type="button"
                      data-action="select-mentorship-tier"
                      data-mins="${t.mins}"
                      class="p-2.5 rounded-xl border text-left transition-colors ${
                        mentorshipInfo.durationMinutes === t.mins
                          ? 'bg-indigo-600/20 border-indigo-500 text-zinc-100'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }"
                    >
                      <div class="text-xs font-mono tabular-nums font-bold">${t.mins} Mins</div>
                      <div class="text-sm font-mono tabular-nums font-bold text-indigo-400">₹${t.price}</div>
                      <div class="text-[11px] text-zinc-400 truncate">${t.title}</div>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <!-- UPI App Selector -->
              <div class="space-y-2">
                <label class="text-xs font-medium text-zinc-300">Preferred UPI Provider</label>
                <div class="grid grid-cols-3 gap-2">
                  ${(['GPay', 'PhonePe', 'Paytm'] as const)
                    .map(
                      (provider) => `
                    <button
                      type="button"
                      data-action="select-upi-app"
                      data-provider="${provider}"
                      class="min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                        this.selectedUpiApp === provider
                          ? 'bg-zinc-800 border-indigo-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }"
                    >
                      ${provider === 'GPay' ? 'Google Pay' : provider}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <!-- Dynamic UPI QR Code Card -->
              <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
                <div class="text-xs text-zinc-400">
                  <span>Scan with ${
                    this.selectedUpiApp === 'GPay' ? 'Google Pay' : this.selectedUpiApp
                  }</span>
                  <span aria-hidden="true"> · </span>
                  <span class="font-mono tabular-nums text-zinc-200">₹${mentorshipInfo.priceInr}.00</span>
                </div>
                ${qrSvg}
                <div class="text-xs font-mono text-zinc-400 select-all">
                  UPI ID: sumit.prepskm@okaxis
                </div>
              </div>
            </div>

            <div class="space-y-2.5 pt-4 border-t border-zinc-800">
              <a
                href="${mentorshipInfo.whatsappUrl}"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <span>Confirm Slot on WhatsApp (${mentorshipInfo.durationMinutes}m @ ₹${mentorshipInfo.priceInr})</span>
              </a>
              <button
                type="button"
                data-action="simulate-upi-verified"
                class="w-full min-h-[42px] py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors"
              >
                I Have Completed UPI Payment
              </button>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <!-- Formula Sheet Preview Modal -->
      ${
        this.inspectedFormulaSheet
          ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="formula-modal-title">
          <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div class="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <div class="text-xs text-indigo-400">
                  <span>${this.inspectedFormulaSheet.subject}</span>
                  <span aria-hidden="true"> · </span>
                  <span>${this.inspectedFormulaSheet.classLevel}</span>
                  <span aria-hidden="true"> · </span>
                  <span>${this.inspectedFormulaSheet.chapter}</span>
                </div>
                <h2 id="formula-modal-title" class="text-xl font-bold text-zinc-100 mt-1">
                  ${this.escapeHtml(this.inspectedFormulaSheet.title)}
                </h2>
              </div>
              <button
                type="button"
                data-action="close-formula-modal"
                aria-label="Close Formula Preview"
                class="min-h-[40px] min-w-[40px] rounded-xl bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div class="space-y-4">
              ${this.inspectedFormulaSheet.highYieldFormulas
                .map(
                  (item, index) => `
                <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold text-zinc-100">
                      0${index + 1}. ${this.escapeHtml(item.label)}
                    </h3>
                  </div>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-sm text-indigo-300">
                    ${this.escapeHtml(item.equation)}
                  </div>
                  <p class="text-xs text-zinc-400 leading-relaxed">
                    ${this.escapeHtml(item.note)}
                  </p>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                data-action="download-sheet"
                data-sheet-id="${this.inspectedFormulaSheet.id}"
                class="min-h-[42px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Download Complete ${this.inspectedFormulaSheet.pageCount}-Page Sheet
              </button>
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

    // Form submit for creating task
    const form = this.containerEl.querySelector<HTMLFormElement>('#create-task-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = form.querySelector<HTMLInputElement>('#new-task-title');
      const subjectSelect = form.querySelector<HTMLSelectElement>('#new-task-subject');
      const title = titleInput?.value.trim() ?? '';
      const subject = (subjectSelect?.value as SubjectName) || 'Physics';
      if (!title) return;

      await dataStore.addTask(title, subject, this.activeTaskTab);
      if (titleInput) titleInput.value = '';
      this.callbacks.onShowToast(`Added "${title}" to ${this.activeTaskTab}`);
      this.rerender();
    });

    // Range slider for mentorship duration
    const slider = this.containerEl.querySelector<HTMLInputElement>(
      '#dashboard-duration-slider'
    );
    slider?.addEventListener('input', () => {
      this.selectedMentorshipDuration = Number(slider.value);
      this.rerender();
    });

    // Range slider for study plan daily hours
    const planHoursSlider = this.containerEl.querySelector<HTMLInputElement>(
      '#study-plan-hours-slider'
    );
    planHoursSlider?.addEventListener('input', () => {
      this.planDailyHours = Number(planHoursSlider.value);
      this.rerender();
    });

    // Click delegation
    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      if (action === 'toggle-task') {
        el.addEventListener('change', async () => {
          const taskId = el.dataset.taskId;
          if (!taskId) return;
          const updated = await dataStore.toggleTaskCompletion(taskId);
          if (updated?.isCompleted) {
            const user = dataStore.getUser();
            const todayIso = '2026-11-04';
            const streakUpdate = computeUpdatedStreak(
              user.currentStreak,
              user.lastActiveDate,
              todayIso
            );
            if (streakUpdate.incremented) {
              await dataStore.updateUser({
                currentStreak: streakUpdate.currentStreak,
                lastActiveDate: streakUpdate.lastActiveDate,
              });
              this.callbacks.onShowToast(
                `Streak incremented to ${streakUpdate.currentStreak} Days • Leaderboard XP updated!`
              );
            } else {
              this.callbacks.onShowToast('Target marked complete & Leaderboard updated!');
            }
          }
          this.rerender();
        });
        return;
      }

      el.addEventListener('click', async () => {
        switch (action) {
          case 'switch-exam': {
            const exam = el.dataset.exam as 'JEE' | 'NEET';
            if (exam) {
              await dataStore.updateUser({ targetExam: exam });
              await dataStore.generateAndSaveStudyPlan({
                targetExam: exam,
                dailyHours: this.planDailyHours,
                proficiency: this.planProficiency,
              });
              this.callbacks.onShowToast(`Switched target track & study plan to ${exam}`);
              this.rerender();
            }
            break;
          }
          case 'set-proficiency': {
            const sub = el.dataset.subject as SubjectName;
            const lvl = el.dataset.level as ProficiencyLevel;
            if (sub && lvl) {
              this.planProficiency[sub] = lvl;
              this.rerender();
            }
            break;
          }
          case 'generate-study-plan': {
            const user = dataStore.getUser();
            await dataStore.generateAndSaveStudyPlan({
              targetExam: user.targetExam,
              dailyHours: this.planDailyHours,
              proficiency: this.planProficiency,
            });
            this.selectedPlanWeek = 1;
            this.callbacks.onShowToast(
              `Generated 4-Week ${user.targetExam} Schedule (${this.planDailyHours}h/day) & saved to profile!`
            );
            this.rerender();
            break;
          }
          case 'select-plan-week': {
            const wk = Number(el.dataset.week);
            if (wk >= 1 && wk <= 4) {
              this.selectedPlanWeek = wk;
              this.rerender();
            }
            break;
          }
          case 'open-command-palette': {
            window.dispatchEvent(new CustomEvent('prepskm:open-search'));
            break;
          }
          case 'goto-module': {
            const mod = el.dataset.module as ModuleId;
            if (mod) this.callbacks.onNavigateModule(mod);
            break;
          }
          case 'switch-task-tab': {
            const tab = el.dataset.tab as TaskBucket;
            if (tab) {
              this.activeTaskTab = tab;
              this.rerender();
            }
            break;
          }
          case 'filter-subject': {
            const sub = el.dataset.subject as 'ALL' | SubjectName;
            if (sub) {
              this.activeSubjectFilter = sub;
              this.rerender();
            }
            break;
          }
          case 'delete-task': {
            const taskId = el.dataset.taskId;
            if (taskId) {
              await dataStore.deleteTask(taskId);
              this.callbacks.onShowToast('Task removed');
              this.rerender();
            }
            break;
          }
          case 'select-mentorship-tier': {
            const mins = Number(el.dataset.mins);
            if (mins) {
              this.selectedMentorshipDuration = mins;
              this.rerender();
            }
            break;
          }
          case 'open-mentorship-drawer': {
            this.isMentorshipDrawerOpen = true;
            this.rerender();
            break;
          }
          case 'close-mentorship-drawer': {
            this.isMentorshipDrawerOpen = false;
            this.rerender();
            break;
          }
          case 'select-upi-app': {
            const provider = el.dataset.provider as 'GPay' | 'PhonePe' | 'Paytm';
            if (provider) {
              this.selectedUpiApp = provider;
              this.rerender();
            }
            break;
          }
          case 'simulate-upi-verified': {
            this.isMentorshipDrawerOpen = false;
            this.callbacks.onShowToast(
              `1:1 Mentorship Pass (${this.selectedMentorshipDuration}m) confirmed! Check WhatsApp for slot link.`
            );
            this.rerender();
            break;
          }
          case 'filter-class': {
            const cls = el.dataset.class as 'ALL' | 'Class 11' | 'Class 12';
            if (cls) {
              this.activeClassFilter = cls;
              this.rerender();
            }
            break;
          }
          case 'inspect-sheet': {
            const sheetId = el.dataset.sheetId;
            const found = FORMULA_SHEETS.find((s) => s.id === sheetId) ?? null;
            this.inspectedFormulaSheet = found;
            this.rerender();
            break;
          }
          case 'close-formula-modal': {
            this.inspectedFormulaSheet = null;
            this.rerender();
            break;
          }
          case 'download-sheet': {
            const sheetId = el.dataset.sheetId;
            const found = FORMULA_SHEETS.find((s) => s.id === sheetId);
            if (found) {
              downloadFormulaSheetFile(found);
              this.callbacks.onShowToast(`Downloaded "${found.title}" formula sheet`);
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
