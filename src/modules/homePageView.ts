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
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 ${isToday ? 'text-amber-500 fill-amber-400/30' : 'text-orange-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
      case 'Zap':
      case 'zap':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 fill-indigo-200/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      case 'CheckCircle2':
      case 'check-circle-2':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
      case 'CircleDot':
      case 'circle-dot':
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-[#4F46E5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
      default:
        return `<svg class="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
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

    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const studyPlan = dataStore.getStudyPlan();
    const activeWeekObj =
      studyPlan.weeks.find((w) => w.weekNumber === this.selectedPlanWeek) ??
      studyPlan.weeks[0];
    const leaderboardStandings = dataStore.getLeaderboardStandings();
    const currentWeekKey = getCurrentWeekKey();

    // Syllabus Progress Tracker Data (Backed by Dynamic Syllabus Topics & Weightages)
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
        <!-- BESPOKE CARBON-OBSIDIAN ARCHITECTURAL HERO DECK -->
        <section
          aria-label="Active Class and Exam Cohort Workspace Banner"
          data-testid="cohort-unique-banner"
          class="obsidian-widget-card px-5 py-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden"
        >
          <div class="space-y-2.5 max-w-2xl relative z-10">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF4D1C] text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                <span>● ${this.escapeHtml(cohortTheme.badgeText)}</span>
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#FBBF24] text-[10px] font-mono-tabular font-extrabold">
                <span>🔥 ${user.currentStreak}d Streak</span>
                <span>·</span>
                <span>⚡ ${user.xpPoints ?? 0} XP</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00A86B]/20 border border-[#00A86B]/50 text-[#34D399] text-[10px] font-mono-tabular font-extrabold">
                Rank #${rankAndLevel.currentUserRank} · Lv.${rankAndLevel.level}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
              ${this.escapeHtml(cohortTheme.headline)}
            </h1>
            <p class="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-xl">
              ${this.escapeHtml(cohortTheme.subheadline)}
            </p>
          </div>

          <div class="grid grid-cols-2 sm:flex sm:flex-row lg:flex-col gap-2.5 shrink-0 relative z-10">
            <a
              href="/mentorship.html"
              class="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FF4D1C] hover:bg-[#E03E10] text-white border-2 border-white/20 shadow-[0_3px_0_#000000] text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <span>Video Batches &amp; Lectures</span>
              <span>→</span>
            </a>
            <a
              href="/test.html"
              class="min-h-[42px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F0EA] text-[#121316] border-2 border-[#18181B] shadow-[0_3px_0_#FF4D1C] text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <span>Attempt Mock Test</span>
              <span>→</span>
            </a>
          </div>
        </section>

        <!-- BESPOKE BENTO WIDGET 1: SYLLABUS TELEMETRY MATRIX + GOOGLE TASKS -->
        <section
          aria-label="Syllabus Progress Tracker and Google Tasks Integration"
          data-testid="syllabus-progress-tracker"
          class="bento-widget-card p-5 sm:p-6 space-y-5"
        >
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b-2 border-[#18181B]/10">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-lg bg-[#121316] text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                  SYLLABUS TELEMETRY · ${user.targetExam} 2027
                </span>
                <span class="px-2.5 py-0.5 rounded-lg bg-[#00A86B]/15 border border-[#00A86B] text-[#00A86B] text-[10px] font-mono-tabular font-extrabold">
                  ${syllabusProgress.overallCompleted}/${syllabusProgress.overallTotal} Chapters Done (${syllabusProgress.overallPercent}%)
                </span>
              </div>
              <h2 class="text-base sm:text-xl font-extrabold text-[#121316]">
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
                <span class="px-1.5 py-0.5 rounded bg-black/25 text-[10px] font-mono-tabular">
                  ${syllabusProgress.remainingTopics.length} left
                </span>
              </button>
            </div>
          </div>

          <!-- Subject Completion Rate Tactile Gauge Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            ${syllabusProgress.subjects
              .map((subProg, idx) => {
                const barColor =
                  idx === 0
                    ? 'bg-[#FF4D1C]'
                    : idx === 1
                      ? 'bg-[#00A86B]'
                      : 'bg-[#D97706]';
                const accentPill =
                  idx === 0
                    ? 'bg-[#FF4D1C]/10 text-[#FF4D1C] border-[#FF4D1C]/30'
                    : idx === 1
                      ? 'bg-[#00A86B]/10 text-[#00A86B] border-[#00A86B]/30'
                      : 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30';
                return `
                  <div
                    data-testid="syllabus-subject-card-${subProg.subject.toLowerCase()}"
                    class="p-4 rounded-2xl bg-[#F4F0EA] border-2 border-[#18181B] shadow-[0_3px_0_#18181B] space-y-2.5"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-extrabold text-[#121316]">${subProg.subject}</span>
                      <span class="px-2 py-0.5 rounded-lg border text-xs font-mono-tabular font-extrabold ${accentPill}">
                        ${subProg.completionPercent}%
                      </span>
                    </div>
                    <div class="w-full h-3 rounded-full bg-white border border-[#18181B] overflow-hidden p-0.5">
                      <div
                        class="h-full rounded-full ${barColor} transition-all duration-300"
                        style="width: ${subProg.completionPercent}%"
                      ></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] font-mono-tabular text-zinc-600 font-bold">
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
                    class="min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-2 ${
                      this.selectedSyllabusSubject === sub
                        ? 'bg-[#121316] text-white border-[#121316] shadow-[0_2px_0_#FF4D1C]'
                        : 'bg-[#F4F0EA] text-[#121316] border-[#18181B]/20 hover:border-[#18181B]'
                    }"
                  >
                    ${sub === 'ALL' ? 'All Subjects' : sub}
                  </button>
                `
                  )
                  .join('')}
              </div>
              <span class="text-[11px] font-mono-tabular text-zinc-600 font-bold">
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
                      class="p-3 rounded-xl border-2 transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                        isDone
                          ? 'bg-[#00A86B]/10 border-[#00A86B] text-zinc-500'
                          : 'bg-white hover:bg-[#F4F0EA] border-[#18181B]/20 hover:border-[#18181B]'
                      }"
                    >
                      <div class="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          data-action="toggle-syllabus-topic"
                          data-topic-id="${topic.id}"
                          ${isDone ? 'checked' : ''}
                          class="mt-0.5 w-4 h-4 rounded border-[#18181B] accent-[#00A86B] cursor-pointer shrink-0"
                        />
                        <div class="min-w-0">
                          <div class="text-xs font-extrabold truncate ${isDone ? 'line-through text-zinc-400' : 'text-[#121316]'}">
                            ${this.escapeHtml(topic.chapterName)}
                          </div>
                          <div class="text-[10px] font-mono-tabular text-zinc-500 mt-0.5 truncate">
                            ${topic.subject} · ~${topic.estimatedHours ?? 12}h · +25 XP
                          </div>
                        </div>
                      </div>
                      <span class="px-1.5 py-0.5 rounded bg-[#121316] text-white font-mono-tabular text-[9px] font-extrabold shrink-0">
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
              class="p-3.5 rounded-xl bg-[#00A86B]/15 border-2 border-[#00A86B] flex flex-wrap items-center justify-between gap-2 text-xs text-[#121316]"
            >
              <div>
                <strong>✅ Google Tasks Notification Active:</strong> Synced ${this.lastSyncedSyllabusTitles.length} remaining ${user.targetExam} chapters to your Google Tasks reminders!
              </div>
              <span class="font-mono-tabular text-[11px] font-extrabold text-[#00A86B]">
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
            <!-- 1. BESPOKE TACTILE WEEKLY SPRINT & DAILY CHECKLIST WIDGET (+75 XP PER TASK) -->
            <section
              aria-label="Weekly Schedule and Daily Task Planner"
              data-testid="cute-weekly-schedule-section"
              class="bento-widget-card p-5 sm:p-6 space-y-5"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#18181B]/10">
                <div class="space-y-1">
                  <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#121316] text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                    <span>⚡ DAILY SPRINT BOARD</span>
                    <span>·</span>
                    <span class="text-[#34D399]">+${XP_PER_COMPLETED_TASK} XP PER TASK</span>
                  </div>
                  <h2 class="text-lg sm:text-xl font-extrabold text-[#121316]">
                    Weekly Schedule &amp; Daily Execution Checklist
                  </h2>
                  <p class="text-xs text-zinc-600">
                    Structure your daily study blocks and check off completed targets to earn <strong class="text-[#FF4D1C]">+${XP_PER_COMPLETED_TASK} XP</strong> per task.
                  </p>
                </div>

                <!-- Tactile Daily Goal Gauge -->
                <div
                  data-testid="daily-goal-progress-ring"
                  class="flex items-center gap-3.5 bg-[#121316] text-white border-2 border-[#18181B] rounded-2xl px-4 py-2.5 shadow-[0_3px_0_#FF4D1C]"
                >
                  <div class="relative w-14 h-14 flex items-center justify-center shrink-0">
                    <svg class="w-14 h-14 -rotate-90" viewBox="0 0 88 88">
                      <circle
                        cx="44"
                        cy="44"
                        r="${radius}"
                        stroke="#27272A"
                        stroke-width="7"
                        fill="transparent"
                      />
                      <circle
                        id="daily-goal-ring-circle"
                        cx="44"
                        cy="44"
                        r="${radius}"
                        stroke="${goalProgress.goalMet ? '#00A86B' : '#FF4D1C'}"
                        stroke-width="7"
                        stroke-linecap="round"
                        fill="transparent"
                        stroke-dasharray="${goalProgress.circumference.toFixed(2)}"
                        stroke-dashoffset="${goalProgress.strokeDashoffset.toFixed(2)}"
                      />
                    </svg>
                    <span
                      id="daily-goal-ring-pct"
                      class="absolute text-[11px] font-mono-tabular font-extrabold text-white"
                    >
                      ${goalProgress.goalProgressPct}%
                    </span>
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-extrabold text-white">Daily Target</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-extrabold ${
                        goalProgress.goalMet
                          ? 'bg-[#00A86B] text-white'
                          : 'bg-[#FF4D1C] text-white'
                      }">
                        ${goalProgress.goalMet ? 'COMPLETE' : 'ACTIVE'}
                      </span>
                    </div>
                    <div class="text-[11px] font-mono-tabular text-zinc-300">
                      <strong class="text-white">${goalProgress.completedTasks}</strong> / <strong class="text-[#FF4D1C]">${goalProgress.dailyGoalTarget}</strong> done
                    </div>
                    <div class="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="-1"
                        aria-label="Decrease daily goal target"
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                      >
                        −
                      </button>
                      <span class="text-[10px] font-mono-tabular font-bold text-zinc-300">${goalProgress.dailyGoalTarget}/day</span>
                      <button
                        type="button"
                        data-action="adjust-daily-goal"
                        data-delta="1"
                        aria-label="Increase daily goal target"
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
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
                      class="py-2.5 px-1 sm:px-2.5 rounded-xl border-2 text-xs font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        active
                          ? 'bg-[#121316] border-[#121316] text-white shadow-[0_3px_0_#FF4D1C] -translate-y-0.5'
                          : 'bg-[#F4F0EA] border-[#18181B]/20 text-[#121316] hover:border-[#18181B]'
                      }"
                    >
                      <span class="text-[9px] font-mono-tabular ${active ? 'text-[#FF4D1C]' : 'text-zinc-500'}">${dayCodes[idx % dayCodes.length]}</span>
                      <span>${day}</span>
                      <span class="font-mono-tabular text-[10px] px-1.5 py-0.2 rounded ${
                        active ? 'bg-[#FF4D1C] text-white' : 'bg-white text-[#121316]'
                      }">${countForDay}</span>
                    </button>
                  `;
                }).join('')}
              </div>

              <!-- Add To-Do Task Form -->
              <form id="smart-todo-form" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[#F4F0EA] p-3.5 rounded-2xl border-2 border-[#18181B]">
                <input
                  id="new-todo-title"
                  data-testid="home-todo-input"
                  type="text"
                  required
                  maxlength="200"
                  placeholder="Add study mission for ${this.selectedDay} (+${XP_PER_COMPLETED_TASK} XP)..."
                  aria-label="New task description"
                  class="sm:col-span-5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border-2 border-[#18181B] text-xs sm:text-sm font-bold text-[#121316] placeholder:text-zinc-400 focus:outline-none"
                />
                <select
                  id="new-todo-subject"
                  aria-label="Task Subject"
                  class="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-xl bg-white border-2 border-[#18181B] text-xs font-extrabold text-[#121316] focus:outline-none"
                >
                  ${subjects
                    .map((s) => `<option value="${s}">${s}</option>`)
                    .join('')}
                </select>
                <select
                  id="new-todo-priority"
                  aria-label="Task Priority"
                  class="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-white border-2 border-[#18181B] text-xs font-extrabold text-[#121316] focus:outline-none"
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
                      class="min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border-2 ${
                        this.selectedSubjectFilter === sub
                          ? 'bg-[#121316] text-white border-[#121316]'
                          : 'bg-white text-[#121316] border-[#18181B]/20 hover:border-[#18181B]'
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
                  class="text-xs font-extrabold text-[#FF4D1C] hover:underline"
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
                  class="p-6 rounded-2xl bg-[#F4F0EA] border-2 border-dashed border-[#18181B]/40 text-center space-y-2"
                >
                  <div class="text-2xl">🎯</div>
                  <div class="text-sm font-extrabold text-[#121316]">
                    No tasks scheduled for ${this.selectedDay} yet
                  </div>
                  <p class="text-xs text-zinc-600 max-w-md mx-auto">
                    Add your first study block above (e.g. solving 20 PYQs or completing chapter notes). Every completed task awards <strong class="text-[#00A86B]">+${XP_PER_COMPLETED_TASK} XP</strong>!
                  </p>
                </div>
              `
                  : `
                <div class="space-y-2.5" role="list">
                  ${filteredTasks
                    .map((task) => {
                      const prio = task.priority ?? 'Medium';
                      const prioColor =
                        prio === 'High'
                          ? 'text-[#FF4D1C] bg-[#FF4D1C]/10 border-[#FF4D1C]/30'
                          : prio === 'Medium'
                            ? 'text-amber-800 bg-amber-100 border-amber-300'
                            : 'text-[#00A86B] bg-[#00A86B]/10 border-[#00A86B]/30';
                      return `
                      <div
                        role="listitem"
                        class="p-3.5 bg-white border-2 border-[#18181B] rounded-2xl flex items-start justify-between gap-3 shadow-[0_2px_0_#18181B] transition-all"
                      >
                        <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            data-action="toggle-task"
                            data-task-id="${task.taskId}"
                            ${task.isCompleted ? 'checked' : ''}
                            class="mt-0.5 w-5 h-5 rounded border-[#18181B] accent-[#00A86B] cursor-pointer shrink-0"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="text-sm font-extrabold ${
                              task.isCompleted
                                ? 'line-through text-zinc-400'
                                : 'text-[#121316]'
                            }">
                              ${this.escapeHtml(task.title)}
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                              <span class="px-2 py-0.5 rounded bg-[#121316] text-white font-mono-tabular font-bold">${task.subject}</span>
                              <span class="px-2 py-0.5 rounded border font-bold ${prioColor}">
                                ${prio}
                              </span>
                              <span class="px-2 py-0.5 rounded bg-[#00A86B]/15 text-[#00A86B] font-mono-tabular font-extrabold">
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
                          class="min-h-[32px] min-w-[32px] rounded-xl text-zinc-400 hover:text-[#FF4D1C] hover:bg-red-50 inline-flex items-center justify-center transition-colors cursor-pointer"
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

            <!-- 2. 7-DAY STREAK CONSISTENCY MATRIX WIDGET -->
            <section
              aria-label="7-Day Visual Streak Calendar Strip"
              data-testid="streak-calendar-strip"
              class="bento-widget-card p-5 sm:p-6 space-y-4"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-2xl bg-[#121316] border-2 border-[#18181B] flex items-center justify-center shrink-0">
                    ${this.renderLucideStreakIcon('Flame', true)}
                  </div>
                  <div>
                    <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#FF4D1C]">
                      CONSISTENCY MATRIX
                    </span>
                    <h2 class="text-sm sm:text-base font-extrabold text-[#121316]">
                      🔥 ${user.currentStreak}-Day Active Streak &amp; 7-Day Telemetry
                    </h2>
                  </div>
                </div>
                <span class="text-xs font-mono-tabular font-extrabold text-white bg-[#121316] px-3 py-1.5 rounded-xl border border-[#18181B]">
                  ⚡ Total XP: ${user.xpPoints ?? 0} XP
                </span>
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
                      ? 'bg-[#121316] text-white border-2 border-[#18181B] shadow-[0_3px_0_#FF4D1C]'
                      : d.isToday
                        ? 'bg-[#F4F0EA] border-2 border-[#FF4D1C] text-[#121316]'
                        : 'bg-[#F4F0EA] border-2 border-[#18181B]/20 text-[#121316] hover:border-[#18181B]';

                    return `
                      <button
                        type="button"
                        role="listitem"
                        data-action="select-calendar-day"
                        data-date-iso="${d.dateIso}"
                        data-day-short="${d.dayShort}"
                        data-streak-day="${d.dateIso}"
                        data-streak-status="${d.status}"
                        class="rounded-2xl p-2 flex flex-col items-center justify-between gap-1 transition-all cursor-pointer text-center ${cardStyle}"
                      >
                        <div class="text-[10px] font-mono-tabular font-extrabold uppercase ${
                          isSelectedDate ? 'text-[#FF4D1C]' : 'text-zinc-600'
                        }">
                          ${d.dayLabel}
                        </div>
                        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white border border-[#18181B]/20 flex items-center justify-center">
                          ${this.renderLucideStreakIcon(d.lucideIcon, d.isToday)}
                        </div>
                        <span class="px-1.5 py-0.5 rounded font-mono-tabular text-[9px] font-extrabold ${
                          isSelectedDate
                            ? 'bg-[#FF4D1C] text-white'
                            : 'bg-white text-[#121316]'
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
                class="p-3 rounded-xl bg-[#F4F0EA] border-2 border-[#18181B] flex items-center justify-between text-xs text-[#121316]"
              >
                <span>📅 <strong>${activeCalendarDay.dayLabel}:</strong> ${calendarDayTasks.length} scheduled task(s)</span>
                <span class="font-mono-tabular font-extrabold text-[#00A86B]">
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
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#18181B]/10">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#FF4D1C]">
                    BACKLOG DECOMPRESSOR
                  </span>
                  <h2 class="text-base sm:text-lg font-extrabold text-[#121316] mt-0.5">
                    Backlog Killer Micro-Task Split
                  </h2>
                </div>
                <div class="text-xs font-mono-tabular px-3 py-1 rounded-xl bg-[#121316] text-[#FBBF24] font-extrabold">
                  Quota: ${(Math.round((this.backlogHours / Math.max(1, this.backlogDays)) * 10) / 10).toFixed(1)} hrs / day
                </div>
              </div>

              <form id="backlog-killer-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="backlog-subject" class="block text-xs font-extrabold text-[#121316] mb-1">
                    1. Select Subject
                  </label>
                  <select
                    id="backlog-subject"
                    class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F4F0EA] border-2 border-[#18181B] text-sm font-bold text-[#121316]"
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
                  <label for="backlog-chapter" class="block text-xs font-extrabold text-[#121316] mb-1">
                    2. Pending Chapter Name
                  </label>
                  <input
                    id="backlog-chapter"
                    type="text"
                    required
                    value="${this.escapeHtml(this.backlogChapter)}"
                    placeholder="e.g., Rotational Mechanics & IAOR"
                    class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F4F0EA] border-2 border-[#18181B] text-sm font-bold text-[#121316]"
                  />
                </div>

                <div>
                  <label for="backlog-hours" class="block text-xs font-extrabold text-[#121316] mb-1">
                    3. Pending Hours (<span id="backlog-hours-val" class="font-mono-tabular text-[#FF4D1C]">${this.backlogHours} hrs</span>)
                  </label>
                  <input
                    id="backlog-hours"
                    type="range"
                    min="2"
                    max="40"
                    step="1"
                    value="${this.backlogHours}"
                    class="w-full accent-[#FF4D1C] cursor-pointer"
                  />
                </div>

                <div>
                  <label for="backlog-days" class="block text-xs font-extrabold text-[#121316] mb-1">
                    4. Target Days (<span id="backlog-days-val" class="font-mono-tabular text-[#00A86B]">${this.backlogDays} days</span>)
                  </label>
                  <input
                    id="backlog-days"
                    type="range"
                    min="1"
                    max="21"
                    step="1"
                    value="${this.backlogDays}"
                    class="w-full accent-[#00A86B] cursor-pointer"
                  />
                </div>

                <div class="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 bg-[#F4F0EA] p-3.5 rounded-xl border-2 border-[#18181B]">
                  <div class="text-xs text-zinc-700">
                    Splits <strong class="text-[#121316]">${this.backlogHours}h</strong> across <strong class="text-[#121316]">${this.backlogDays} days</strong> and adds 3 micro-tasks (worth <strong class="text-[#00A86B]">+${XP_PER_COMPLETED_TASK * 3} XP</strong>) to your To-Do list.
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
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#18181B]/10">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#00A86B]">
                    ADAPTIVE TIMETABLE ARCHITECT
                  </span>
                  <h2 class="text-base sm:text-lg font-extrabold text-[#121316] mt-0.5">
                    Personalized 4-Week Study Plan
                  </h2>
                </div>
                <span class="text-xs font-mono-tabular font-extrabold text-white bg-[#121316] px-3 py-1 rounded-xl">
                  ${studyPlan.dailyHours}h/day · ${studyPlan.dailyHours * 7}h/week
                </span>
              </div>

              <div class="bg-[#F4F0EA] border-2 border-[#18181B] rounded-2xl p-4 space-y-4">
                <div class="flex items-center justify-between">
                  <label for="home-plan-hours" class="text-xs font-extrabold text-[#121316]">
                    Preferred Study Duration Per Day
                  </label>
                  <span id="home-plan-hours-label" class="text-xs font-mono-tabular font-extrabold text-[#FF4D1C]">
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
                  class="w-full accent-[#FF4D1C] cursor-pointer"
                />

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${subjects
                    .map((sub) => {
                      const currentLevel = this.planProficiency[sub] ?? 'Moderate';
                      return `
                      <div class="bg-white border-2 border-[#18181B] rounded-xl p-3 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-extrabold text-[#121316]">${sub}</span>
                          <span class="text-[11px] font-mono-tabular font-extrabold ${
                            currentLevel === 'Weak'
                              ? 'text-[#FF4D1C]'
                              : currentLevel === 'Moderate'
                                ? 'text-amber-600'
                                : 'text-[#00A86B]'
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
                                    ? 'bg-[#FF4D1C] text-white'
                                    : lvl === 'Moderate'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-[#00A86B] text-white'
                                  : 'bg-[#F4F0EA] text-zinc-700 hover:bg-zinc-200'
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
                    class="min-h-[38px] px-5 py-2 rounded-xl bg-[#121316] hover:bg-zinc-800 text-white text-xs font-extrabold shadow-[0_3px_0_#FF4D1C] transition-colors cursor-pointer"
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
                    class="min-h-[38px] rounded-xl border-2 text-xs font-mono-tabular font-extrabold transition-colors cursor-pointer ${
                      this.selectedPlanWeek === wk.weekNumber
                        ? 'bg-[#121316] border-[#121316] text-white shadow-[0_2px_0_#FF4D1C]'
                        : 'bg-[#F4F0EA] border-[#18181B]/20 text-[#121316] hover:border-[#18181B]'
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
                  <div class="p-3.5 rounded-xl bg-[#F4F0EA] border-2 border-[#18181B] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="space-y-0.5">
                      <div class="text-xs font-extrabold text-[#121316]">
                        ${alloc.subject} · <span class="text-[#FF4D1C] font-mono-tabular">${alloc.allocatedHoursPerWeek} hrs/wk</span>
                      </div>
                      <p class="text-xs text-zinc-600">${this.escapeHtml(alloc.focusTopics)}</p>
                    </div>
                    <a
                      href="${alloc.recommendedModule === 'cbt' ? '/test.html' : '/study.html'}"
                      class="text-xs font-extrabold text-[#121316] bg-white px-3 py-1.5 rounded-lg border border-[#18181B] hover:bg-[#FF4D1C] hover:text-white transition-colors shrink-0"
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
            <!-- REAL WEEKLY ASPIRANT LEADERBOARD WIDGET (Renews Every Week, Rank #1 if Solo) -->
            <section
              data-testid="real-weekly-leaderboard"
              class="obsidian-widget-card p-5 space-y-4"
            >
              <div class="flex items-center justify-between pb-3 border-b border-white/15">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#FF4D1C]">
                      🏆 WEEKLY LEAGUE
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white/10 text-[#34D399] text-[9px] font-mono-tabular font-extrabold">
                      ${currentWeekKey}
                    </span>
                  </div>
                  <h3 class="text-base font-extrabold text-white mt-0.5">
                    Live Student Standings
                  </h3>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    data-testid="current-user-level-badge"
                    class="px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 text-xs font-mono-tabular font-extrabold text-[#34D399]"
                  >
                    ⭐ Lv.${rankAndLevel.level}
                  </span>
                  <span
                    data-testid="current-user-rank-badge"
                    class="px-2.5 py-1 rounded-xl bg-[#FF4D1C] text-xs font-mono-tabular font-extrabold text-white"
                  >
                    Rank #${leaderboardStandings.currentUserRank}
                  </span>
                </div>
              </div>

              ${
                leaderboardStandings.currentUserEntry
                  ? `
                <div class="p-3.5 rounded-2xl bg-[#1C1E24] border border-white/15 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <span class="text-[#FBBF24]">🥇 #${leaderboardStandings.currentUserRank}</span>
                      <span>${this.escapeHtml(leaderboardStandings.currentUserEntry.name)} (${user.isGuest ? 'Guest Preview' : 'Enrolled'})</span>
                    </div>
                    <div class="text-[11px] font-mono-tabular text-zinc-400 mt-0.5">
                      🔥 ${user.currentStreak}d Streak · ⚡ ${user.xpPoints ?? 0} XP · ⭐ Lv.${rankAndLevel.level}
                    </div>
                  </div>
                  <div class="text-sm font-mono-tabular font-extrabold text-[#FF4D1C]">
                    ${leaderboardStandings.currentUserEntry.compositePoints} pts
                  </div>
                </div>
              `
                  : ''
              }

              <div class="divide-y divide-white/10 max-h-[320px] overflow-y-auto">
                ${leaderboardStandings.top10
                  .map((entry) => {
                    const isMe = entry.uid === user.uid;
                    return `
                    <div class="py-2.5 px-2.5 flex items-center justify-between text-xs ${
                      isMe ? 'bg-white/10 font-bold rounded-xl' : ''
                    }">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="font-mono-tabular font-extrabold w-6 ${
                          entry.rank === 1 ? 'text-[#FBBF24]' : 'text-zinc-400'
                        }">#${entry.rank}</span>
                        <div class="truncate">
                          <div class="text-white truncate font-bold">${this.escapeHtml(entry.name)}</div>
                          <div class="text-[10px] text-zinc-400 font-mono-tabular">${entry.targetExam} · ${entry.currentStreak}d streak</div>
                        </div>
                      </div>
                      <span class="font-mono-tabular font-extrabold text-[#34D399]">${entry.compositePoints} pts</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>

              <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-300 text-center">
                Complete To-Do tasks (<strong class="text-[#34D399]">+${XP_PER_COMPLETED_TASK} XP</strong> each) and Mock Tests to climb the weekly league!
              </div>
            </section>

            <!-- Mentor Live Directory & Quick Connect Widget -->
            <section class="bento-widget-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#00A86B]">
                  <span class="w-2 h-2 rounded-full bg-[#00A86B] animate-pulse"></span>
                  Founder &amp; Head Mentor
                </span>
                <span class="text-[11px] font-mono-tabular text-[#121316] font-extrabold">1:1 Mentorship</span>
              </div>

              <div class="space-y-2.5">
                ${mentors
                  .map(
                    (m) => `
                  <div class="p-3 rounded-xl bg-[#F4F0EA] border-2 border-[#18181B] flex items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="relative shrink-0">
                        <img
                          src="${m.avatarUrl}"
                          alt="${this.escapeHtml(m.name)}"
                          referrerpolicy="no-referrer"
                          class="w-10 h-10 rounded-full object-cover border-2 border-[#18181B]"
                        />
                        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          m.isOnline !== false ? 'bg-[#00A86B]' : 'bg-zinc-400'
                        }"></span>
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-xs font-extrabold text-[#121316] truncate">${this.escapeHtml(m.name)}</h3>
                        <p class="text-[11px] text-zinc-600 truncate">${this.escapeHtml(m.subjectSpecialty)} · ${m.isOnline !== false ? '🟢 Online' : '⚪ Offline'}</p>
                      </div>
                    </div>
                    <a
                      href="/mentorship.html"
                      class="px-3 py-1.5 rounded-lg bg-[#121316] hover:bg-[#FF4D1C] text-white text-[11px] font-extrabold shrink-0 transition-colors"
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
                  class="min-h-[40px] px-3 py-2 rounded-xl bg-[#F4F0EA] hover:bg-zinc-200 border-2 border-[#18181B] text-[#121316] text-xs font-extrabold flex items-center justify-center transition-colors"
                >
                  Test Analytics
                </a>
              </div>
            </section>

            <!-- Subject Accuracy Snapshot Widget -->
            <section class="bento-widget-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#FF4D1C]">
                    MOCK EXAM ANALYTICS
                  </span>
                  <h3 class="text-sm sm:text-base font-extrabold text-[#121316]">
                    Subject Accuracy Snapshot
                  </h3>
                </div>
                <a
                  href="/test-history.html"
                  data-testid="home-open-test-history-link"
                  class="px-2.5 py-1 rounded-lg bg-[#121316] text-white text-xs font-extrabold"
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
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
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

          <div class="space-y-1.5 max-h-[220px] overflow-y-auto p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            ${
              previewList.length === 0
                ? `<div class="text-xs font-bold text-[#10B981]">🎉 All ${targetExam} syllabus chapters are already completed!</div>`
                : previewList
                    .map(
                      (t, idx) => `
                  <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span class="font-semibold text-slate-800">${idx + 1}. [${t.subject}] ${this.escapeHtml(t.chapterName)}</span>
                    <span class="font-mono-tabular text-[10px] text-[#4F46E5] font-bold">${this.escapeHtml(t.weightageLabel || 'High Yield')}</span>
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
              class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm cursor-pointer"
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
            this.callbacks.onShowToast(
              `🎉 +${XP_PER_COMPLETED_TASK} XP earned! Total XP: ${dataStore.getUser().xpPoints ?? 0} XP`
            );
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
