import { getCohortTheme, WEEK_DAYS } from '../constants';
import { dataStore } from '../services/firebaseService';
import { workspaceConnector } from '../services/workspaceService';
import type { PageId, SubjectName, TaskPriority } from '../types';
import {
  calculateBacklogKillerPlan,
  calculateDailyGoalProgress,
  computeUpdatedStreak,
  getSubjectsForExam,
} from '../utils/examLogic';

export class PlannerModule {
  private container: HTMLElement | null = null;
  private selectedDay: string = 'Wed';
  private activeFilter: 'ALL' | 'Today' | 'Backlog' | 'COMPLETED' = 'ALL';
  private activeSubjectFilter: SubjectName | 'ALL' = 'ALL';
  private backlogChaptersInput = 'Rotational Motion, IAOR & Pure Rolling PYQs';
  private backlogSubject: SubjectName = 'Physics';
  private backlogHours = 9;
  private backlogDays = 6;
  private isConfirmSyncModalOpen = false;
  private isSyncingGoogleWorkspace = false;
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

    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const allTasks = dataStore.getTasks();
    const validSubjects = getSubjectsForExam(user.targetExam);
    const dailyTarget = dataStore.getDailyGoalTarget();
    const goalRing = calculateDailyGoalProgress(allTasks, dailyTarget, 34);
    const scheduleSyncs = workspaceConnector.getScheduleSyncRecords();
    const isGoogleTokenActive = workspaceConnector.hasActiveAccessToken();

    const filteredTasks = allTasks.filter((t) => {
      if (this.activeFilter === 'Today' && t.type !== 'Today') return false;
      if (this.activeFilter === 'Backlog' && t.type !== 'Backlog') return false;
      if (this.activeFilter === 'COMPLETED' && !t.isCompleted) return false;
      if (this.activeSubjectFilter !== 'ALL' && t.subject !== this.activeSubjectFilter)
        return false;
      return true;
    });

    const todayPendingCount = allTasks.filter((t) => t.type === 'Today' && !t.isCompleted).length;
    const backlogPendingCount = allTasks.filter(
      (t) => t.type === 'Backlog' && !t.isCompleted
    ).length;
    const completedTotal = allTasks.filter((t) => t.isCompleted).length;
    const dailyExtraQuota = Math.round((this.backlogHours / Math.max(1, this.backlogDays)) * 10) / 10;

