import * as d3 from 'd3';
import { getCohortTheme, WEEK_DAYS } from '../constants';
import { dataStore } from '../services/firebaseService';
import type {
  PageId,
  ProficiencyLevel,
  StreakCalendarDay,
  StudyTask,
  SubjectName,
  TaskPriority,
} from '../types';
import {
  buildStreakCalendarStrip,
  calculateBacklogKillerPlan,
  calculateDailyGoalProgress,
  computeUpdatedStreak,
  getSubjectsForExam,
} from '../utils/examLogic';

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
  private newTaskPriority: TaskPriority = 'High';
  private backlogSubject: SubjectName = 'Physics';
  private backlogChapter = 'Rotational Mechanics & IAOR';
  private backlogHours = 9;
  private backlogDays = 6;
  private lastBacklogQuota: number | null = 1.5;

  // Streak Widget micro-animation & reminder state
  private showStreakMicroAnimation = false;
  private lastCompletedTaskTitle = '';
  private streakCelebrationTimer: number | null = null;

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
    this.rerender();
  }

  private renderLucideStreakIcon(iconName: StreakCalendarDay['lucideIcon'], isToday: boolean): string {
    switch (iconName) {
      case 'Flame':
      case 'flame':
        return `<svg class="w-5 h-5 ${isToday ? 'text-amber-500 fill-amber-400/30' : 'text-orange-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
      case 'Zap':
      case 'zap':
        return `<svg class="w-5 h-5 text-indigo-600 fill-indigo-200/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      case 'CheckCircle2':
      case 'check-circle-2':
        return `<svg class="w-5 h-5 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
      case 'CircleDot':
      case 'circle-dot':
        return `<svg class="w-5 h-5 text-[#4F46E5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
      default:
        return `<svg class="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
    }
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
    const radius = 38;
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

    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const studyPlan = dataStore.getStudyPlan();
    const activeWeekObj =
      studyPlan.weeks.find((w) => w.weekNumber === this.selectedPlanWeek) ??
      studyPlan.weeks[0];
    const leaderboardStandings = dataStore.getLeaderboardStandings();

    this.containerEl.innerHTML = `
      <div class="space-y-5">
        <!-- SLIM, COMPACT CLASS & COHORT WORKSPACE BANNER (No bulky announcement bar; notifications live in header bell) -->
        <section
          aria-label="Active Class and Exam Cohort Workspace Banner"
          data-testid="cohort-unique-banner"
          class="rounded-2xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold uppercase tracking-wider">
                🎓 ${this.escapeHtml(cohortTheme.badgeText)}
              </span>
              <h1 class="text-base sm:text-lg font-extrabold tracking-tight truncate">
                ${this.escapeHtml(cohortTheme.headline)}
              </h1>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              ${cohortTheme.focusPills
                .slice(0, 3)
                .map(
                  (pill) => `
                <span class="px-2 py-0.5 rounded-md bg-white/15 border border-white/20 text-[10px] font-bold">
                  ✦ ${this.escapeHtml(pill)}
                </span>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <a
              href="/study.html"
              class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold inline-flex items-center justify-center gap-1 shadow-2xs"
            >
              <span>📚 ${user.classYear} PDFs</span>
            </a>
            <a
              href="/test.html"
              class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-900/40 hover:bg-slate-900/60 border border-white/30 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
            >
              <span>🎯 ${user.classYear} Mock Test</span>
            </a>
          </div>
        </section>

        <!-- 7-DAY VISUAL CALENDAR STRIP + D3.JS STREAK PROGRESSION WIDGET + MICRO-ANIMATION -->
        <section
          aria-label="7-Day Visual Streak Calendar Strip"
          data-testid="d3-streak-widget"
          class="bg-[#FFFDF9] border border-[#E8DFD1] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden"
        >
          ${
            this.showStreakMicroAnimation
              ? `
            <div
              data-testid="streak-micro-animation"
              class="streak-celebrate-banner p-3.5 rounded-2xl bg-gradient-to-r from-amber-100/95 via-emerald-50 to-indigo-100/90 border-2 border-amber-300 flex items-center justify-between gap-3 shadow-md"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl streak-flame-active">🔥</span>
                <div>
                  <div class="text-xs sm:text-sm font-extrabold text-slate-900">
                    Streak Milestone Unlocked! +25 Streak XP · ${user.currentStreak}-Day Consistency!
                  </div>
                  <div class="text-[11px] font-semibold text-slate-700">
                    Completed: "${this.escapeHtml(this.lastCompletedTaskTitle || 'Daily Study Goal')}" — Keep the momentum alive!
                  </div>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full bg-[#10B981] text-white text-[11px] font-extrabold shrink-0">
                ✨ Verified
              </span>
            </div>
          `
              : ''
          }

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="streak-calendar-strip">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-indigo-50 border border-amber-200 flex items-center justify-center shadow-2xs shrink-0 ${
                this.showStreakMicroAnimation ? 'streak-flame-active' : ''
              }">
                ${this.renderLucideStreakIcon('Flame', true)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    D3.js Streak Progression Widget & 7-Day Interactive Calendar
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#10B981] text-[10px] font-mono-tabular font-bold">
                    currentStreak: ${user.currentStreak}d
                  </span>
                </div>
                <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                  ${user.currentStreak}-Day Active Study Streak & D3.js Momentum Curve
                </h2>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                data-action="trigger-streak-celebration"
                data-testid="celebrate-streak-btn"
                class="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-extrabold transition-colors"
              >
                🎉 Celebrate Task Streak
              </button>
              <button
                type="button"
                data-action="send-streak-reminder"
                data-testid="send-streak-reminder-btn"
                class="min-h-[34px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-xs font-extrabold transition-colors"
              >
                🔔 Send Firebase Streak Reminder
              </button>
            </div>
          </div>

          <!-- D3.js 7-Day Streak Progression & Completion Curve -->
          <div class="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#E8DFD1] space-y-1.5">
            <div class="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span>D3.js 7-Day Streak Momentum Curve & Daily Task Completion Bars</span>
              <span class="text-[#D97706]">● Streak Momentum Line &nbsp; <span class="text-[#10B981]">■ Daily Tasks Completed</span></span>
            </div>
            <div id="d3-streak-progression-container" class="w-full h-[165px]"></div>
          </div>

          <!-- 7-Day Interactive Strip Cards -->
          <div class="grid grid-cols-7 gap-1.5 sm:gap-3" role="list" aria-label="7-Day Streak Status">
            ${streakDays
              .map((d) => {
                const isSelectedDate = d.dateIso === activeCalendarDay.dateIso;
                const tasksForThisDate = allTasks.filter(
                  (t) =>
                    t.dateIso === d.dateIso ||
                    (!t.dateIso && (t.dayOfWeek ?? 'Mon') === d.dayShort)
                );
                const cardStyle = isSelectedDate
                  ? 'bg-gradient-to-b from-indigo-100/90 via-white to-amber-50/70 border-2 border-[#4F46E5] shadow-md ring-2 ring-indigo-500/20'
                  : d.isToday
                    ? 'bg-gradient-to-b from-indigo-50/90 via-white to-amber-50/60 border-2 border-indigo-300 shadow-xs'
                    : d.status === 'milestone' || d.status === 'streak_active'
                      ? 'bg-gradient-to-b from-amber-50/80 to-white border border-amber-200 hover:border-indigo-300'
                      : d.status === 'completed'
                        ? 'bg-gradient-to-b from-emerald-50/70 to-white border border-emerald-200 hover:border-indigo-300'
                        : 'bg-[#F8FAFC] border border-[#E2E8F0] hover:border-indigo-300';

                return `
                  <button
                    type="button"
                    role="listitem"
                    data-action="select-calendar-day"
                    data-date-iso="${d.dateIso}"
                    data-day-short="${d.dayShort}"
                    data-streak-day="${d.dateIso}"
                    data-streak-status="${d.status}"
                    class="rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer text-center ${cardStyle}"
                  >
                    <div class="text-[10px] sm:text-xs font-extrabold uppercase tracking-wide ${
                      isSelectedDate || d.isToday ? 'text-[#4F46E5]' : 'text-slate-600'
                    }">
                      ${d.dayLabel}
                    </div>
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-100 shadow-2xs flex items-center justify-center">
                      ${this.renderLucideStreakIcon(d.lucideIcon, d.isToday)}
                    </div>
                    <div class="text-[10px] font-mono-tabular font-bold text-slate-800">
                      Nov ${d.dayNumber}
                    </div>
                    <span class="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                      isSelectedDate
                        ? 'bg-[#4F46E5] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }">
                      ${tasksForThisDate.length} ${tasksForThisDate.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                  </button>
                `;
              })
              .join('')}
          </div>

          <!-- Selected Calendar Day Task Log Box -->
          <div
            data-testid="calendar-day-task-panel"
            class="p-3.5 sm:p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-lg bg-[#4F46E5] text-white text-[11px] font-extrabold">
                  📅 ${activeCalendarDay.dayLabel} · ${activeCalendarDay.dateIso}
                </span>
                <span class="text-xs font-bold text-slate-800">
                  Scheduled & Completed Tasks on ${activeCalendarDay.dayLabel}
                </span>
              </div>
              <span class="text-[11px] font-mono-tabular text-slate-500">
                ${calendarDayTasks.filter((t) => t.isCompleted).length}/${calendarDayTasks.length} Completed
              </span>
            </div>

            ${
              calendarDayTasks.length === 0
                ? `<p class="text-xs text-slate-500 py-1">No tasks logged for ${activeCalendarDay.dayLabel} (${activeCalendarDay.dateIso}). Add one below in the ${activeCalendarDay.dayShort} schedule!</p>`
                : `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${calendarDayTasks
                  .map(
                    (ct) => `
                  <label class="p-2.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-between gap-2.5 cursor-pointer hover:border-indigo-300">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        data-action="toggle-task"
                        data-task-id="${ct.taskId}"
                        ${ct.isCompleted ? 'checked' : ''}
                        class="w-4 h-4 rounded border-slate-300 text-[#4F46E5] shrink-0"
                      />
                      <span class="text-xs font-semibold truncate ${
                        ct.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                      }">${this.escapeHtml(ct.title)}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] text-[10px] font-bold shrink-0">
                      ${ct.subject}
                    </span>
                  </label>
                `
                  )
                  .join('')}
              </div>
            `
            }
          </div>
        </section>

        <!-- Expansive Desktop Multi-Column Layout: Center Content Area (8 cols) + Right-Hand Live Widgets (4 cols) -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <!-- Center Content Area -->
          <div class="xl:col-span-8 space-y-6">
            <!-- 1. Weekly Schedule & Daily Task Planner with Dynamic Visual Progress Ring -->
            <section
              aria-label="Weekly Schedule and Daily Task Planner"
              class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                    Routine & Completion Tracker · ${user.classYear} (${user.targetExam})
                  </span>
                  <h2 class="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                    Weekly Schedule & Daily Goal Progress Ring
                  </h2>
                </div>

                <!-- Dynamic SVG Visual Progress Ring (Tracks Daily Goal vs Completed Tasks) -->
                <div
                  data-testid="daily-goal-progress-ring"
                  class="flex items-center gap-3.5 bg-gradient-to-r from-[#F8FAFC] via-indigo-50/40 to-emerald-50/40 border border-[#E2E8F0] rounded-2xl px-4 py-2.5"
                >
                  <div class="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg class="w-16 h-16 -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r="${radius}"
                        stroke="#E2E8F0"
                        stroke-width="8"
                        fill="transparent"
                      />
                      <circle
                        id="daily-goal-ring-circle"
                        cx="48"
                        cy="48"
                        r="${radius}"
                        stroke="${goalProgress.goalMet ? '#10B981' : '#4F46E5'}"
                        stroke-width="8"
                        stroke-linecap="round"
                        fill="transparent"
                        stroke-dasharray="${goalProgress.circumference.toFixed(2)}"
                        stroke-dashoffset="${goalProgress.strokeDashoffset.toFixed(2)}"
                      />
                    </svg>
                    <span
                      id="daily-goal-ring-pct"
                      class="absolute text-xs font-mono-tabular font-extrabold text-slate-900"
                    >
                      ${goalProgress.goalProgressPct}%
                    </span>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-extrabold text-slate-900">Daily Goal Ring</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        goalProgress.goalMet
                          ? 'bg-emerald-100 text-[#10B981]'
                          : 'bg-indigo-100 text-[#4F46E5]'
                      }">
                        ${goalProgress.goalMet ? 'Goal Met!' : 'In Progress'}
                      </span>
                    </div>
                    <div class="text-[11px] font-mono-tabular text-slate-600">
                      <strong class="text-slate-900">${goalProgress.completedTasks}</strong> completed / <strong class="text-[#4F46E5]">${goalProgress.dailyGoalTarget}</strong> daily goal (${goalProgress.totalTasks} total)
                    </div>
                    <div class="flex items-center gap-1.5 pt-0.5">
                      <span class="text-[10px] font-semibold text-slate-500">Target:</span>
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="-1"
                        aria-label="Decrease daily goal target"
                        class="w-6 h-6 rounded-md bg-white border border-[#E2E8F0] text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span class="text-[11px] font-mono-tabular font-bold text-slate-800">${goalProgress.dailyGoalTarget} tasks</span>
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="1"
                        aria-label="Increase daily goal target"
                        class="w-6 h-6 rounded-md bg-white border border-[#E2E8F0] text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Day-wise Routine Selector Strip -->
              <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Day of Week Schedule">
                ${WEEK_DAYS.map((day) => {
                  const active = this.selectedDay === day;
                  const countForDay = allTasks.filter(
                    (t) => (t.dayOfWeek ?? 'Mon') === day
                  ).length;
                  return `
                    <button
                      type="button"
                      role="tab"
                      aria-selected="${active}"
                      data-action="select-day"
                      data-day="${day}"
                      class="min-h-[42px] px-4 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${
                        active
                          ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-sm'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }"
                    >
                      <span>${day}</span>
                      <span class="font-mono-tabular text-[11px] px-1.5 py-0.5 rounded-md ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-700'
                      }">${countForDay}</span>
                    </button>
                  `;
                }).join('')}
              </div>

              <!-- Smart To-Do List Maker Form -->
              <form id="smart-todo-form" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <input
                  id="new-todo-title"
                  type="text"
                  required
                  maxlength="200"
                  placeholder="Add high-yield task for ${this.selectedDay} (e.g., Solve 30 Rotational PYQs)..."
                  aria-label="New task description"
                  class="sm:col-span-5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5]"
                />
                <select
                  id="new-todo-subject"
                  aria-label="Task Subject"
                  class="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#4F46E5]"
                >
                  ${subjects
                    .map((s) => `<option value="${s}">${s}</option>`)
                    .join('')}
                </select>
                <select
                  id="new-todo-priority"
                  aria-label="Task Priority"
                  class="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#4F46E5]"
                >
                  <option value="High" ${this.newTaskPriority === 'High' ? 'selected' : ''}>High Priority</option>
                  <option value="Medium" ${this.newTaskPriority === 'Medium' ? 'selected' : ''}>Medium</option>
                  <option value="Low" ${this.newTaskPriority === 'Low' ? 'selected' : ''}>Low</option>
                </select>
                <button
                  type="submit"
                  class="sm:col-span-2 min-h-[42px] px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
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
                      class="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        this.selectedSubjectFilter === sub
                          ? 'bg-slate-900 text-white'
                          : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200/70 border border-[#E2E8F0]'
                      }"
                    >
                      ${sub === 'ALL' ? 'All Subjects' : sub}
                    </button>
                  `
                    )
                    .join('')}
                </div>
                <span class="text-xs font-mono-tabular font-bold text-[#4F46E5]">
                  ${this.selectedDay} Schedule: ${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <!-- Interactive Checklist Items for Selected Day -->
              <div class="divide-y divide-slate-100" role="list">
                ${filteredTasks
                  .map((task) => {
                    const prio = task.priority ?? 'Medium';
                    const prioColor =
                      prio === 'High'
                        ? 'text-[#EF4444] bg-red-50 border-red-200'
                        : prio === 'Medium'
                          ? 'text-[#F59E0B] bg-amber-50 border-amber-200'
                          : 'text-[#10B981] bg-emerald-50 border-emerald-200';
                    return `
                    <div
                      role="listitem"
                      class="py-3.5 px-2 flex items-start justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors"
                    >
                      <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          data-action="toggle-task"
                          data-task-id="${task.taskId}"
                          ${task.isCompleted ? 'checked' : ''}
                          class="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer shrink-0"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold ${
                            task.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }">
                            ${this.escapeHtml(task.title)}
                          </div>
                          <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span class="font-semibold text-slate-700">${task.subject}</span>
                            <span>·</span>
                            <span>${task.dayOfWeek ?? 'Mon'}</span>
                            <span>·</span>
                            <span class="px-2 py-0.5 rounded-md border font-semibold ${prioColor}">
                              ${prio} Priority
                            </span>
                            <span class="font-mono-tabular text-indigo-600 font-semibold">
                              ${task.examFocus ?? user.targetExam} Focus
                            </span>
                          </div>
                        </div>
                      </label>
                      <button
                        type="button"
                        data-action="delete-task"
                        data-task-id="${task.taskId}"
                        aria-label="Delete task"
                        class="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-[#EF4444] hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </section>

            <!-- 2. Backlog Killer Engine -->
            <section
              aria-label="Backlog Killer Engine"
              class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
                    Automated Quota & Micro-Task Injector
                  </span>
                  <h2 class="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                    Backlog Killer Engine
                  </h2>
                </div>
                <div class="text-xs font-mono-tabular px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                  Extra Quota: ${(Math.round((this.backlogHours / Math.max(1, this.backlogDays)) * 10) / 10).toFixed(1)} hrs / day
                </div>
              </div>

              <form id="backlog-killer-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="backlog-subject" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    1. Select Subject
                  </label>
                  <select
                    id="backlog-subject"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-slate-900 focus:outline-none focus:border-[#4F46E5]"
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
                  <label for="backlog-chapter" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    2. Pending Chapter Name
                  </label>
                  <input
                    id="backlog-chapter"
                    type="text"
                    required
                    value="${this.escapeHtml(this.backlogChapter)}"
                    placeholder="e.g., Rotational Mechanics & IAOR"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>

                <div>
                  <label for="backlog-hours" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    3. Estimated Pending Hours (<span id="backlog-hours-val" class="font-mono-tabular text-[#4F46E5]">${this.backlogHours} hrs</span>)
                  </label>
                  <input
                    id="backlog-hours"
                    type="range"
                    min="2"
                    max="40"
                    step="1"
                    value="${this.backlogHours}"
                    class="w-full accent-[#4F46E5] cursor-pointer"
                  />
                </div>

                <div>
                  <label for="backlog-days" class="block text-xs font-semibold text-slate-700 mb-1.5">
                    4. Target Days to Clear (<span id="backlog-days-val" class="font-mono-tabular text-[#10B981]">${this.backlogDays} days</span>)
                  </label>
                  <input
                    id="backlog-days"
                    type="range"
                    min="1"
                    max="21"
                    step="1"
                    value="${this.backlogDays}"
                    class="w-full accent-[#10B981] cursor-pointer"
                  />
                </div>

                <div class="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div class="text-xs text-slate-600">
                    Algorithm splits <strong class="text-slate-900">${this.backlogHours}h</strong> across <strong class="text-slate-900">${this.backlogDays} days</strong> (<strong class="font-mono-tabular text-[#4F46E5]">${(this.backlogHours / Math.max(1, this.backlogDays)).toFixed(1)}h/day</strong> extra quota) and injects 3 micro-tasks into your Daily To-Do List.
                  </div>
                  <button
                    type="submit"
                    data-testid="run-backlog-killer-btn"
                    class="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors shrink-0"
                  >
                    Calculate & Push Micro-Tasks
                  </button>
                </div>
              </form>
            </section>

            <!-- 3. Personalized 4-Week Study Plan Generator -->
            <section
              aria-label="Personalized 4-Week Study Plan Generator"
              class="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                    Adaptive Firestore Timetable · Prioritizes Weak Subjects
                  </span>
                  <h2 class="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                    Personalized 4-Week Study Plan Generator
                  </h2>
                </div>
                <span class="text-xs font-mono-tabular text-slate-600 bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                  ${studyPlan.dailyHours}h/day · ${studyPlan.dailyHours * 7}h/week
                </span>
              </div>

              <div class="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-4">
                <div class="flex items-center justify-between">
                  <label for="home-plan-hours" class="text-xs font-semibold text-slate-700">
                    Preferred Study Duration Per Day
                  </label>
                  <span id="home-plan-hours-label" class="text-xs font-mono-tabular font-bold text-[#4F46E5]">
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
                  class="w-full accent-[#4F46E5] cursor-pointer"
                />

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${subjects
                    .map((sub) => {
                      const currentLevel = this.planProficiency[sub] ?? 'Moderate';
                      return `
                      <div class="bg-white border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-slate-800">${sub}</span>
                          <span class="text-[11px] font-mono-tabular font-semibold ${
                            currentLevel === 'Weak'
                              ? 'text-[#EF4444]'
                              : currentLevel === 'Moderate'
                                ? 'text-[#F59E0B]'
                                : 'text-[#10B981]'
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
                              class="min-h-[32px] rounded-lg text-[11px] font-semibold transition-colors ${
                                currentLevel === lvl
                                  ? lvl === 'Weak'
                                    ? 'bg-[#EF4444] text-white'
                                    : lvl === 'Moderate'
                                      ? 'bg-[#F59E0B] text-white'
                                      : 'bg-[#10B981] text-white'
                                  : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200/60'
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
                    class="min-h-[42px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    Generate & Save 4-Week Schedule
                  </button>
                </div>
              </div>

              <!-- Week Selector Tabs -->
              <div class="grid grid-cols-4 gap-2">
                ${studyPlan.weeks
                  .map(
                    (wk) => `
                  <button
                    type="button"
                    data-action="select-plan-week"
                    data-week="${wk.weekNumber}"
                    class="min-h-[40px] rounded-xl border text-xs font-mono-tabular font-bold transition-colors ${
                      this.selectedPlanWeek === wk.weekNumber
                        ? 'bg-indigo-50 border-[#4F46E5] text-[#4F46E5]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:text-slate-900'
                    }"
                  >
                    Week 0${wk.weekNumber}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <!-- Active Week Allocations -->
              <div class="space-y-2.5">
                ${activeWeekObj.allocations
                  .map(
                    (alloc) => `
                  <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-0.5">
                      <div class="text-xs font-bold text-slate-900">
                        ${alloc.subject} · <span class="text-[#4F46E5] font-mono-tabular">${alloc.allocatedHoursPerWeek} hrs/wk</span>
                        <span class="ml-1.5 text-[11px] font-semibold ${
                          alloc.proficiency === 'Weak'
                            ? 'text-[#EF4444]'
                            : alloc.proficiency === 'Moderate'
                              ? 'text-[#F59E0B]'
                              : 'text-[#10B981]'
                        }">(${alloc.proficiency} Priority)</span>
                      </div>
                      <p class="text-xs text-slate-600">${this.escapeHtml(alloc.focusTopics)}</p>
                    </div>
                    <a
                      href="${alloc.recommendedModule === 'cbt' ? '/test.html' : '/study.html'}"
                      class="text-xs font-semibold text-[#4F46E5] hover:underline shrink-0"
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

          <!-- Right-Hand Live Widgets Column (4 cols on Desktop) -->
          <aside class="xl:col-span-4 space-y-6" aria-label="Live Study Widgets">
            <!-- Multi-Mentor Live Directory & Quick Connect Widget -->
            <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981]">
                  <span class="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                  ${mentors.length} Subject Mentors Online
                </span>
                <span class="text-[11px] font-mono-tabular text-[#4F46E5] font-bold">1:1 Video & Chat</span>
              </div>

              <div class="space-y-2.5">
                ${mentors
                  .slice(0, 3)
                  .map(
                    (m) => `
                  <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <img
                        src="${m.avatarUrl}"
                        alt="${this.escapeHtml(m.name)}"
                        referrerpolicy="no-referrer"
                        class="w-10 h-10 rounded-full object-cover border border-[#E2E8F0] shrink-0"
                      />
                      <div class="min-w-0">
                        <h3 class="text-xs font-bold text-slate-900 truncate">${this.escapeHtml(m.name)}</h3>
                        <p class="text-[11px] text-slate-500 truncate">${this.escapeHtml(m.subjectSpecialty)} · ${this.escapeHtml(m.qualification)}</p>
                      </div>
                    </div>
                    <a
                      href="/mentorship.html"
                      class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-[11px] font-bold shrink-0"
                    >
                      Talk →
                    </a>
                  </div>
                `
                  )
                  .join('')}
              </div>

              <div class="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href="/mentorship.html"
                  class="min-h-[42px] px-3 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  1:1 Mentorship
                </a>
                <a
                  href="/test.html"
                  class="min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-800 text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  Mock & Practice
                </a>
              </div>
            </section>

            <!-- Gamified Top 10 Aspirant Leaderboard Widget -->
            <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-[#4F46E5]">
                    All-India Cohort Standings
                  </span>
                  <h3 class="text-base font-bold text-slate-900">Top 10 Leaderboard</h3>
                </div>
                <span class="text-xs font-mono-tabular font-bold text-[#4F46E5]">
                  Rank #${leaderboardStandings.currentUserRank}
                </span>
              </div>

              ${
                leaderboardStandings.currentUserEntry
                  ? `
                <div class="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-bold text-slate-900">
                      ${this.escapeHtml(leaderboardStandings.currentUserEntry.name)} (You)
                    </div>
                    <div class="text-[11px] font-mono-tabular text-slate-600">
                      Tasks: ${leaderboardStandings.currentUserEntry.taskCompletionRate}% · Best Mock: ${leaderboardStandings.currentUserEntry.bestMockScore}
                    </div>
                  </div>
                  <div class="text-sm font-mono-tabular font-bold text-[#4F46E5]">
                    ${leaderboardStandings.currentUserEntry.compositePoints} XP
                  </div>
                </div>
              `
                  : ''
              }

              <div class="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                ${leaderboardStandings.top10
                  .map((entry) => {
                    const isMe = entry.uid === user.uid;
                    return `
                    <div class="py-2.5 px-2 flex items-center justify-between text-xs ${
                      isMe ? 'bg-indigo-50/50 font-semibold rounded-lg' : ''
                    }">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="font-mono-tabular font-bold w-6 ${
                          entry.rank <= 3 ? 'text-[#F59E0B]' : 'text-slate-500'
                        }">#${entry.rank}</span>
                        <div class="truncate">
                          <div class="text-slate-900 truncate font-medium">${this.escapeHtml(entry.name)}</div>
                          <div class="text-[10px] text-slate-500 font-mono-tabular">${entry.targetExam} · ${entry.currentStreak}d streak</div>
                        </div>
                      </div>
                      <span class="font-mono-tabular font-bold text-slate-800">${entry.compositePoints} XP</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </section>
          </aside>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderD3StreakChart(streakDays, allTasks, user.currentStreak);
  }

  private triggerCelebrationAnimation(taskTitle: string): void {
    this.lastCompletedTaskTitle = taskTitle;
    this.showStreakMicroAnimation = true;
    if (this.streakCelebrationTimer) {
      window.clearTimeout(this.streakCelebrationTimer);
    }
    this.streakCelebrationTimer = window.setTimeout(() => {
      this.showStreakMicroAnimation = false;
      const banner = this.containerEl?.querySelector('[data-testid="streak-micro-animation"]');
      if (banner) banner.remove();
    }, 5500);
  }

  private renderD3StreakChart(
    streakDays: StreakCalendarDay[],
    allTasks: StudyTask[],
    currentStreak: number
  ): void {
    if (!this.containerEl) return;
    const host = this.containerEl.querySelector<HTMLElement>('#d3-streak-progression-container');
    if (!host) return;
    host.innerHTML = '';

    const width = Math.max(host.clientWidth || 640, 320);
    const height = 165;
    const margin = { top: 20, right: 24, bottom: 30, left: 36 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chartData = streakDays.map((d, idx) => {
      const dayTasks = allTasks.filter(
        (t) =>
          t.dateIso === d.dateIso ||
          (!t.dateIso && (t.dayOfWeek ?? 'Mon') === d.dayShort)
      );
      const completed = dayTasks.filter((t) => t.isCompleted).length;
      const total = Math.max(1, dayTasks.length);
      const streakLevel =
        d.status === 'streak_active' || d.status === 'milestone' || d.status === 'completed'
          ? Math.max(1, currentStreak - (streakDays.length - 1 - idx) + 1)
          : completed > 0
            ? currentStreak
            : Math.max(1, idx);
      return {
        label: `${d.dayShort} ${d.dayNumber}`,
        completed,
        total,
        pct: Math.round((completed / total) * 100),
        streakScore: Math.min(100, streakLevel * 18 + completed * 20),
        isToday: d.isToday,
      };
    });

    const svg = d3
      .select(host)
      .append('svg')
      .attr('id', 'd3-streak-progression-svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'w-full h-full overflow-visible');

    const defs = svg.append('defs');
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', 'streakAreaGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.36);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10B981').attr('stop-opacity', 0.03);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(chartData.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.35);

    const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Subtle horizontal grid lines
    g.append('g')
      .selectAll('line')
      .data([0, 50, 100])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', '#E8DFD1')
      .attr('stroke-dasharray', '3,3');

    // Y axis labels
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(3)
          .tickFormat((d) => `${d}%`)
      )
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('line').remove())
      .selectAll('text')
      .attr('fill', '#78716C')
      .attr('font-size', '10px')
      .attr('font-weight', '600');

    // X axis labels
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .call((axis) => axis.select('.domain').attr('stroke', '#E8DFD1'))
      .call((axis) => axis.selectAll('line').remove())
      .selectAll('text')
      .attr('fill', '#44403C')
      .attr('font-size', '10px')
      .attr('font-weight', '700');

    // Daily Completion Bars
    g.selectAll('.streak-bar')
      .data(chartData)
      .join('rect')
      .attr('class', 'streak-bar')
      .attr('x', (d) => x(d.label) ?? 0)
      .attr('y', (d) => y(d.pct))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(4, innerHeight - y(d.pct)))
      .attr('rx', 6)
      .attr('fill', (d) => (d.isToday ? '#4F46E5' : '#10B981'))
      .attr('opacity', 0.28);

    // Smooth D3 Area under Streak Curve
    const areaGen = d3
      .area<(typeof chartData)[0]>()
      .x((d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .y0(innerHeight)
      .y1((d) => y(d.streakScore))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'url(#streakAreaGrad)')
      .attr('d', areaGen);

    // Smooth D3 Line for Streak Progression
    const lineGen = d3
      .line<(typeof chartData)[0]>()
      .x((d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .y((d) => y(d.streakScore))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#D97706')
      .attr('stroke-width', 3)
      .attr('d', lineGen);

    // Data Nodes + Value Badges
    g.selectAll('.streak-dot')
      .data(chartData)
      .join('circle')
      .attr('class', 'streak-dot')
      .attr('cx', (d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .attr('cy', (d) => y(d.streakScore))
      .attr('r', (d) => (d.isToday ? 6 : 4.5))
      .attr('fill', (d) => (d.isToday ? '#4F46E5' : '#FFFDF9'))
      .attr('stroke', (d) => (d.isToday ? '#FFFDF9' : '#D97706'))
      .attr('stroke-width', 2.5);

    g.selectAll('.streak-val-label')
      .data(chartData)
      .join('text')
      .attr('x', (d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => Math.max(10, y(d.streakScore) - 8))
      .attr('text-anchor', 'middle')
      .attr('fill', '#1E1B18')
      .attr('font-size', '9px')
      .attr('font-weight', '800')
      .text((d) => `${d.completed}/${d.total}`);
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
      this.callbacks.onShowToast(`Added "${title}" (${priority} Priority) to ${this.selectedDay}`);
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

      this.lastBacklogQuota = plan.dailyQuotaHours;
      await dataStore.addBatchTasks(plan.microTasks);
      this.callbacks.onShowToast(
        `Backlog Killer: Pushed 3 micro-tasks (${plan.dailyQuotaHours}h/day quota) to your To-Do List!`
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

    // Action buttons
    this.containerEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      if (action === 'toggle-task') {
        el.addEventListener('change', async () => {
          const taskId = el.dataset.taskId;
          if (!taskId) return;
          const updated = await dataStore.toggleTaskCompletion(taskId);
          if (updated?.isCompleted) {
            this.triggerCelebrationAnimation(updated.title);
            const user = dataStore.getUser();
            const todayIso = '2026-11-04';
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
              this.callbacks.onShowToast(
                `Streak Incremented! 🔥 ${streakRes.currentStreak}-Day Study Streak`
              );
            } else {
              this.callbacks.onShowToast(
                `🎉 Task Completed! +25 Streak XP added to your ${user.currentStreak}-Day Streak!`
              );
            }
          }
          this.rerender();
        });
        return;
      }

      el.addEventListener('click', async () => {
        switch (action) {
          case 'trigger-streak-celebration': {
            this.triggerCelebrationAnimation('Daily High-Yield Study Milestone');
            this.callbacks.onShowToast('🔥 Streak Celebration Triggered! Keep pushing for AIR < 500!');
            this.rerender();
            break;
          }
          case 'send-streak-reminder': {
            const alertItem = await dataStore.triggerStreakReminderNotification();
            this.callbacks.onShowToast(`🔔 Firebase Push Sent: ${alertItem.title}`);
            this.rerender();
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
              `Saved 4-Week ${user.targetExam} Study Plan (${this.planDailyHours}h/day) to profile`
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

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
