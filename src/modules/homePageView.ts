import { getCohortTheme, WEEK_DAYS } from '../constants';
import { dataStore } from '../services/firebaseService';
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
  computeUpdatedStreak,
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
  private newTaskPriority: TaskPriority = 'High';
  private backlogSubject: SubjectName = 'Physics';
  private backlogChapter = 'Rotational Mechanics & IAOR';
  private backlogHours = 9;
  private backlogDays = 6;
  private lastBacklogQuota: number | null = 1.5;
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

    const announcement = dataStore.getLatestRoadmapAnnouncement();
    const broadcasts = dataStore.getBroadcasts();
    const latestBroadcast = broadcasts[0];
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
    const streakRisk = dataStore.evaluateCurrentStreakRisk();
    const streakNotifications = dataStore.getStreakNotifications();
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
      <div class="space-y-6">
        <!-- Global Admin Broadcast + New Video Announcement Row -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          ${
            latestBroadcast
              ? `
            <section
              aria-label="Global Admin Broadcast Message"
              class="lg:col-span-7 bg-gradient-to-r from-indigo-50/95 via-white to-emerald-50/90 border border-indigo-200 rounded-2xl px-4 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="flex items-start sm:items-center gap-3 min-w-0">
                <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#4F46E5] to-violet-600 text-white text-[10px] font-extrabold tracking-wide uppercase shrink-0">
                  📢 ${this.escapeHtml(latestBroadcast.badgeType)}
                </span>
                <div class="min-w-0">
                  <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    ${this.escapeHtml(latestBroadcast.title)}
                  </p>
                  <p class="text-[11px] text-slate-600 line-clamp-1">
                    ${this.escapeHtml(latestBroadcast.message)}
                  </p>
                </div>
              </div>
              <a
                href="${this.escapeHtml(latestBroadcast.actionLink || '/mentorship.html')}"
                data-action="watch-announcement"
                class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-[#4F46E5] text-xs font-bold inline-flex items-center justify-center gap-1 shrink-0"
              >
                <span>Open</span>
                <span aria-hidden="true">→</span>
              </a>
            </section>
          `
              : ''
          }

          <section
            aria-label="High Priority Video Release"
            class="${latestBroadcast ? 'lg:col-span-5' : 'lg:col-span-12'} bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/80 border border-emerald-200 rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#10B981]">
                New Mentor Lecture · ${this.escapeHtml(announcement.mentorName || 'Sumit Kumar')}
              </span>
              <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                ${this.escapeHtml(announcement.title)}
              </p>
            </div>
            <a
              href="/mentorship.html"
              data-action="watch-announcement"
              class="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0 shadow-2xs"
            >
              Watch →
            </a>
          </section>
        </div>

        <!-- UNIQUE CLASS & COHORT DEDICATED HERO BANNER -->
        <section
          aria-label="Active Class and Exam Cohort Workspace Banner"
          data-testid="cohort-unique-banner"
          class="rounded-2xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white p-5 sm:p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div class="space-y-2 max-w-3xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-extrabold uppercase tracking-wider">
              <span>🎓 ${this.escapeHtml(cohortTheme.badgeText)}</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight">
              ${this.escapeHtml(cohortTheme.headline)}
            </h1>
            <p class="text-xs sm:text-sm text-white/90 leading-relaxed">
              ${this.escapeHtml(cohortTheme.subheadline)}
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              ${cohortTheme.focusPills
                .map(
                  (pill) => `
                <span class="px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-[11px] font-bold">
                  ✦ ${this.escapeHtml(pill)}
                </span>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="flex sm:flex-row lg:flex-col gap-2 shrink-0">
            <a
              href="/study.html"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Open ${user.classYear} Study Vault</span>
              <span>→</span>
            </a>
            <a
              href="/test.html"
              class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/60 border border-white/30 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <span>Launch ${user.classYear} Mock Test</span>
              <span>→</span>
            </a>
          </div>
        </section>

        <!-- 7-DAY VISUAL CALENDAR STRIP (CLICK ANY DAY TO SEE THAT DAY'S TASKS) -->
        <section
          aria-label="7-Day Visual Streak Calendar Strip"
          data-testid="streak-calendar-strip"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-indigo-50 border border-amber-200 flex items-center justify-center shadow-2xs shrink-0">
                ${this.renderLucideStreakIcon('Flame', true)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    7-Day Interactive Calendar · Click Any Date to View Tasks
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#10B981] text-[10px] font-mono-tabular font-bold">
                    currentStreak: ${user.currentStreak}d
                  </span>
                </div>
                <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                  ${user.currentStreak}-Day Active Study Streak & Daily Task Log
                </h2>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <div class="flex items-center gap-3 text-[11px] font-semibold text-slate-600 bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Flame / Active</span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#10B981]"></span> Completed</span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#4F46E5]"></span> Click Date for Tasks</span>
              </div>
            </div>
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

          <!-- D3.JS STREAK PROGRESSION WIDGET + REAL-TIME FIREBASE STREAK-AT-RISK PUSH NOTIFICATION SYSTEM -->
          <div
            data-testid="d3-streak-widget-section"
            class="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100"
          >
            <!-- Left 7 Cols: D3.js Interactive 7-Day Streak Progression Graph -->
            <div class="lg:col-span-7 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    D3.js Live Streak Progression Visualization
                  </span>
                  <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                    7-Day Study Streak Momentum & Daily Goal Completion Curve
                  </h3>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] font-mono-tabular text-[10px] font-extrabold">
                  D3.js SVG
                </span>
              </div>
              <div id="d3-home-streak-widget" data-testid="d3-home-streak-widget" class="w-full min-h-[150px]"></div>
            </div>

            <!-- Right 5 Cols: Real-Time Firebase Streak-At-Risk Notification Center -->
            <div class="lg:col-span-5 p-4 rounded-2xl ${
              streakRisk.riskLevel === 'CRITICAL'
                ? 'bg-red-50/70 border border-red-200'
                : streakRisk.riskLevel === 'WARNING'
                  ? 'bg-amber-50/70 border border-amber-200'
                  : 'bg-emerald-50/60 border border-emerald-200'
            } flex flex-col justify-between gap-3">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    streakRisk.riskLevel === 'CRITICAL'
                      ? 'bg-[#EF4444] text-white'
                      : streakRisk.riskLevel === 'WARNING'
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-[#10B981] text-white'
                  }">
                    🔔 Firebase Streak Guard · ${streakRisk.riskLevel}
                  </span>
                  <span class="font-mono-tabular text-[11px] font-bold text-slate-700">
                    ${streakRisk.hoursRemaining}h left today
                  </span>
                </div>
                <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                  ${this.escapeHtml(streakRisk.statusHeadline)}
                </h3>
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  ${this.escapeHtml(
                    streakRisk.notificationPayload?.message ||
                      'Complete at least 1 study task today to protect and advance your daily streak.'
                  )}
                </p>

                ${
                  streakNotifications.length > 0
                    ? `
                  <div class="mt-2 p-2.5 rounded-xl bg-white/90 border border-slate-200/80 space-y-1">
                    <div class="flex items-center justify-between text-[10px] font-mono-tabular text-[#4F46E5] font-bold">
                      <span>Latest Firebase Push Alert</span>
                      <span>${streakNotifications[0].hoursRemaining}h left</span>
                    </div>
                    <p class="text-[11px] font-semibold text-slate-800 line-clamp-2">
                      ${this.escapeHtml(streakNotifications[0].title)}
                    </p>
                  </div>
                `
                    : ''
                }
              </div>

              <div class="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  data-action="trigger-firebase-streak-reminder"
                  data-testid="trigger-streak-notification-btn"
                  class="flex-1 min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-[#4F46E5] text-white text-xs font-extrabold transition-colors"
                >
                  🔔 Send Firebase Streak Reminder
                </button>
                <a
                  href="/planner.html"
                  class="min-h-[38px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold inline-flex items-center"
                >
                  Planner →
                </a>
              </div>
            </div>
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
                <div class="space-y-1">
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                    Routine & Completion Tracker · ${user.classYear} (${user.targetExam})
                  </span>
                  <h2 class="text-lg sm:text-xl font-bold text-slate-900">
                    Weekly Schedule & Daily Goal Progress Ring
                  </h2>
                  <div class="pt-1">
                    <a
                      href="/planner.html"
                      data-testid="open-dedicated-planner-link"
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-xs font-extrabold transition-colors"
                    >
                      <span>🗂️ Open Dedicated Full-Page Backlog & To-Do Workspace</span>
                      <span>→</span>
                    </a>
                  </div>
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
                <div class="flex items-center gap-2">
                  <div class="text-xs font-mono-tabular px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                    Extra Quota: ${(Math.round((this.backlogHours / Math.max(1, this.backlogDays)) * 10) / 10).toFixed(1)} hrs / day
                  </div>
                  <a
                    href="/planner.html?tab=backlog"
                    class="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-bold text-[#4F46E5]"
                  >
                    Full Engine →
                  </a>
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
            <!-- D3.js Subject Accuracy & Mock Test Analytics Widget -->
            <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                    D3.js Mock Exam Analytics
                  </span>
                  <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                    Subject Accuracy Snapshot
                  </h3>
                </div>
                <a
                  href="/test-history.html"
                  data-testid="home-open-test-history-link"
                  class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-xs font-extrabold"
                >
                  Full History →
                </a>
              </div>
              <div id="d3-home-accuracy-mini" data-testid="d3-home-accuracy-mini" class="w-full min-h-[190px]"></div>
            </section>

            <!-- Multi-Mentor Live Directory & Quick Connect Widget -->
            <section class="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981]">
                  <span class="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                  ${mentors.filter((m) => m.isOnline !== false).length} Subject Mentors Active
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
                      <div class="relative shrink-0">
                        <img
                          src="${m.avatarUrl}"
                          alt="${this.escapeHtml(m.name)}"
                          referrerpolicy="no-referrer"
                          class="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]"
                        />
                        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          m.isOnline !== false ? 'bg-[#10B981]' : 'bg-amber-400'
                        }"></span>
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-xs font-bold text-slate-900 truncate">${this.escapeHtml(m.name)}</h3>
                        <p class="text-[11px] text-slate-500 truncate">${this.escapeHtml(m.subjectSpecialty)} · ${m.isOnline !== false ? '🟢 Active' : '⚪ Offline'}</p>
                      </div>
                    </div>
                    <a
                      href="/mentorship.html"
                      class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-[11px] font-bold shrink-0"
                    >
                      ${m.isOnline !== false ? 'Call/Chat →' : 'Chat →'}
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
                  href="/test-history.html"
                  class="min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-slate-800 text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  Test History
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

    this.mountD3HomeWidgets(streakDays);
    this.bindEvents();
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
            }
          }
          this.rerender();
        });
        return;
      }

      el.addEventListener('click', async () => {
        switch (action) {
          case 'trigger-firebase-streak-reminder': {
            const notif = await dataStore.triggerStreakRiskNotification();
            if (notif) {
              this.callbacks.onShowToast(`🔔 Firebase Alert Sent: ${notif.title}`);
            }
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

  private escapeHtml(str: string | undefined | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
