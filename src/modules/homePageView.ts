import {
  getCohortTheme,
  SYLLABUS_TOPICS,
  WEEK_DAYS,
  XP_PER_COMPLETED_TASK,
} from '../constants';
import { dataStore } from '../services/firebaseService';
import { workspaceConnector } from '../services/workspaceService';
import type {
  PageId,
  ProficiencyLevel,
  StreakCalendarDay,
  SubjectName,
  TaskPriority,
} from '../types';
import {
  buildStreakCalendarStrip,
  calculateBacklogKillerPlan,
  calculateDailyGoalProgress,
  computeStreakMicroAnimationState,
  computeUpdatedStreak,
  getCurrentWeekKey,
  getSubjectsForExam,
} from '../utils/examLogic';
import {
  renderD3StreakProgressionWidget,
  renderD3SubjectAccuracyChart,
} from './d3Visualizations';

export interface HomePageCallbacks {
  onNavigatePage: (page: PageId) => void;
  onShowToast: (message: string) => void;
}

export class HomePageModule {
  private containerEl: HTMLElement | null = null;
  private callbacks: HomePageCallbacks;
  private selectedDay: string = 'Mon';
  private selectedCalendarDateIso: string = '2026-11-04';
  private selectedSubjectFilter: SubjectName | 'ALL' = 'ALL';
  private selectedSyllabusSubject: SubjectName | 'ALL' = 'ALL';
  private isSyllabusTasksModalOpen = false;
  private isSyncingSyllabusTasks = false;
  private lastSyncedSyllabusTitles: string[] = [];

  // Streak Widget micro-animation state
  private streakCelebrationActive = false;
  private streakJustIncremented = false;
  private lastCompletedTaskTitle = '';

  private newTaskPriority: TaskPriority = 'High';
  private backlogSubject: SubjectName = 'Physics';
  private backlogChapter = 'Rotational Mechanics & IAOR';
  private backlogHours = 9;
  private backlogDays = 6;
  private unsubscribeStreakNotifs: (() => void) | null = null;

  // Personalized Study Plan Generator state
  private planDailyHours = 6;
  private planProficiency: Record<SubjectName, ProficiencyLevel> = {
    Physics: 'Weak',
    Chemistry: 'Moderate',
    Math: 'Strong',
    Biology: 'Moderate',
  };
  private selectedPlanWeek = 1;

  constructor(callbacks: HomePageCallbacks) {
    this.callbacks = callbacks;
    const existingPlan = dataStore.getStudyPlan();
    this.planDailyHours = existingPlan.dailyHours || 6;
    this.planProficiency = {
      Physics: existingPlan.proficiency.Physics ?? 'Weak',
      Chemistry: existingPlan.proficiency.Chemistry ?? 'Moderate',
      Math: existingPlan.proficiency.Math ?? 'Strong',
      Biology: existingPlan.proficiency.Biology ?? 'Moderate',
    };
  }

  public mount(container: HTMLElement): void {
    this.containerEl = container;
    if (this.unsubscribeStreakNotifs) {
      this.unsubscribeStreakNotifs();
    }
    this.unsubscribeStreakNotifs = dataStore.onStreakNotificationChange((notifs) => {
      if (this.containerEl && notifs.length > 0) {
        this.rerender();
      }
    });
    this.rerender();
  }