    this.container.innerHTML = `
      <div class="space-y-5 pb-10" data-testid="dedicated-planner-page">
        <!-- Compact Professional Header Banner -->
        <section class="bg-gradient-to-r ${cohortTheme.gradientClass} rounded-2xl p-4 sm:p-6 text-white shadow-md">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5">
              <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[10px] font-extrabold uppercase tracking-wider">
                <span>⚡ Dedicated Workspace · ${this.escapeHtml(cohortTheme.label)}</span>
              </div>
              <h1 data-edit-key="planner-main-heading" class="text-xl sm:text-2xl font-extrabold tracking-tight">
                Smart To-Do List & Backlog Killer Engine
              </h1>
              <p class="text-xs sm:text-sm text-white/90 max-w-2xl">
                Lightweight, zero-clutter task execution workspace synced in real time with Firebase Firestore, Google Calendar & Google Tasks.
              </p>
            </div>

            <!-- Compact Stats Strip -->
            <div class="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
              <div class="px-3 py-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 text-center">
                <div class="text-[10px] uppercase font-bold text-white/80">Today Open</div>
                <div class="text-base sm:text-lg font-mono-tabular font-extrabold">${todayPendingCount}</div>
              </div>
              <div class="px-3 py-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 text-center">
                <div class="text-[10px] uppercase font-bold text-white/80">Backlogs</div>
                <div class="text-base sm:text-lg font-mono-tabular font-extrabold">${backlogPendingCount}</div>
              </div>
              <div class="px-3 py-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 text-center">
                <div class="text-[10px] uppercase font-bold text-white/80">Done</div>
                <div class="text-base sm:text-lg font-mono-tabular font-extrabold">${completedTotal}/${allTasks.length}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- GOOGLE CALENDAR & GOOGLE TASKS MULTI-DEVICE SYNC BAR -->
        <section
          data-testid="planner-workspace-sync-bar"
          class="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
                🗓️ Google Calendar & Google Tasks Sync
              </span>
              <span class="text-[11px] font-mono-tabular font-bold text-slate-600">
                ${scheduleSyncs.filter((s) => s.calendarEventStatus === 'SYNCED').length}/${scheduleSyncs.length} schedule blocks synced across devices
              </span>
            </div>
            <p class="text-xs text-slate-500">
              Automatically mirror your daily JEE/NEET study blocks and pending tasks to Google Calendar & Google Tasks across mobile, tablet, and desktop.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-planner-action="workspace-signin"
              class="min-h-[38px] px-3 py-1.5 rounded-xl border ${
                isGoogleTokenActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              } text-xs font-extrabold transition-all"
            >
              ${isGoogleTokenActive ? '✓ Google OAuth Active' : '🔐 Connect Google OAuth'}
            </button>
            <button
              type="button"
              data-testid="planner-open-sync-confirm-btn"
              data-planner-action="open-sync-confirm"
              class="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all"
            >
              ${this.isSyncingGoogleWorkspace ? '⏳ Syncing...' : '🔄 Sync to Google Calendar & Tasks'}
            </button>
          </div>
        </section>

        <!-- Main 12-Col Responsive Split: Left 7 Cols Smart To-Do List | Right 5 Cols Backlog Killer Engine -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <!-- LEFT 7 COLS: SMART TO-DO LIST WORKSPACE -->
          <div class="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                  Daily Execution Queue
                </span>
                <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                  Smart Priority To-Do List
                </h2>
              </div>

              <!-- Filter Pills -->
              <div class="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                ${(
                  [
                    { id: 'ALL', label: `All (${allTasks.length})` },
                    { id: 'Today', label: `Today (${todayPendingCount})` },
                    { id: 'Backlog', label: `Backlog (${backlogPendingCount})` },
                    { id: 'COMPLETED', label: `Done (${completedTotal})` },
                  ] as const
                )
                  .map(
                    (tab) => `
                  <button
                    type="button"
                    data-planner-action="filter-bucket"
                    data-bucket="${tab.id}"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      this.activeFilter === tab.id
                        ? 'bg-white text-[#4F46E5] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }"
                  >
                    ${tab.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Subject Filter & Quick Day Selector -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  data-planner-action="filter-subject"
                  data-subject="ALL"
                  class="px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    this.activeSubjectFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }"
                >
                  All Subjects
                </button>
                ${(['Physics', 'Chemistry', 'Math', 'Biology'] as SubjectName[])
                  .map(
                    (sub) => `
                  <button
                    type="button"
                    data-planner-action="filter-subject"
                    data-subject="${sub}"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      this.activeSubjectFilter === sub
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }"
                  >
                    ${sub}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div class="flex items-center gap-1">
                ${WEEK_DAYS.map(
                  (d) => `
                  <button
                    type="button"
                    data-planner-action="select-day"
                    data-day="${d}"
                    class="px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                      this.selectedDay === d
                        ? 'bg-indigo-100 text-[#4F46E5]'
                        : 'text-slate-500 hover:bg-slate-100'
                    }"
                  >
                    ${d}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <!-- Fast 1-Line Add Task Form -->
            <form id="planner-add-task-form" class="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
              <input
                id="planner-task-title"
                type="text"
                required
                placeholder="Add high-priority study task or PYQ target..."
                class="sm:col-span-6 min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#4F46E5]"
              />
              <select
                id="planner-task-subject"
                aria-label="Subject"
                class="sm:col-span-2 min-h-[40px] px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800"
              >
                ${validSubjects.map((s) => `<option value="${s}">${s}</option>`).join('')}
              </select>
              <select
                id="planner-task-priority"
                aria-label="Priority"
                class="sm:col-span-2 min-h-[40px] px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800"
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <button
                type="submit"
                class="sm:col-span-2 min-h-[40px] px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-2xs"
              >
                + Add Task
              </button>
            </form>

            <!-- Lightweight Scrollable Task Cards -->
            <div class="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              ${
                filteredTasks.length === 0
                  ? `
                <div class="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                  <div class="text-sm font-bold text-slate-700">No tasks match this filter</div>
                  <p class="text-xs text-slate-500">Add a new task above or use the Backlog Killer Engine to generate micro-tasks.</p>
                </div>
              `
                  : filteredTasks
                      .map((task) => {
                        const priorityBadge =
                          task.priority === 'High'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200';
                        return `
                        <div class="p-3 rounded-xl border ${
                          task.isCompleted
                            ? 'bg-emerald-50/40 border-emerald-200/80'
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        } flex items-center justify-between gap-3 transition-all">
                          <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              data-planner-action="toggle-task"
                              data-task-id="${task.taskId}"
                              ${task.isCompleted ? 'checked' : ''}
                              class="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#10B981] focus:ring-[#4F46E5] shrink-0"
                            />
                            <div class="min-w-0 flex-1">
                              <div class="text-xs sm:text-sm font-bold ${
                                task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                              } leading-snug">
                                ${this.escapeHtml(task.title)}
                              </div>
                              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#4F46E5]">
                                  ${task.subject}
                                </span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${priorityBadge}">
                                  ${task.priority ?? 'High'}
                                </span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold ${
                                  task.type === 'Backlog'
                                    ? 'bg-amber-100/80 text-amber-800'
                                    : 'bg-emerald-100/80 text-emerald-800'
                                }">
                                  ${task.type}
                                </span>
                                ${
                                  task.dailyQuotaHours
                                    ? `<span class="text-[10px] font-mono-tabular text-slate-500">⏱ ${task.dailyQuotaHours}h/day</span>`
                                    : ''
                                }
                              </div>
                            </div>
                          </label>

                          <button
                            type="button"
                            data-planner-action="delete-task"
                            data-task-id="${task.taskId}"
                            title="Delete task"
                            class="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      `;
                      })
                      .join('')
              }
            </div>
          </div>

          <!-- RIGHT 5 COLS: BACKLOG KILLER ENGINE & DAILY GOAL PROGRESS -->
          <div class="lg:col-span-5 space-y-5">
            <!-- Backlog Killer Calculator Card -->
            <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                    Automated Micro-Task Generator
                  </span>
                  <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                    Backlog Killer Engine
                  </h2>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono-tabular text-xs font-extrabold">
                  +${dailyExtraQuota}h / day
                </span>
              </div>

              <p class="text-xs text-slate-600 leading-relaxed">
                Enter your pending chapter, hours required, and target days. The engine computes your daily extra study quota and injects 3 structured micro-tasks into your Smart To-Do List.
              </p>

              <form id="planner-backlog-form" class="space-y-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Pending Chapter / Topic</label>
                  <input
                    id="planner-backlog-chapter"
                    type="text"
                    required
                    value="${this.escapeHtml(this.backlogChaptersInput)}"
                    class="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div class="grid grid-cols-3 gap-2.5">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                    <select
                      id="planner-backlog-subject"
                      class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-slate-800"
                    >
                      ${validSubjects
                        .map(
                          (s) =>
                            `<option value="${s}" ${this.backlogSubject === s ? 'selected' : ''}>${s}</option>`
                        )
                        .join('')}
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Pending Hours</label>
                    <input
                      id="planner-backlog-hours"
                      type="number"
                      min="1"
                      max="100"
                      value="${this.backlogHours}"
                      class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 font-mono-tabular text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Target Days</label>
                    <input
                      id="planner-backlog-days"
                      type="number"
                      min="1"
                      max="45"
                      value="${this.backlogDays}"
                      class="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 font-mono-tabular text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs">
                  <span class="font-semibold text-amber-900">Calculated Daily Backlog Quota:</span>
                  <span class="font-mono-tabular font-extrabold text-amber-800">${dailyExtraQuota} hrs/day × ${this.backlogDays} days</span>
                </div>

                <button
                  type="submit"
                  class="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white text-xs font-extrabold transition-colors shadow-xs"
                >
                  ⚡ Generate & Inject 3 Backlog Micro-Tasks
                </button>
              </form>
            </div>

            <!-- Daily Quota Ring & Quick Navigation Card -->
            <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
              <div class="space-y-1">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Daily Completion Ring
                </span>
                <div class="text-sm font-extrabold text-slate-900">
                  ${goalRing.completedCount} of ${goalRing.dailyGoalTarget} Daily Goal Tasks Done
                </div>
                <p class="text-xs text-slate-500">
                  Status: <strong class="text-slate-800">${goalRing.statusLabel}</strong>
                </p>
                <div class="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-planner-action="go-home"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                  >
                    ← Back to Dashboard
                  </button>
                  <button
                    type="button"
                    data-planner-action="go-test"
                    class="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#4F46E5] text-[11px] font-bold"
                  >
                    Attempt CBT Drill →
                  </button>
                </div>
              </div>

              <div class="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg class="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
                  <circle cx="42" cy="42" r="34" stroke="#E2E8F0" stroke-width="7" fill="none" />
                  <circle
                    cx="42"
                    cy="42"
                    r="34"
                    stroke="#10B981"
                    stroke-width="7"
                    stroke-linecap="round"
                    fill="none"
                    stroke-dasharray="${goalRing.circumference}"
                    stroke-dashoffset="${goalRing.strokeDashoffset}"
                  />
                </svg>
                <span class="absolute font-mono-tabular text-xs font-extrabold text-slate-900">
                  ${goalRing.percentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        ${this.renderWorkspaceSyncConfirmModal(allTasks)}
      </div>
    `;

    this.bindEvents();
  }

  private renderWorkspaceSyncConfirmModal(allTasks: ReturnType<typeof dataStore.getTasks>): string {
    if (!this.isConfirmSyncModalOpen) return '';
    const openTasks = allTasks.filter((t) => !t.isCompleted).slice(0, 5);
    return `
      <div
        data-testid="planner-workspace-sync-confirm-modal"
        class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
          <div class="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                Google Workspace Action Confirmation
              </span>
              <h3 class="text-base font-extrabold mt-0.5">
                Confirm Google Calendar & Google Tasks Multi-Device Sync
              </h3>
            </div>
            <button
              type="button"
              data-planner-action="cancel-sync-confirm"
              class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <div class="p-4 sm:p-5 space-y-3 text-xs text-slate-600">
            <p class="leading-relaxed">
              You are about to create or update the following <strong class="text-slate-900">${openTasks.length} study events & tasks</strong> in your primary <strong class="text-slate-900">Google Calendar</strong> (<code class="text-[11px] bg-slate-100 px-1 py-0.5 rounded">calendar/v3/calendars/primary/events</code>) and default <strong class="text-slate-900">Google Tasks</strong> list (<code class="text-[11px] bg-slate-100 px-1 py-0.5 rounded">tasks/v1/lists/@default/tasks</code>):
            </p>
            <div class="max-h-48 overflow-y-auto space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ${openTasks
                .map(
                  (t, idx) => `
                <div class="flex items-center justify-between gap-2 py-1 border-b border-slate-200/60 last:border-0">
                  <span class="font-bold text-slate-800 truncate">${idx + 1}. [${this.escapeHtml(t.subject)}] ${this.escapeHtml(t.title)}</span>
                  <span class="font-mono-tabular text-[10px] font-bold text-[#4F46E5] shrink-0">${t.type} · ${t.priority ?? 'High'}</span>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-planner-action="cancel-sync-confirm"
                class="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="planner-confirm-sync-btn"
                data-planner-action="confirm-workspace-sync"
                class="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-xs"
              >
                ✓ Confirm & Sync to Google Calendar + Tasks
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    const addForm = this.container.querySelector<HTMLFormElement>('#planner-add-task-form');
    addForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = addForm.querySelector<HTMLInputElement>('#planner-task-title');
      const subSelect = addForm.querySelector<HTMLSelectElement>('#planner-task-subject');
      const prioSelect = addForm.querySelector<HTMLSelectElement>('#planner-task-priority');
      const title = titleInput?.value.trim() || '';
      if (!title) return;

      await dataStore.addTask(
        title,
        (subSelect?.value as SubjectName) || 'Physics',
        'Today',
        {
          priority: (prioSelect?.value as TaskPriority) || 'High',
          dayOfWeek: this.selectedDay,
          dateIso: '2026-11-04',
        }
      );
      if (titleInput) titleInput.value = '';
      this.onShowToast('Task added and synced to Firebase Firestore!');
      this.render();
    });

    const backlogForm = this.container.querySelector<HTMLFormElement>('#planner-backlog-form');
    backlogForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ch =
        backlogForm.querySelector<HTMLInputElement>('#planner-backlog-chapter')?.value.trim() ||
        'Core Chapter';
      const sub =
        (backlogForm.querySelector<HTMLSelectElement>('#planner-backlog-subject')
          ?.value as SubjectName) || 'Physics';
      const hrs = Number(
        backlogForm.querySelector<HTMLInputElement>('#planner-backlog-hours')?.value || 6
      );
      const days = Number(
        backlogForm.querySelector<HTMLInputElement>('#planner-backlog-days')?.value || 4
      );

      this.backlogChaptersInput = ch;
      this.backlogSubject = sub;
      this.backlogHours = hrs;
      this.backlogDays = days;

      const user = dataStore.getUser();
      const plan = calculateBacklogKillerPlan({
        uid: user.uid,
        subject: sub,
        chapterName: ch,
        pendingHours: hrs,
        targetDays: days,
        examFocus: user.targetExam,
      });

      const backlogTasks = plan.microTasks.map((t) => ({
        ...t,
        type: 'Backlog' as const,
      }));
      await dataStore.addBatchTasks(backlogTasks);
      this.onShowToast(
        `Injected 3 Backlog Micro-Tasks (${plan.dailyQuotaHours}h/day) into your queue!`
      );
      this.render();
    });

    this.container
      .querySelectorAll<HTMLElement>('[data-planner-action]')
      .forEach((el) => {
        const action = el.dataset.plannerAction;
        if (action === 'toggle-task') {
          el.addEventListener('change', async () => {
            const taskId = el.dataset.taskId;
            if (!taskId) return;
            const toggled = await dataStore.toggleTaskCompletion(taskId);
            if (toggled?.isCompleted) {
              const user = dataStore.getUser();
              const streakRes = computeUpdatedStreak(
                user.currentStreak,
                user.lastActiveDate,
                '2026-11-04'
              );
              if (streakRes.incremented) {
                await dataStore.updateUser({
                  currentStreak: streakRes.currentStreak,
                  lastActiveDate: streakRes.lastActiveDate,
                });
              }
              this.onShowToast(`Completed: ${toggled.title}`);
            }
            this.render();
          });
          return;
        }

        el.addEventListener('click', async () => {
          if (action === 'filter-bucket') {
            this.activeFilter =
              (el.dataset.bucket as 'ALL' | 'Today' | 'Backlog' | 'COMPLETED') || 'ALL';
            this.render();
          } else if (action === 'filter-subject') {
            this.activeSubjectFilter = (el.dataset.subject as SubjectName | 'ALL') || 'ALL';
            this.render();
          } else if (action === 'select-day') {
            this.selectedDay = el.dataset.day || 'Wed';
            this.render();
          } else if (action === 'delete-task') {
            const taskId = el.dataset.taskId;
            if (taskId) {
              await dataStore.deleteTask(taskId);
              this.onShowToast('Task removed.');
              this.render();
            }
          } else if (action === 'go-home') {
            window.history.pushState({}, '', '/index.html');
            this.onNavigatePage('home');
          } else if (action === 'go-test') {
            window.history.pushState({}, '', '/test.html');
            this.onNavigatePage('test');
          } else if (action === 'workspace-signin') {
            const token = await workspaceConnector.signInWithGoogleWorkspace();
            this.onShowToast(
              token
                ? 'Connected Google Workspace OAuth for Calendar & Tasks!'
                : 'Google OAuth popup closed or running in local preview mode.'
            );
            this.render();
          } else if (action === 'open-sync-confirm') {
            this.isConfirmSyncModalOpen = true;
            this.render();
          } else if (action === 'cancel-sync-confirm') {
            this.isConfirmSyncModalOpen = false;
            this.render();
          } else if (action === 'confirm-workspace-sync') {
            this.isConfirmSyncModalOpen = false;
            this.isSyncingGoogleWorkspace = true;
            this.render();
            const synced = await workspaceConnector.syncStudyScheduleWithGoogleCalendarAndTasks();
            this.isSyncingGoogleWorkspace = false;
            this.onShowToast(
              `Synced ${synced.syncedCount} study events & tasks with Google Calendar & Google Tasks!`
            );
            this.render();
          }
        });
      });
  }

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