  private renderLucideStreakIcon(
    iconName: StreakCalendarDay['lucideIcon'],
    isToday: boolean
  ): string {
    switch (iconName) {
      case 'Flame':
      case 'flame':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 ${isToday ? 'text-orange-500 fill-amber-400/40' : 'text-orange-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
      case 'Zap':
      case 'zap':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 fill-indigo-200/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      case 'CheckCircle2':
      case 'check-circle-2':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
      case 'CircleDot':
      case 'circle-dot':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
      default:
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
    }
  }

  private async triggerTaskCompletionCelebration(
    taskTitle: string,
    streakIncremented: boolean
  ): Promise<void> {
    this.streakCelebrationActive = true;
    this.streakJustIncremented = streakIncremented;
    this.lastCompletedTaskTitle = taskTitle;
    const user = dataStore.getUser();
    window.dispatchEvent(
      new CustomEvent('prepskm:streak-celebrate', {
        detail: {
          streak: user.currentStreak,
          xpPoints: user.xpPoints ?? 0,
          taskTitle,
        },
      })
    );
  }

  public rerender(): void {
    if (!this.containerEl) return;
    const user = dataStore.getUser();
    const subjects = getSubjectsForExam(user.targetExam);
    if (!subjects.includes(this.backlogSubject)) {
      this.backlogSubject = subjects[0];
    }

    const mentors = dataStore.getMentors();
    const allTasks = dataStore.getTasks().filter((t) => subjects.includes(t.subject));
    const dailyGoalTarget = dataStore.getDailyGoalTarget();
    const radius = 36;
    const goalProgress = calculateDailyGoalProgress(allTasks, dailyGoalTarget, radius);

    const todayIso = user.lastActiveDate || '2026-11-04';
    const streakDays = buildStreakCalendarStrip(
      user.currentStreak,
      todayIso,
      goalProgress.completedTasks > 0
    );
    const activeCalendarDay =
      streakDays.find((d) => d.dateIso === this.selectedCalendarDateIso) ??
      streakDays[streakDays.length - 1];
    const calendarDayTasks = allTasks.filter(
      (t) =>
        t.dateIso === activeCalendarDay.dateIso ||
        (!t.dateIso && (t.dayOfWeek ?? 'Mon') === activeCalendarDay.dayShort)
    );

    const filteredTasks = allTasks.filter((t) => {
      if ((t.dayOfWeek ?? 'Mon') !== this.selectedDay) {
        return false;
      }
      if (
        this.selectedSubjectFilter !== 'ALL' &&
        t.subject !== this.selectedSubjectFilter
      ) {
        return false;
      }
      return true;
    });

    const latestCompletedTask =
      allTasks.find((t) => t.isCompleted) ?? filteredTasks.find((t) => t.isCompleted);
    const streakAnimState = computeStreakMicroAnimationState({
      completedTodayCount: goalProgress.completedTasks,
      dailyGoalTarget,
      currentStreak: user.currentStreak,
      streakIncremented: this.streakJustIncremented,
      taskTitle: this.lastCompletedTaskTitle || latestCompletedTask?.title || 'Daily Study Block',
    });

    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const studyPlan = dataStore.getStudyPlan();
    const activeWeekObj =
      studyPlan.weeks.find((w) => w.weekNumber === this.selectedPlanWeek) ??
      studyPlan.weeks[0];
    const leaderboardStandings = dataStore.getLeaderboardStandings();
    const currentWeekKey = getCurrentWeekKey();

    // Syllabus Progress Tracker Data
    const syllabusProgress = dataStore.getSyllabusProgressSummary(user.targetExam);
    const completedTopicSet = new Set(dataStore.getCompletedSyllabusTopics());
    const examSyllabusTopics = dataStore
      .getSyllabusTopics(user.targetExam)
      .filter(
        (t) =>
          subjects.includes(t.subject) &&
          (this.selectedSyllabusSubject === 'ALL' ||
            t.subject === this.selectedSyllabusSubject)
      );
    const rankAndLevel = dataStore.getStudentRankAndMonthlyLevel();

    this.containerEl.innerHTML = `
      <div class="space-y-6">
        <!-- LUMINOUS DAYLIGHT PRISM HERO DECK -->
        <section
          aria-label="Active Class and Exam Cohort Workspace Banner"
          data-testid="cohort-unique-banner"
          class="obsidian-widget-card px-5 py-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden"
        >
          <div class="space-y-2.5 max-w-2xl relative z-10">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider shadow-xs">
                <span>● ${this.escapeHtml(cohortTheme.badgeText)}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono-tabular font-extrabold">
                <span>🔥 ${user.currentStreak}d Streak</span>
                <span>·</span>
                <span>⚡ ${user.xpPoints ?? 0} XP</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono-tabular font-extrabold">
                Rank #${rankAndLevel.currentUserRank} · Lv.${rankAndLevel.level}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              ${this.escapeHtml(cohortTheme.headline)}
            </h1>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
              ${this.escapeHtml(cohortTheme.subheadline)}
            </p>
          </div>

          <div class="grid grid-cols-2 sm:flex sm:flex-row lg:flex-col gap-2.5 shrink-0 relative z-10">
            <button
              type="button"
              data-action="nav-page"
              data-page="mentorship"
              class="min-h-[42px] px-4 py-2.5 rounded-xl vermilion-cta-btn text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Video Batches &amp; Lectures</span>
              <span>→</span>
            </button>
            <button
              type="button"
              data-action="nav-page"
              data-page="test"
              class="min-h-[42px] px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Attempt Official Mock Test</span>
              <span>→</span>
            </button>
          </div>
        </section>

        <!-- ALL-IN-ONE MAIN WORKSPACE HUB INSIDE INDEX.HTML -->
        <section
          aria-label="Unified All-in-One Main Hub inside index.html"
          data-testid="unified-index-hub-deck"
          class="bento-widget-card p-4 sm:p-5 space-y-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                ALL-IN-ONE WORKSPACE · INDEX.HTML
              </span>
              <h2 class="text-xs sm:text-sm font-extrabold text-slate-900">
                Complete Preparation Suite — Access Every Module Directly Here
              </h2>
            </div>
            <span class="text-[11px] font-mono-tabular text-slate-500 font-semibold">
              Instant SPA Switching · Zero Reloads
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <button
              type="button"
              data-action="nav-page"
              data-page="test"
              data-testid="hub-card-mock-test"
              class="p-3 rounded-xl bg-gradient-to-br from-indigo-50/90 to-white hover:from-indigo-100/80 border border-indigo-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">📝</span>
                <span class="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-mono-tabular text-[9px] font-extrabold">NTA CBT</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">Official Mock Test</div>
              <div class="text-[10px] text-slate-500">Instructions + Live Timer</div>
            </button>

            <button
              type="button"
              data-action="nav-page"
              data-page="study"
              data-testid="hub-card-study-vault"
              class="p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-white hover:from-emerald-100/80 border border-emerald-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">📚</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono-tabular text-[9px] font-extrabold">PDF VAULT</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">Study Material &amp; PDFs</div>
              <div class="text-[10px] text-slate-500">Exact Uploaded PDF Preview</div>
            </button>

            <button
              type="button"
              data-action="nav-page"
              data-page="mentorship"
              data-testid="hub-card-mentorship"
              class="p-3 rounded-xl bg-gradient-to-br from-rose-50/90 to-white hover:from-rose-100/80 border border-rose-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">🎬</span>
                <span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono-tabular text-[9px] font-extrabold">HD VIDEO</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">Lectures &amp; 1:1 Chat</div>
              <div class="text-[10px] text-slate-500">Exact Video &amp; Duration</div>
            </button>

            <button
              type="button"
              data-action="nav-page"
              data-page="planner"
              data-testid="hub-card-planner"
              class="p-3 rounded-xl bg-gradient-to-br from-violet-50/90 to-white hover:from-violet-100/80 border border-violet-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">⚡</span>
                <span class="px-1.5 py-0.5 rounded bg-violet-600 text-white font-mono-tabular text-[9px] font-extrabold">+75 XP</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">To-Do &amp; Study Planner</div>
              <div class="text-[10px] text-slate-500">Daily Goals &amp; Calendar</div>
            </button>

            <button
              type="button"
              data-action="nav-page"
              data-page="test-history"
              data-testid="hub-card-test-history"
              class="p-3 rounded-xl bg-gradient-to-br from-cyan-50/90 to-white hover:from-cyan-100/80 border border-cyan-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">📊</span>
                <span class="px-1.5 py-0.5 rounded bg-cyan-600 text-white font-mono-tabular text-[9px] font-extrabold">REPORTS</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">Test History &amp; Key</div>
              <div class="text-[10px] text-slate-500">Scorecards &amp; Solutions</div>
            </button>

            <button
              type="button"
              data-action="nav-page"
              data-page="admin"
              data-testid="hub-card-admin"
              class="p-3 rounded-xl bg-gradient-to-br from-amber-50/90 to-white hover:from-amber-100/80 border border-amber-200 text-left space-y-1 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <div class="flex items-center justify-between">
                <span class="text-base">🛡️</span>
                <span class="px-1.5 py-0.5 rounded bg-amber-600 text-white font-mono-tabular text-[9px] font-extrabold">STUDIO</span>
              </div>
              <div class="text-xs font-extrabold text-slate-900">Admin Upload Studio</div>
              <div class="text-[10px] text-slate-500">Upload PDFs, Videos &amp; Mocks</div>
            </button>
          </div>
        </section>

        <!-- BENTO WIDGET 1: SYLLABUS TELEMETRY MATRIX + GOOGLE TASKS -->
        <section
          aria-label="Syllabus Progress Tracker and Google Tasks Integration"
          data-testid="syllabus-progress-tracker"
          class="bento-widget-card p-5 sm:p-6 space-y-5"
        >
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                  SYLLABUS TELEMETRY · ${user.targetExam} 2027
                </span>
                <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono-tabular font-extrabold">
                  ${syllabusProgress.overallCompleted}/${syllabusProgress.overallTotal} Chapters Done (${syllabusProgress.overallPercent}%)
                </span>
              </div>
              <h2 class="text-base sm:text-xl font-extrabold text-slate-900">
                Subject Mastery &amp; Google Tasks Topic Reminders
              </h2>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-action="open-syllabus-tasks-modal"
                data-testid="notify-syllabus-google-tasks-btn"
                class="min-h-[40px] px-4 py-2 rounded-xl vermilion-cta-btn text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <span>🔔 Sync Remaining to Google Tasks</span>
                <span class="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono-tabular">
                  ${syllabusProgress.remainingTopics.length} left
                </span>
              </button>
            </div>
          </div>

          <!-- Subject Completion Rate Light Gauge Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            ${syllabusProgress.subjects
              .map((subProg, idx) => {
                const barColor =
                  idx === 0
                    ? 'bg-indigo-600'
                    : idx === 1
                      ? 'bg-emerald-600'
                      : 'bg-amber-500';
                const accentPill =
                  idx === 0
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : idx === 1
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';
                return `
                  <div
                    data-testid="syllabus-subject-card-${subProg.subject.toLowerCase()}"
                    class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2.5"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-extrabold text-slate-900">${subProg.subject}</span>
                      <span class="px-2 py-0.5 rounded-lg border text-xs font-mono-tabular font-extrabold ${accentPill}">
                        ${subProg.completionPercent}%
                      </span>
                    </div>
                    <div class="w-full h-2.5 rounded-full bg-white border border-slate-200 overflow-hidden">
                      <div
                        class="h-full rounded-full ${barColor} transition-all duration-300"
                        style="width: ${subProg.completionPercent}%"
                      ></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] font-mono-tabular text-slate-500 font-bold">
                      <span>${subProg.completedTopics}/${subProg.totalTopics} DONE</span>
                      <span>${subProg.remainingTopics.length} LEFT</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <!-- Subject Filter & Interactive Chapter Checkboxes -->
          <div class="space-y-3 pt-1">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                ${(['ALL', ...subjects] as const)
                  .map(
                    (sub) => `
                  <button
                    type="button"
                    data-action="filter-syllabus-subject"
                    data-subject="${sub}"
                    class="min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                      this.selectedSyllabusSubject === sub
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }"
                  >
                    ${sub === 'ALL' ? 'All Subjects' : sub}
                  </button>
                `
                  )
                  .join('')}
              </div>
              <span class="text-[11px] font-mono-tabular text-slate-500 font-bold">
                Check off completed chapters to update ${user.targetExam} telemetry (+25 XP)
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
              ${examSyllabusTopics
                .map((topic) => {
                  const isDone = completedTopicSet.has(topic.id);
                  return `
                    <label
                      data-testid="syllabus-topic-item-${topic.id}"
                      class="p-3 rounded-xl border transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-slate-500'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300'
                      }"
                    >
                      <div class="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          data-action="toggle-syllabus-topic"
                          data-topic-id="${topic.id}"
                          ${isDone ? 'checked' : ''}
                          class="mt-0.5 w-4 h-4 rounded border-slate-300 accent-emerald-600 cursor-pointer shrink-0"
                        />
                        <div class="min-w-0">
                          <div class="text-xs font-extrabold truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">
                            ${this.escapeHtml(topic.chapterName)}
                          </div>
                          <div class="text-[10px] font-mono-tabular text-slate-500 mt-0.5 truncate">
                            ${topic.subject} · ~${topic.estimatedHours ?? 12}h · +25 XP
                          </div>
                        </div>
                      </div>
                      <span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono-tabular text-[9px] font-extrabold shrink-0">
                        ${this.escapeHtml(topic.weightageLabel || 'Core')}
                      </span>
                    </label>
                  `;
                })
                .join('')}
            </div>
          </div>

          ${
            this.lastSyncedSyllabusTitles.length > 0
              ? `
            <div
              data-testid="syllabus-tasks-synced-banner"
              class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-900"
            >
              <div>
                <strong>✅ Google Tasks Notification Active:</strong> Synced ${this.lastSyncedSyllabusTitles.length} remaining ${user.targetExam} chapters to your Google Tasks reminders!
              </div>
              <span class="font-mono-tabular text-[11px] font-extrabold text-emerald-700">
                ${workspaceConnector.getLastCalendarTasksSyncTime()}
              </span>
            </div>
          `
              : ''
          }
        </section>

        <!-- Main 2-Column Bento Matrix: Daily Mission Console (8 cols) + Live Standings & Mentors (4 cols) -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <!-- Left / Center Column (8 cols) -->
          <div class="xl:col-span-8 space-y-6">
            <!-- 1. WEEKLY SPRINT & DAILY CHECKLIST WIDGET (+75 XP PER TASK) -->
            <section
              aria-label="Weekly Schedule and Daily Task Planner"
              data-testid="cute-weekly-schedule-section"
              class="bento-widget-card p-5 sm:p-6 space-y-5"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div class="space-y-1">
                  <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                    <span>⚡ DAILY SPRINT BOARD</span>
                    <span>·</span>
                    <span class="text-emerald-700">+${XP_PER_COMPLETED_TASK} XP PER TASK</span>
                  </div>
                  <h2 class="text-lg sm:text-xl font-extrabold text-slate-900">
                    Weekly Schedule &amp; Daily Execution Checklist
                  </h2>
                  <p class="text-xs text-slate-600">
                    Structure your daily study blocks and check off completed targets to trigger your <strong class="text-indigo-600">+${XP_PER_COMPLETED_TASK} XP</strong> Streak consistency boost.
                  </p>
                </div>

                <!-- Light Daily Goal Gauge -->
                <div
                  data-testid="daily-goal-progress-ring"
                  class="flex items-center gap-3.5 bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/70 text-slate-900 border border-indigo-200 rounded-2xl px-4 py-2.5 shadow-xs"
                >
                  <div class="relative w-14 h-14 flex items-center justify-center shrink-0">
                    <svg class="w-14 h-14 -rotate-90" viewBox="0 0 88 88">
                      <circle
                        cx="44"
                        cy="44"
                        r="${radius}"
                        stroke="#E2E8F0"
                        stroke-width="7"
                        fill="transparent"
                      />
                      <circle
                        id="daily-goal-ring-circle"
                        cx="44"
                        cy="44"
                        r="${radius}"
                        stroke="${goalProgress.goalMet ? '#059669' : '#4F46E5'}"
                        stroke-width="7"
                        stroke-linecap="round"
                        fill="transparent"
                        stroke-dasharray="${goalProgress.circumference.toFixed(2)}"
                        stroke-dashoffset="${goalProgress.strokeDashoffset.toFixed(2)}"
                        class="transition-all duration-500"
                      />
                    </svg>
                    <span
                      id="daily-goal-ring-pct"
                      class="absolute text-[11px] font-mono-tabular font-extrabold text-slate-900"
                    >
                      ${goalProgress.goalProgressPct}%
                    </span>
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-extrabold text-slate-900">Daily Target</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-extrabold ${
                        goalProgress.goalMet
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }">
                        ${goalProgress.goalMet ? 'COMPLETE' : 'ACTIVE'}
                      </span>
                    </div>
                    <div class="text-[11px] font-mono-tabular text-slate-600">
                      <strong class="text-slate-900">${goalProgress.completedTasks}</strong> / <strong class="text-indigo-600">${goalProgress.dailyGoalTarget}</strong> done
                    </div>
                    <div class="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="-1"
                        aria-label="Decrease daily goal target"
                        class="w-5 h-5 rounded bg-slate-100 hover:bg-indigo-100 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        −
                      </button>
                      <span class="text-[10px] font-mono-tabular font-bold text-slate-600">${goalProgress.dailyGoalTarget}/day</span>
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="1"
                        aria-label="Increase daily goal target"
                        class="w-5 h-5 rounded bg-slate-100 hover:bg-indigo-100 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Day-wise Routine Selector Strip -->
              <div class="grid grid-cols-7 gap-1.5 sm:gap-2" role="tablist" aria-label="Day of Week Schedule">
                ${WEEK_DAYS.map((day, idx) => {
                  const active = this.selectedDay === day;
                  const countForDay = allTasks.filter(
                    (t) => (t.dayOfWeek ?? 'Mon') === day
                  ).length;
                  const dayCodes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
                  return `
                    <button
                      type="button"
                      role="tab"
                      aria-selected="${active}"
                      data-action="select-day"
                      data-day="${day}"
                      class="py-2.5 px-1 sm:px-2.5 rounded-xl border text-xs font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        active
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm -translate-y-0.5'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }"
                    >
                      <span class="text-[9px] font-mono-tabular ${active ? 'text-indigo-100' : 'text-slate-400'}">${dayCodes[idx % dayCodes.length]}</span>
                      <span>${day}</span>
                      <span class="font-mono-tabular text-[10px] px-1.5 py-0.2 rounded ${
                        active ? 'bg-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'
                      }">${countForDay}</span>
                    </button>
                  `;
                }).join('')}
              </div>

              <!-- Add To-Do Task Form -->
              <form id="smart-todo-form" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200">
                <input
                  id="new-todo-title"
                  data-testid="home-todo-input"
                  type="text"
                  required
                  maxlength="200"
                  placeholder="Add study mission for ${this.selectedDay} (+${XP_PER_COMPLETED_TASK} XP)..."
                  aria-label="New task description"
                  class="sm:col-span-5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <select
                  id="new-todo-subject"
                  aria-label="Task Subject"
                  class="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  ${subjects
                    .map((s) => `<option value="${s}">${s}</option>`)
                    .join('')}
                </select>
                <select
                  id="new-todo-priority"
                  aria-label="Task Priority"
                  class="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="High" ${this.newTaskPriority === 'High' ? 'selected' : ''}>🔥 High</option>
                  <option value="Medium" ${this.newTaskPriority === 'Medium' ? 'selected' : ''}>⚡ Medium</option>
                  <option value="Low" ${this.newTaskPriority === 'Low' ? 'selected' : ''}>🌱 Low</option>
                </select>
                <button
                  type="submit"
                  data-testid="home-add-todo-btn"
                  class="sm:col-span-2 min-h-[42px] px-4 py-2 rounded-xl vermilion-cta-btn text-xs font-extrabold whitespace-nowrap cursor-pointer"
                >
                  + Add Task
                </button>
              </form>

              <!-- Subject Filter Pills -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  ${(['ALL', ...subjects] as const)
                    .map(
                      (sub) => `
                    <button
                      type="button"
                      data-action="filter-subject"
                      data-subject="${sub}"
                      class="min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border ${
                        this.selectedSubjectFilter === sub
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }"
                    >
                      ${sub === 'ALL' ? 'All Subjects' : sub}
                    </button>
                  `
                    )
                    .join('')}
                </div>
                <a
                  href="/planner.html"
                  data-testid="open-dedicated-planner-link"
                  class="text-xs font-extrabold text-indigo-600 hover:underline"
                >
                  Open Full Planner &amp; Google Calendar Sync →
                </a>
              </div>

              <!-- Interactive Checklist Items for Selected Day -->
              ${
                filteredTasks.length === 0
                  ? `
                <div
                  data-testid="empty-todo-state"
                  class="p-6 rounded-2xl bg-slate-50/80 border border-dashed border-slate-300 text-center space-y-2.5"
                >
                  <div class="text-2xl">🎯</div>
                  <div class="text-sm font-extrabold text-slate-900">
                    No tasks scheduled for ${this.selectedDay} yet
                  </div>
                  <p class="text-xs text-slate-600 max-w-md mx-auto">
                    Add your first study block above or click below to complete a quick daily drill and trigger your <strong class="text-emerald-600">+${XP_PER_COMPLETED_TASK} XP Streak Micro-Animation</strong>!
                  </p>
                  <div class="pt-1">
                    <button
                      type="button"
                      data-action="quick-complete-daily-task"
                      class="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                    >
                      ⚡ Add &amp; Complete Daily Drill (+${XP_PER_COMPLETED_TASK} XP)
                    </button>
                  </div>
                </div>
              `
                  : `
                <div class="space-y-2.5" role="list">
                  ${filteredTasks
                    .map((task) => {
                      const prio = task.priority ?? 'Medium';
                      const prioColor =
                        prio === 'High'
                          ? 'text-orange-700 bg-orange-50 border-orange-200'
                          : prio === 'Medium'
                            ? 'text-amber-800 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200';
                      return `
                      <div
                        role="listitem"
                        class="p-3.5 bg-white border ${task.isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'} rounded-2xl flex items-start justify-between gap-3 shadow-2xs transition-all"
                      >
                        <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            data-action="toggle-task"
                            data-task-id="${task.taskId}"
                            ${task.isCompleted ? 'checked' : ''}
                            class="mt-0.5 w-5 h-5 rounded border-slate-300 accent-emerald-600 cursor-pointer shrink-0"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="text-sm font-extrabold ${
                              task.isCompleted
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }">
                              ${this.escapeHtml(task.title)}
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                              <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono-tabular font-bold">${task.subject}</span>
                              <span class="px-2 py-0.5 rounded border font-bold ${prioColor}">
                                ${prio}
                              </span>
                              <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-tabular font-extrabold">
                                ${task.isCompleted ? `✓ Earned +${XP_PER_COMPLETED_TASK} XP` : `⚡ +${XP_PER_COMPLETED_TASK} XP`}
                              </span>
                            </div>
                          </div>
                        </label>
                        <button
                          type="button"
                          data-action="delete-task"
                          data-task-id="${task.taskId}"
                          aria-label="Delete task"
                          class="min-h-[32px] min-w-[32px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    `;
                    })
                    .join('')}
                </div>
              `
              }
            </section>

            <!-- 2. ENHANCED 7-DAY STREAK CONSISTENCY WIDGET WITH TASK-COMPLETION MICRO-ANIMATION -->
            <section
              aria-label="7-Day Visual Streak Calendar Strip"
              data-testid="streak-calendar-strip"
              data-streak-animating="${this.streakCelebrationActive || streakAnimState.shouldAnimate ? 'true' : 'false'}"
              class="bento-widget-card p-5 sm:p-6 space-y-4 ${
                this.streakCelebrationActive || streakAnimState.shouldAnimate
                  ? 'streak-widget-celebrating'
                  : ''
              }"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div
                    data-testid="streak-flame-icon-box"
                    class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 border border-amber-300 flex items-center justify-center shrink-0 shadow-xs ${
                      this.streakCelebrationActive || streakAnimState.shouldAnimate
                        ? 'streak-flame-burst'
                        : ''
                    }"
                  >
                    ${this.renderLucideStreakIcon('Flame', true)}
                  </div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-orange-600">
                        CONSISTENCY MATRIX
                      </span>
                      <span
                        data-testid="streak-xp-float-badge"
                        class="px-2 py-0.5 rounded-full text-[10px] font-mono-tabular font-extrabold ${
                          streakAnimState.shouldAnimate
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 streak-xp-float-pill'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }"
                      >
                        ${this.escapeHtml(streakAnimState.badgeLabel)}
                      </span>
                    </div>
                    <h2 class="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      🔥 ${user.currentStreak}-Day Active Streak &amp; 7-Day Telemetry
                    </h2>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    data-action="quick-complete-daily-task"
                    data-testid="quick-complete-daily-task-btn"
                    class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                  >
                    <span>✨ Complete Daily Task</span>
                    <span class="px-1.5 py-0.5 rounded bg-white/20 font-mono-tabular text-[10px]">+${XP_PER_COMPLETED_TASK} XP</span>
                  </button>
                  <span class="text-xs font-mono-tabular font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                    ⚡ ${user.xpPoints ?? 0} XP
                  </span>
                </div>
              </div>

              <!-- MICRO-ANIMATION CONSISTENCY FEEDBACK BANNER -->
              <div
                data-testid="streak-micro-animation-banner"
                class="p-3.5 rounded-2xl border transition-all ${
                  streakAnimState.shouldAnimate
                    ? 'streak-consistency-shimmer border-emerald-300 text-slate-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }"
              >
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="space-y-0.5">
                    <div class="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-slate-900">
                      <span>${streakAnimState.isDailyGoalReached ? '🏆' : streakAnimState.shouldAnimate ? '🔥' : '🌱'}</span>
                      <span>${this.escapeHtml(streakAnimState.headline)}</span>
                    </div>
                    <p class="text-[11px] text-slate-600 leading-relaxed">
                      ${this.escapeHtml(streakAnimState.encouragementText)}
                    </p>
                  </div>
                  <div class="shrink-0 flex items-center gap-2">
                    <div class="w-24 h-2.5 rounded-full bg-white/90 border border-slate-200 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500 ${
                          streakAnimState.isDailyGoalReached ? 'bg-emerald-600' : 'bg-amber-500'
                        }"
                        style="width: ${streakAnimState.progressPercent}%"
                      ></div>
                    </div>
                    <span class="text-[11px] font-mono-tabular font-extrabold text-slate-800">
                      ${streakAnimState.progressPercent}%
                    </span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-7 gap-1.5 sm:gap-2.5" role="list" aria-label="7-Day Streak Status">
                ${streakDays
                  .map((d) => {
                    const isSelectedDate = d.dateIso === activeCalendarDay.dateIso;
                    const tasksForThisDate = allTasks.filter(
                      (t) =>
                        t.dateIso === d.dateIso ||
                        (!t.dateIso && (t.dayOfWeek ?? 'Mon') === d.dayShort)
                    );
                    const cardStyle = isSelectedDate
                      ? 'bg-indigo-600 text-white border-2 border-indigo-600 shadow-sm'
                      : d.isToday
                        ? 'bg-amber-50/90 border-2 border-amber-400 text-slate-900'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 hover:border-indigo-300';
                    const popAnimClass =
                      d.isToday && (this.streakCelebrationActive || streakAnimState.shouldAnimate)
                        ? 'streak-day-celebrate-pop'
                        : '';

                    return `
                      <button
                        type="button"
                        role="listitem"
                        data-action="select-calendar-day"
                        data-date-iso="${d.dateIso}"
                        data-day-short="${d.dayShort}"
                        data-streak-day="${d.dateIso}"
                        data-streak-status="${d.status}"
                        class="rounded-2xl p-2 flex flex-col items-center justify-between gap-1 transition-all cursor-pointer text-center ${cardStyle} ${popAnimClass}"
                      >
                        <div class="text-[10px] font-mono-tabular font-extrabold uppercase ${
                          isSelectedDate ? 'text-indigo-100' : 'text-slate-500'
                        }">
                          ${d.dayLabel}
                        </div>
                        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs">
                          ${this.renderLucideStreakIcon(d.lucideIcon, d.isToday)}
                        </div>
                        <span class="px-1.5 py-0.5 rounded font-mono-tabular text-[9px] font-extrabold ${
                          isSelectedDate
                            ? 'bg-white/20 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }">
                          ${tasksForThisDate.length}
                        </span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>

              <div
                data-testid="calendar-day-task-panel"
                class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-800"
              >
                <span>📅 <strong>${activeCalendarDay.dayLabel}:</strong> ${calendarDayTasks.length} scheduled task(s)</span>
                <span class="font-mono-tabular font-extrabold text-emerald-700">
                  ${calendarDayTasks.filter((t) => t.isCompleted).length}/${calendarDayTasks.length} Done
                </span>
              </div>

              <div id="d3-home-streak-widget" data-testid="d3-home-streak-widget" class="w-full min-h-[140px]"></div>
            </section>

            <!-- 3. Backlog Killer Engine -->
            <section
              aria-label="Backlog Killer Engine"
              class="bento-widget-card p-5 sm:p-6 space-y-4"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-indigo-600">
                    BACKLOG DECOMPRESSOR
                  </span>
                  <h2 class="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    Backlog Killer Micro-Task Split
                  </h2>
                </div>
                <div class="text-xs font-mono-tabular px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-extrabold">
                  Quota: ${(Math.round((this.backlogHours / Math.max(1, this.backlogDays)) * 10) / 10).toFixed(1)} hrs / day
                </div>
              </div>

              <form id="backlog-killer-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="backlog-subject" class="block text-xs font-extrabold text-slate-800 mb-1">
                    1. Select Subject
                  </label>
                  <select
                    id="backlog-subject"
                    class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900"
                  >
                    ${subjects
                      .map(
                        (s) =>
                          `<option value="${s}" ${this.backlogSubject === s ? 'selected' : ''}>${s}</option>`
                      )
                      .join('')}
                  </select>
                </div>

                <div>
                  <label for="backlog-chapter" class="block text-xs font-extrabold text-slate-800 mb-1">
                    2. Pending Chapter Name
                  </label>
                  <input
                    id="backlog-chapter"
                    type="text"
                    required
                    value="${this.escapeHtml(this.backlogChapter)}"
                    placeholder="e.g., Rotational Mechanics & IAOR"
                    class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label for="backlog-hours" class="block text-xs font-extrabold text-slate-800 mb-1">
                    3. Pending Hours (<span id="backlog-hours-val" class="font-mono-tabular text-indigo-600">${this.backlogHours} hrs</span>)
                  </label>
                  <input
                    id="backlog-hours"
                    type="range"
                    min="2"
                    max="40"
                    step="1"
                    value="${this.backlogHours}"
                    class="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label for="backlog-days" class="block text-xs font-extrabold text-slate-800 mb-1">
                    4. Target Days (<span id="backlog-days-val" class="font-mono-tabular text-emerald-600">${this.backlogDays} days</span>)
                  </label>
                  <input
                    id="backlog-days"
                    type="range"
                    min="1"
                    max="21"
                    step="1"
                    value="${this.backlogDays}"
                    class="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div class="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div class="text-xs text-slate-600">
                    Splits <strong class="text-slate-900">${this.backlogHours}h</strong> across <strong class="text-slate-900">${this.backlogDays} days</strong> and adds 3 micro-tasks (worth <strong class="text-emerald-600">+${XP_PER_COMPLETED_TASK * 3} XP</strong>) to your To-Do list.
                  </div>
                  <button
                    type="submit"
                    data-testid="run-backlog-killer-btn"
                    class="min-h-[40px] px-4 py-2 rounded-xl vermilion-cta-btn text-xs font-extrabold shrink-0 cursor-pointer"
                  >
                    Push Micro-Tasks →
                  </button>
                </div>
              </form>
            </section>

            <!-- 4. Personalized 4-Week Study Plan Generator -->
            <section
              aria-label="Personalized 4-Week Study Plan Generator"
              class="bento-widget-card p-5 sm:p-6 space-y-4"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-emerald-600">
                    ADAPTIVE TIMETABLE ARCHITECT
                  </span>
                  <h2 class="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    Personalized 4-Week Study Plan
                  </h2>
                </div>
                <span class="text-xs font-mono-tabular font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                  ${studyPlan.dailyHours}h/day · ${studyPlan.dailyHours * 7}h/week
                </span>
              </div>

              <div class="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div class="flex items-center justify-between">
                  <label for="home-plan-hours" class="text-xs font-extrabold text-slate-800">
                    Preferred Study Duration Per Day
                  </label>
                  <span id="home-plan-hours-label" class="text-xs font-mono-tabular font-extrabold text-indigo-600">
                    ${this.planDailyHours} Hours / Day (${this.planDailyHours * 7} hrs/wk)
                  </span>
                </div>
                <input
                  id="home-plan-hours"
                  type="range"
                  min="3"
                  max="14"
                  step="1"
                  value="${this.planDailyHours}"
                  class="w-full accent-indigo-600 cursor-pointer"
                />

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${subjects
                    .map((sub) => {
                      const currentLevel = this.planProficiency[sub] ?? 'Moderate';
                      return `
                      <div class="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-extrabold text-slate-900">${sub}</span>
                          <span class="text-[11px] font-mono-tabular font-extrabold ${
                            currentLevel === 'Weak'
                              ? 'text-orange-600'
                              : currentLevel === 'Moderate'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }">${currentLevel}</span>
                        </div>
                        <div class="grid grid-cols-3 gap-1">
                          ${(['Weak', 'Moderate', 'Strong'] as const)
                            .map(
                              (lvl) => `
                            <button
                              type="button"
                              data-action="set-proficiency"
                              data-subject="${sub}"
                              data-level="${lvl}"
                              class="min-h-[30px] rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                                currentLevel === lvl
                                  ? lvl === 'Weak'
                                    ? 'bg-orange-500 text-white'
                                    : lvl === 'Moderate'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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

                <div class="flex justify-end">
                  <button
                    type="button"
                    data-action="generate-study-plan"
                    class="min-h-[38px] px-5 py-2 rounded-xl vermilion-cta-btn text-xs font-extrabold cursor-pointer"
                  >
                    Generate 4-Week Schedule
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-4 gap-2">
                ${studyPlan.weeks
                  .map(
                    (wk) => `
                  <button
                    type="button"
                    data-action="select-plan-week"
                    data-week="${wk.weekNumber}"
                    class="min-h-[38px] rounded-xl border text-xs font-mono-tabular font-extrabold transition-colors cursor-pointer ${
                      this.selectedPlanWeek === wk.weekNumber
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                    }"
                  >
                    Week 0${wk.weekNumber}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div class="space-y-2">
                ${activeWeekObj.allocations
                  .map(
                    (alloc) => `
                  <div class="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="space-y-0.5">
                      <div class="text-xs font-extrabold text-slate-900">
                        ${alloc.subject} · <span class="text-indigo-600 font-mono-tabular">${alloc.allocatedHoursPerWeek} hrs/wk</span>
                      </div>
                      <p class="text-xs text-slate-600">${this.escapeHtml(alloc.focusTopics)}</p>
                    </div>
                    <a
                      href="${alloc.recommendedModule === 'cbt' ? '/test.html' : '/study.html'}"
                      class="text-xs font-extrabold text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors shrink-0"
                    >
                      ${this.escapeHtml(alloc.moduleActionLabel)} →
                    </a>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </section>
          </div>

          <!-- Right-Hand Live Bento Widgets Column (4 cols on Desktop) -->
          <aside class="xl:col-span-4 space-y-6" aria-label="Live Study Widgets">
            <!-- REAL WEEKLY ASPIRANT LEADERBOARD WIDGET (Clean Light Theme) -->
            <section
              data-testid="real-weekly-leaderboard"
              class="bento-widget-card p-5 space-y-4"
            >
              <div class="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-indigo-600">
                      🏆 WEEKLY LEAGUE
                    </span>
                    <span class="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-mono-tabular font-extrabold">
                      ${currentWeekKey}
                    </span>
                  </div>
                  <h3 class="text-base font-extrabold text-slate-900 mt-0.5">
                    Live Student Standings
                  </h3>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    data-testid="current-user-level-badge"
                    class="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono-tabular font-extrabold text-emerald-700"
                  >
                    ⭐ Lv.${rankAndLevel.level}
                  </span>
                  <span
                    data-testid="current-user-rank-badge"
                    class="px-2.5 py-1 rounded-xl bg-indigo-600 text-xs font-mono-tabular font-extrabold text-white"
                  >
                    Rank #${leaderboardStandings.currentUserRank}
                  </span>
                </div>
              </div>

              ${
                leaderboardStandings.currentUserEntry
                  ? `
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/80 border border-indigo-200 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span class="text-amber-600">🥇 #${leaderboardStandings.currentUserRank}</span>
                      <span>${this.escapeHtml(leaderboardStandings.currentUserEntry.name)} (${user.isGuest ? 'Guest Preview' : 'Enrolled'})</span>
                    </div>
                    <div class="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                      🔥 ${user.currentStreak}d Streak · ⚡ ${user.xpPoints ?? 0} XP · ⭐ Lv.${rankAndLevel.level}
                    </div>
                  </div>
                  <div class="text-sm font-mono-tabular font-extrabold text-indigo-600">
                    ${leaderboardStandings.currentUserEntry.compositePoints} pts
                  </div>
                </div>
              `
                  : ''
              }

              <div class="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                ${leaderboardStandings.top10
                  .map((entry) => {
                    const isMe = entry.uid === user.uid;
                    return `
                    <div class="py-2.5 px-2.5 flex items-center justify-between text-xs ${
                      isMe ? 'bg-indigo-50/60 font-bold rounded-xl' : ''
                    }">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="font-mono-tabular font-extrabold w-6 ${
                          entry.rank === 1 ? 'text-amber-600' : 'text-slate-400'
                        }">#${entry.rank}</span>
                        <div class="truncate">
                          <div class="text-slate-900 truncate font-bold">${this.escapeHtml(entry.name)}</div>
                          <div class="text-[10px] text-slate-500 font-mono-tabular">${entry.targetExam} · ${entry.currentStreak}d streak</div>
                        </div>
                      </div>
                      <span class="font-mono-tabular font-extrabold text-emerald-600">${entry.compositePoints} pts</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>

              <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 text-center">
                Complete To-Do tasks (<strong class="text-emerald-600">+${XP_PER_COMPLETED_TASK} XP</strong> each) and Mock Tests to climb the weekly league!
              </div>
            </section>

            <!-- Mentor Live Directory & Quick Connect Widget -->
            <section class="bento-widget-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Founder &amp; Head Mentor
                </span>
                <span class="text-[11px] font-mono-tabular text-indigo-600 font-extrabold">1:1 Mentorship</span>
              </div>

              <div class="space-y-2.5">
                ${mentors
                  .map(
                    (m) => `
                  <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="relative shrink-0">
                        <img
                          src="${m.avatarUrl}"
                          alt="${this.escapeHtml(m.name)}"
                          referrerpolicy="no-referrer"
                          class="w-10 h-10 rounded-full object-cover border border-indigo-200"
                        />
                        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          m.isOnline !== false ? 'bg-emerald-500' : 'bg-slate-400'
                        }"></span>
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-xs font-extrabold text-slate-900 truncate">${this.escapeHtml(m.name)}</h3>
                        <p class="text-[11px] text-slate-600 truncate">${this.escapeHtml(m.subjectSpecialty)} · ${m.isOnline !== false ? '🟢 Online' : '⚪ Offline'}</p>
                      </div>
                    </div>
                    <a
                      href="/mentorship.html"
                      class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold shrink-0 transition-colors"
                    >
                      Connect →
                    </a>
                  </div>
                `
                  )
                  .join('')}
              </div>

              <div class="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href="/mentorship.html"
                  class="min-h-[40px] px-3 py-2 rounded-xl vermilion-cta-btn text-xs font-extrabold flex items-center justify-center"
                >
                  Lectures &amp; Chat
                </a>
                <a
                  href="/test-history.html"
                  class="min-h-[40px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center transition-colors"
                >
                  Test Analytics
                </a>
              </div>
            </section>

            <!-- Subject Accuracy Snapshot Widget -->
            <section class="bento-widget-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-indigo-600">
                    MOCK EXAM ANALYTICS
                  </span>
                  <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                    Subject Accuracy Snapshot
                  </h3>
                </div>
                <a
                  href="/test-history.html"
                  data-testid="home-open-test-history-link"
                  class="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold hover:bg-indigo-100"
                >
                  History →
                </a>
              </div>
              <div id="d3-home-accuracy-mini" data-testid="d3-home-accuracy-mini" class="w-full min-h-[180px]"></div>
            </section>
          </aside>
        </div>

        <!-- SYLLABUS GOOGLE TASKS CONFIRMATION MODAL -->
        ${this.renderSyllabusGoogleTasksModal(syllabusProgress.remainingTopics, user.targetExam)}
      </div>
    `;

    this.mountD3HomeWidgets(streakDays);
    this.bindEvents();
  }

  private renderSyllabusGoogleTasksModal(
    remainingTopics: typeof SYLLABUS_TOPICS,
    targetExam: 'JEE' | 'NEET'
  ): string {
    if (!this.isSyllabusTasksModalOpen) return '';
    const previewList = remainingTopics.slice(0, 8);

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Google Tasks Syllabus Notification Sync"
        data-testid="syllabus-tasks-confirm-modal"
        class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                🔔 Google Tasks Syllabus Notification Integration
              </span>
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900">
                Notify Remaining ${targetExam} Topics in Google Tasks?
              </h3>
            </div>
            <button
              type="button"
              data-action="close-syllabus-tasks-modal"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel ✕
            </button>
          </div>

          <p class="text-xs text-slate-600 leading-relaxed">
            This will create task reminders in your <strong>Google Tasks (` +
      '`@default`' +
      `)</strong> list for your next <strong>${previewList.length} remaining ${targetExam} chapters</strong> so you get notified on your phone and desktop to complete them:
          </p>

          <div class="space-y-1.5 max-h-[220px] overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
            ${
              previewList.length === 0
                ? `<div class="text-xs font-bold text-emerald-600">🎉 All ${targetExam} syllabus chapters are already completed!</div>`
                : previewList
                    .map(
                      (t, idx) => `
                  <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span class="font-semibold text-slate-800">${idx + 1}. [${t.subject}] ${this.escapeHtml(t.chapterName)}</span>
                    <span class="font-mono-tabular text-[10px] text-indigo-600 font-bold">${this.escapeHtml(t.weightageLabel || 'High Yield')}</span>
                  </div>
                `
                    )
                    .join('')
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              data-action="close-syllabus-tasks-modal"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-action="confirm-syllabus-google-tasks-sync"
              data-testid="confirm-syllabus-google-tasks-sync-btn"
              ${this.isSyncingSyllabusTasks || previewList.length === 0 ? 'disabled' : ''}
              class="min-h-[40px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs cursor-pointer"
            >
              ${this.isSyncingSyllabusTasks ? 'Syncing to Google Tasks...' : '✓ Confirm & Notify in Google Tasks'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private mountD3HomeWidgets(streakDays: StreakCalendarDay[]): void {
    if (!this.containerEl) return;

    const streakWidgetEl = this.containerEl.querySelector<HTMLElement>(
      '#d3-home-streak-widget'
    );
    if (streakWidgetEl) {
      renderD3StreakProgressionWidget(
        streakWidgetEl,
        streakDays,
        dataStore.getUser().currentStreak
      );
    }

    const accuracyMiniEl = this.containerEl.querySelector<HTMLElement>(
      '#d3-home-accuracy-mini'
    );
    if (accuracyMiniEl) {
      const submissions = dataStore.getTestSubmissions();
      renderD3SubjectAccuracyChart(accuracyMiniEl, submissions);
    }
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    // Smart To-Do Form
    const todoForm = this.containerEl.querySelector<HTMLFormElement>('#smart-todo-form');
    todoForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = todoForm.querySelector<HTMLInputElement>('#new-todo-title');
      const subjectSelect = todoForm.querySelector<HTMLSelectElement>('#new-todo-subject');
      const prioritySelect = todoForm.querySelector<HTMLSelectElement>('#new-todo-priority');

      const title = titleInput?.value.trim() ?? '';
      if (!title) return;
      const subject = (subjectSelect?.value as SubjectName) || 'Physics';
      const priority = (prioritySelect?.value as TaskPriority) || 'High';
      this.newTaskPriority = priority;

      await dataStore.addTask(title, subject, 'Today', {
        priority,
        examFocus: dataStore.getUser().targetExam,
        dayOfWeek: this.selectedDay,
      });
      if (titleInput) titleInput.value = '';
      this.callbacks.onShowToast(
        `Added "${title}" to ${this.selectedDay}! Complete it to earn +${XP_PER_COMPLETED_TASK} XP.`
      );
      this.rerender();
    });

    // Backlog Killer Sliders & Form
    const hoursInput = this.containerEl.querySelector<HTMLInputElement>('#backlog-hours');
    const hoursLabel = this.containerEl.querySelector('#backlog-hours-val');
    hoursInput?.addEventListener('input', () => {
      this.backlogHours = Number(hoursInput.value);
      if (hoursLabel) hoursLabel.textContent = `${this.backlogHours} hrs`;
    });

    const daysInput = this.containerEl.querySelector<HTMLInputElement>('#backlog-days');
    const daysLabel = this.containerEl.querySelector('#backlog-days-val');
    daysInput?.addEventListener('input', () => {
      this.backlogDays = Number(daysInput.value);
      if (daysLabel) daysLabel.textContent = `${this.backlogDays} days`;
    });

    const backlogForm = this.containerEl.querySelector<HTMLFormElement>('#backlog-killer-form');
    backlogForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subSelect = backlogForm.querySelector<HTMLSelectElement>('#backlog-subject');
      const chapInput = backlogForm.querySelector<HTMLInputElement>('#backlog-chapter');
      this.backlogSubject = (subSelect?.value as SubjectName) || 'Physics';
      this.backlogChapter = chapInput?.value.trim() || 'Rotational Mechanics';

      const user = dataStore.getUser();
      const plan = calculateBacklogKillerPlan({
        uid: user.uid,
        subject: this.backlogSubject,
        chapterName: this.backlogChapter,
        pendingHours: this.backlogHours,
        targetDays: this.backlogDays,
        examFocus: user.targetExam,
      });

      await dataStore.addBatchTasks(plan.microTasks);
      this.callbacks.onShowToast(
        `Backlog Killer: Added 3 micro-tasks (${plan.dailyQuotaHours}h/day) to your schedule!`
      );
      this.rerender();
    });

    // Study Plan Hours slider
    const planHoursInput = this.containerEl.querySelector<HTMLInputElement>('#home-plan-hours');
    const planHoursLabel = this.containerEl.querySelector('#home-plan-hours-label');
    planHoursInput?.addEventListener('input', () => {
      this.planDailyHours = Number(planHoursInput.value);
      if (planHoursLabel) {
        planHoursLabel.textContent = `${this.planDailyHours} Hours / Day (${
          this.planDailyHours * 7
        } hrs/wk)`;
      }
    });

    // Action buttons & checkboxes
    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      if (action === 'toggle-task') {
        el.addEventListener('change', async () => {
          const taskId = el.dataset.taskId;
          if (!taskId) return;
          const updated = await dataStore.toggleTaskCompletion(taskId);
          if (updated?.isCompleted) {
            const user = dataStore.getUser();
            const todayIso = new Date().toISOString().slice(0, 10);
            const streakRes = computeUpdatedStreak(
              user.currentStreak,
              user.lastActiveDate,
              todayIso
            );
            if (streakRes.incremented) {
              await dataStore.updateUser({
                currentStreak: streakRes.currentStreak,
                lastActiveDate: streakRes.lastActiveDate,
              });
            }
            await this.triggerTaskCompletionCelebration(updated.title, streakRes.incremented);
            this.callbacks.onShowToast(
              `🎉 +${XP_PER_COMPLETED_TASK} XP earned! Streak consistency boost activated!`
            );
          } else {
            this.streakCelebrationActive = false;
          }
          window.dispatchEvent(new CustomEvent('prepskm:user-updated'));
          this.rerender();
        });
        return;
      }

      if (action === 'toggle-syllabus-topic') {
        el.addEventListener('change', async () => {
          const topicId = el.dataset.topicId;
          if (!topicId) return;
          const res = await dataStore.toggleSyllabusTopic(topicId);
          this.callbacks.onShowToast(
            res.completed
              ? `✅ Chapter marked complete! +25 XP (Total: ${res.xpPoints} XP)`
              : 'Chapter marked as remaining.'
          );
          window.dispatchEvent(new CustomEvent('prepskm:user-updated'));
          this.rerender();
        });
        return;
      }

      el.addEventListener('click', async () => {
        switch (action) {
          case 'nav-page': {
            const targetPage = el.dataset.page as PageId | undefined;
            if (targetPage) {
              const nextUrl =
                targetPage === 'home' ? '/index.html' : `/index.html?page=${targetPage}`;
              window.history.pushState({}, '', nextUrl);
              this.callbacks.onNavigatePage(targetPage);
            }
            break;
          }
          case 'quick-complete-daily-task': {
            const user = dataStore.getUser();
            const subjects = getSubjectsForExam(user.targetExam);
            const pendingTask = dataStore
              .getTasks()
              .find((t) => !t.isCompleted && subjects.includes(t.subject));
            let completedTitle = 'Daily High-Yield PYQ Sprint';
            if (pendingTask) {
              const updated = await dataStore.toggleTaskCompletion(pendingTask.taskId);
              completedTitle = updated?.title || pendingTask.title;
            } else {
              const created = await dataStore.addTask(
                `${subjects[0]} 20-PYQ Daily Consistency Drill`,
                subjects[0],
                'Today',
                {
                  priority: 'High',
                  examFocus: user.targetExam,
                  dayOfWeek: this.selectedDay,
                }
              );
              await dataStore.toggleTaskCompletion(created.taskId);
              completedTitle = created.title;
            }
            const refreshedUser = dataStore.getUser();
            const todayIso = new Date().toISOString().slice(0, 10);
            const streakRes = computeUpdatedStreak(
              refreshedUser.currentStreak,
              refreshedUser.lastActiveDate,
              todayIso
            );
            if (streakRes.incremented || refreshedUser.currentStreak === 0) {
              await dataStore.updateUser({
                currentStreak: Math.max(1, streakRes.currentStreak),
                lastActiveDate: streakRes.lastActiveDate,
              });
            }
            await this.triggerTaskCompletionCelebration(completedTitle, streakRes.incremented);
            this.callbacks.onShowToast(
              `🔥 Daily Task Completed! +${XP_PER_COMPLETED_TASK} XP & Streak Consistency Boost!`
            );
            window.dispatchEvent(new CustomEvent('prepskm:user-updated'));
            this.rerender();
            break;
          }
          case 'filter-syllabus-subject': {
            const sub = el.dataset.subject as SubjectName | 'ALL';
            if (sub) {
              this.selectedSyllabusSubject = sub;
              this.rerender();
            }
            break;
          }
          case 'open-syllabus-tasks-modal': {
            this.isSyllabusTasksModalOpen = true;
            this.rerender();
            break;
          }
          case 'close-syllabus-tasks-modal': {
            this.isSyllabusTasksModalOpen = false;
            this.rerender();
            break;
          }
          case 'confirm-syllabus-google-tasks-sync': {
            const user = dataStore.getUser();
            const progress = dataStore.getSyllabusProgressSummary(user.targetExam);
            this.isSyncingSyllabusTasks = true;
            this.rerender();
            try {
              const syncRes = await workspaceConnector.syncRemainingSyllabusTopicsToGoogleTasks(
                progress.remainingTopics,
                user.targetExam
              );
              this.lastSyncedSyllabusTitles = syncRes.syncedTitles;
              this.isSyllabusTasksModalOpen = false;
              this.callbacks.onShowToast(
                `🔔 Synced ${syncRes.syncedCount} remaining ${user.targetExam} chapters to Google Tasks!`
              );
            } finally {
              this.isSyncingSyllabusTasks = false;
              this.rerender();
            }
            break;
          }
          case 'adjust-daily-goal': {
            const delta = Number(el.dataset.delta || 0);
            const next = dataStore.updateDailyGoalTarget(
              dataStore.getDailyGoalTarget() + delta
            );
            this.callbacks.onShowToast(`Daily Goal Target updated to ${next} tasks/day`);
            this.rerender();
            break;
          }
          case 'select-calendar-day': {
            const iso = el.dataset.dateIso;
            const dayShort = el.dataset.dayShort;
            if (iso) {
              this.selectedCalendarDateIso = iso;
            }
            if (dayShort) {
              this.selectedDay = dayShort;
            }
            this.rerender();
            break;
          }
          case 'select-day': {
            const day = el.dataset.day;
            if (day) {
              this.selectedDay = day;
              this.rerender();
            }
            break;
          }
          case 'filter-subject': {
            const sub = el.dataset.subject as SubjectName | 'ALL';
            if (sub) {
              this.selectedSubjectFilter = sub;
              this.rerender();
            }
            break;
          }
          case 'delete-task': {
            const id = el.dataset.taskId;
            if (id) {
              await dataStore.deleteTask(id);
              window.dispatchEvent(new CustomEvent('prepskm:user-updated'));
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
              `Saved 4-Week ${user.targetExam} Study Plan (${this.planDailyHours}h/day)`
            );
            this.rerender();
            break;
          }
          case 'select-plan-week': {
            const wk = Number(el.dataset.week);
            if (!Number.isNaN(wk)) {
              this.selectedPlanWeek = wk;
              this.rerender();
            }
            break;
          }
        }
      });
    });
  }

  private escapeHtml(str: string | undefined | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
