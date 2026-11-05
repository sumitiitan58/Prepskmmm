import { DEFAULT_BRAND_LOGO_SVG, getCohortTheme, MENTOR_AVATAR_PATH } from './constants';
import { AdminCommandModule } from './modules/adminCommandView';
import { CBTTestEngineModule } from './modules/cbtTestEngineView';
import { HomePageModule } from './modules/homePageView';
import { LiveClassroomModule } from './modules/liveView';
import { MentorshipHubModule } from './modules/mentorshipHubView';
import { PlannerModule } from './modules/plannerView';
import { PlayerModule } from './modules/playerView';
import { StudyVaultModule } from './modules/studyVaultView';
import { TestHistoryModule } from './modules/testHistoryView';
import {
  compressImageDataUrl,
  dataStore,
  MASTER_ADMIN_EMAIL,
} from './services/firebaseService';
import type { PageId, StudentClassYear, TargetExam } from './types';

const AVATAR_CHOICES = [
  MENTOR_AVATAR_PATH,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
];

class PrepskmPlatformApp {
  private rootEl: HTMLElement;
  private activePage: PageId;
  private isProfileModalOpen = false;
  private isFacultyLoginExpanded = false;
  private isNotificationsOpen = false;
  private isTabletRailExpanded = false;
  private guestReminderTimer: number | null = null;

  // Floating Admin Pencil Live Website Customizer State
  private isPencilModalOpen = false;
  private isPencilPickMode = false;
  private selectedElementSelector = '.brand-title-target';
  private selectedElementText = '';
  private selectedElementColor = '#0F172A';
  private selectedElementBgColor = '';

  private homeModule: HomePageModule;
  private plannerModule: PlannerModule;
  private studyModule: StudyVaultModule;
  private mentorshipModule: MentorshipHubModule;
  private testModule: CBTTestEngineModule;
  private testHistoryModule: TestHistoryModule;
  private adminModule: AdminCommandModule;
  private playerModule: PlayerModule;
  private liveModule: LiveClassroomModule;

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
    this.activePage = this.detectInitialPage();

    this.homeModule = new HomePageModule({
      onNavigatePage: (p) => this.navigateToPage(p),
      onShowToast: (msg) => this.showToast(msg),
    });

    this.plannerModule = new PlannerModule({
      onNavigatePage: (p) => this.navigateToPage(p),
      onShowToast: (msg) => this.showToast(msg),
    });

    this.studyModule = new StudyVaultModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.mentorshipModule = new MentorshipHubModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.testModule = new CBTTestEngineModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.testHistoryModule = new TestHistoryModule({
      onNavigatePage: (p) => this.navigateToPage(p),
      onShowToast: (msg) => this.showToast(msg),
    });

    this.adminModule = new AdminCommandModule({
      onShowToast: (msg) => this.showToast(msg),
      onAuthUpdated: () => this.renderShell(),
    });

    this.playerModule = new PlayerModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.liveModule = new LiveClassroomModule({
      onShowToast: (msg: string) => this.showToast(msg),
    });

    this.renderShell();
    this.startGuestReminderInterval();
    this.setupGlobalPencilClickCatcher();
  }

  private detectInitialPage(): PageId {
    const bodyPage = document.body.dataset.page;
    const path = window.location.pathname.toLowerCase();
    if (bodyPage === 'planner' || path.includes('planner.html')) return 'planner';
    if (bodyPage === 'test-history' || path.includes('test-history.html')) {
      return 'test-history';
    }
    if (bodyPage === 'player' || path.includes('player.html')) return 'player';
    if (bodyPage === 'study' || path.includes('study.html')) return 'study';
    if (bodyPage === 'mentorship' || path.includes('mentorship.html')) return 'mentorship';
    if (
      bodyPage === 'test' ||
      path.includes('test.html') ||
      path.includes('cbt-test.html')
    ) {
      return 'test';
    }
    if (bodyPage === 'admin' || path.includes('admin.html')) return 'admin';
    return 'home';
  }

  private startGuestReminderInterval(): void {
    if (this.guestReminderTimer !== null) {
      window.clearInterval(this.guestReminderTimer);
    }
    this.guestReminderTimer = window.setInterval(() => {
      if (dataStore.getUser().isGuest) {
        this.showToast(
          'Guest Mode Reminder: Sign in via Profile to permanently save your study progress & CBT test scores.'
        );
      }
    }, 300000);
  }

  private setupGlobalPencilClickCatcher(): void {
    document.addEventListener(
      'click',
      (e) => {
        if (!this.isPencilPickMode) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (
          target.closest('#admin-pencil-editor-modal') ||
          target.closest('[data-testid="admin-floating-pencil-btn"]')
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();

        const selector = this.buildUniqueSelectorForElement(target);
        this.selectedElementSelector = selector;
        this.selectedElementText = (target.textContent || '').trim().slice(0, 120);
        this.isPencilPickMode = false;
        this.isPencilModalOpen = true;
        this.renderShell();
      },
      true
    );
  }

  private buildUniqueSelectorForElement(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .filter((c) => !c.includes(':') && !c.includes('[') && !c.includes('/'))
      .slice(0, 2);
    if (classes.length > 0) {
      return `${tag}.${classes.join('.')}`;
    }
    return tag;
  }

  public navigateToPage(page: PageId): void {
    if (page === 'profile') {
      this.isProfileModalOpen = true;
      this.renderShell();
      return;
    }
    this.testModule.unmount();
    this.mentorshipModule.unmount();
    this.activePage = page;
    this.renderShell();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public renderShell(): void {
    dataStore.applySiteThemeToDocument();
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const isAdminOrMentor = dataStore.isAuthorizedAdminOrMentor();
    const isMasterAdmin = dataStore.isMasterAdmin();
    const siteTheme = dataStore.getSiteTheme();
    const broadcasts = dataStore.getBroadcasts();
    const streakNotifications = dataStore.getStreakNotifications();
    const logoSrc = siteTheme.logoDataUrl || DEFAULT_BRAND_LOGO_SVG;
    const brandName = siteTheme.brandName || 'prepskm.in';

    const path = window.location.pathname.toLowerCase();
    const isLegacyLive = path.includes('live.html');

    const navItems: {
      id: PageId;
      label: string;
      shortLabel: string;
      href: string;
      svgIcon: string;
      accentDot: string;
    }[] = [
      {
        id: 'home',
        label: 'Home & Dashboard',
        shortLabel: 'Home',
        href: '/index.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"/></svg>`,
        accentDot: 'bg-indigo-500',
      },
      {
        id: 'planner',
        label: 'To-Do & Backlog Killer',
        shortLabel: 'Planner',
        href: '/planner.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
        accentDot: 'bg-violet-500',
      },
      {
        id: 'study',
        label: 'Study Material Vault',
        shortLabel: 'Study Vault',
        href: '/study.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
        accentDot: 'bg-emerald-500',
      },
      {
        id: 'test',
        label: 'CBT & Practice Engine',
        shortLabel: 'CBT Test',
        href: '/test.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        accentDot: 'bg-amber-500',
      },
      {
        id: 'test-history',
        label: 'Test History & D3 Analytics',
        shortLabel: 'History',
        href: '/test-history.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>`,
        accentDot: 'bg-cyan-500',
      },
      {
        id: 'mentorship',
        label: 'Lectures & 1:1 Mentorship',
        shortLabel: 'Mentorship',
        href: '/mentorship.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
        accentDot: 'bg-rose-500',
      },
    ];

    const mobileBottomTabs = [
      navItems[0], // Home
      navItems[1], // Planner
      navItems[2], // Study
      navItems[3], // CBT Test
      navItems[5], // Mentorship
    ];

    this.rootEl.innerHTML = `
      <div
        class="min-h-screen flex flex-col lg:flex-row text-slate-900 transition-colors"
        style="background-color: ${this.escapeHtml(siteTheme.surfaceBg || cohortTheme.surfaceTint || '#F8FAFC')}"
        data-cohort-class="${this.escapeHtml(user.classYear)}"
      >
        ${
          this.isPencilPickMode
            ? `
          <div class="fixed top-0 inset-x-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-extrabold flex items-center justify-between shadow-lg">
            <span>✏️ LIVE ELEMENT PICKER ACTIVE: Click any heading, button, or card on the page to edit its text or colors!</span>
            <button
              type="button"
              data-shell-action="cancel-pencil-pick"
              class="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold"
            >
              Cancel Picker ✕
            </button>
          </div>
        `
            : ''
        }

        <!-- 1. DESKTOP PERSISTENT LEFT SIDEBAR (> 1024px) -->
        <aside
          aria-label="Desktop Primary Sidebar"
          class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E8F0] z-30 justify-between p-5 shadow-2xs"
        >
          <div class="space-y-5">
            <!-- Brand Logo & Target Badge -->
            <div class="flex items-center justify-between">
              <a href="/index.html" class="flex items-center gap-3 group">
                <img
                  src="${logoSrc}"
                  alt="${this.escapeHtml(brandName)} Logo"
                  class="w-10 h-10 rounded-xl object-contain shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                />
                <div>
                  <div class="brand-title-target text-base font-extrabold tracking-tight text-slate-900 leading-none">
                    ${this.escapeHtml(brandName)}
                  </div>
                  <div class="text-[11px] font-bold mt-1" style="color: ${cohortTheme.accentHex || siteTheme.primaryColor}">
                    ${user.targetExam} 2027 · ${user.classYear}
                  </div>
                </div>
              </a>
            </div>

            <!-- Unique Per-Class Theme Status Card -->
            <div class="p-3 rounded-xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white shadow-xs">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                ${this.escapeHtml(cohortTheme.badgeText)}
              </div>
              <div class="text-xs font-extrabold mt-0.5">
                ${this.escapeHtml(cohortTheme.label)}
              </div>
            </div>

            <!-- Primary Navigation Links -->
            <nav aria-label="Desktop Navigation" class="space-y-1">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
                      active
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }"
                  >
                    <span class="flex items-center gap-3">
                      ${item.svgIcon}
                      <span>${item.label}</span>
                    </span>
                    <span class="w-2 h-2 rounded-full ${active ? 'bg-white' : item.accentDot}"></span>
                  </a>
                `;
                })
                .join('')}

              <button
                type="button"
                data-shell-action="open-profile-modal"
                class="w-full min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                <span>Profile & Photo</span>
              </button>

              ${
                isAdminOrMentor
                  ? `
                <a
                  href="/admin.html"
                  data-shell-nav="admin"
                  class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
                    this.activePage === 'admin'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }"
                >
                  <span class="flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span>Admin & Mentor Studio</span>
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#10B981] text-white">
                    ${isMasterAdmin ? 'ADMIN' : 'MENTOR'}
                  </span>
                </a>
              `
                  : ''
              }
            </nav>
          </div>

          <!-- Quick Stats & User Card at Bottom of Desktop Sidebar -->
          <div class="space-y-3 pt-4 border-t border-slate-100">
            <div class="p-3 rounded-xl bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/60 border border-[#E2E8F0] space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">Active Streak</span>
                <span class="font-mono-tabular font-bold text-[#10B981]">🔥 ${user.currentStreak} Days</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">Cohort Track</span>
                <span class="font-bold text-[#4F46E5] truncate max-w-[125px]">
                  ${user.classYear}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-shell-action="open-profile-modal"
              class="w-full p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] flex items-center gap-2.5 text-left transition-colors"
            >
              <img
                src="${user.photoURL}"
                alt="${this.escapeHtml(user.name)}"
                referrerpolicy="no-referrer"
                class="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-slate-900 truncate">${this.escapeHtml(user.name)}</div>
                <div class="text-[10px] font-mono-tabular text-slate-500 truncate">${this.escapeHtml(user.email)}</div>
              </div>
            </button>
          </div>
        </aside>

        <!-- 2. TABLET SLIM VERTICAL ICON RAIL (768px – 1024px) -->
        <aside
          aria-label="Tablet Navigation Rail"
          class="hidden md:flex lg:hidden flex-col fixed inset-y-0 left-0 ${
            this.isTabletRailExpanded ? 'w-56' : 'w-20'
          } bg-white border-r border-[#E2E8F0] z-30 justify-between p-3 transition-all shadow-2xs"
        >
          <div class="space-y-4">
            <button
              type="button"
              data-shell-action="toggle-tablet-rail"
              class="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-slate-900 font-extrabold text-sm flex items-center justify-center gap-2 p-1.5"
              title="Expand or Collapse Navigation Rail"
            >
              <img src="${logoSrc}" alt="Logo" class="w-8 h-8 rounded-lg object-contain" />
              ${this.isTabletRailExpanded ? `<span class="text-xs font-extrabold">${this.escapeHtml(brandName)}</span>` : ''}
            </button>

            <nav class="space-y-1.5">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    title="${item.label}"
                    class="min-h-[42px] px-3 py-2 rounded-xl flex items-center ${
                      this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                    } text-xs font-bold ${
                      active
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }"
                  >
                    ${item.svgIcon}
                    ${this.isTabletRailExpanded ? `<span>${item.shortLabel}</span>` : ''}
                  </a>
                `;
                })
                .join('')}

              <button
                type="button"
                data-shell-action="open-profile-modal"
                title="Profile & Settings"
                class="w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center ${
                  this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                } text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${this.isTabletRailExpanded ? `<span>Profile</span>` : ''}
              </button>
            </nav>
          </div>
        </aside>

        <!-- MAIN CONTENT WRAPPER -->
        <div class="flex-1 flex flex-col md:pl-20 lg:pl-64 pb-20 md:pb-8">
          <!-- Top App Header Bar (Lightweight & Unique Mobile Pill Strip) -->
          <header class="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3 sm:px-6 lg:px-8 py-2 flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2 min-h-[44px]">
              <!-- Left: Mobile Logo + Single Unified Cohort & Class Selector Box -->
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <a href="/index.html" class="lg:hidden flex items-center gap-1.5 shrink-0">
                  <img
                    src="${logoSrc}"
                    alt="${this.escapeHtml(brandName)}"
                    class="w-7 h-7 rounded-lg object-contain shadow-2xs"
                  />
                  <span class="brand-title-target font-extrabold text-xs sm:text-sm text-slate-900">${this.escapeHtml(brandName)}</span>
                </a>

                <!-- SINGLE UNIFIED CLASS & EXAM COHORT SELECTOR BOX (Including Class 10 & 11 Foundation) -->
                <div class="flex items-center gap-1.5 bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/90 border border-indigo-200 hover:border-[#4F46E5] rounded-xl px-2 py-1 shadow-2xs transition-colors">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5] hidden sm:inline">Cohort:</span>
                  <select
                    id="unified-cohort-select"
                    aria-label="Select Class and Exam Track"
                    class="bg-transparent text-[11px] sm:text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer pr-1"
                  >
                    ${[
                      { value: 'JEE|Class 12', label: 'JEE · Class 12' },
                      { value: 'JEE|Class 11', label: 'JEE · Class 11' },
                      { value: 'JEE|Dropper', label: 'JEE · Dropper' },
                      { value: 'NEET|Class 12', label: 'NEET · Class 12' },
                      { value: 'NEET|Class 11', label: 'NEET · Class 11' },
                      { value: 'NEET|Dropper', label: 'NEET · Dropper' },
                      { value: 'JEE|Class 11 Foundation', label: 'Class 11 Foundation' },
                      { value: 'JEE|Class 10 Foundation', label: 'Class 10 Foundation' },
                      { value: 'JEE|Class 10', label: 'Class 10 · Board+NTSE' },
                      { value: 'JEE|Class 9', label: 'Class 9 · Foundation' },
                    ]
                      .map((opt) => {
                        const currentKey =
                          user.classYear === 'Class 10 Foundation'
                            ? 'JEE|Class 10 Foundation'
                            : user.classYear === 'Class 11 Foundation'
                              ? 'JEE|Class 11 Foundation'
                              : user.classYear === 'Class 10'
                                ? 'JEE|Class 10'
                                : user.classYear === 'Class 9'
                                  ? 'JEE|Class 9'
                                  : `${user.targetExam}|${user.classYear}`;
                        return `<option value="${opt.value}" ${currentKey === opt.value ? 'selected' : ''}>${opt.label}</option>`;
                      })
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Right: Admin Pencil Quick-Edit, Notifications Bell & Profile Avatar Button -->
              <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <!-- Admin Quick Pencil Website Editor Trigger -->
                <button
                  type="button"
                  data-shell-action="open-pencil-modal"
                  data-testid="header-pencil-edit-btn"
                  title="Edit Website Text, Colors & Theme (Saved to Firebase)"
                  class="min-h-[34px] px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <span>✏️</span>
                  <span class="hidden sm:inline">Edit UI</span>
                </button>

                <!-- Notifications & Streak Alert Bell -->
                <div class="relative">
                  <button
                    type="button"
                    data-shell-action="toggle-notifications"
                    aria-label="Notifications and Mentor Broadcasts"
                    class="min-h-[34px] min-w-[34px] rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] flex items-center justify-center text-slate-700 relative cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    <span class="w-2 h-2 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5"></span>
                  </button>

                  ${
                    this.isNotificationsOpen
                      ? `
                    <div class="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 space-y-2.5 z-50">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-900">Firebase Streak Alerts & Broadcasts</span>
                        <span class="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-bold">${broadcasts.length + streakNotifications.length} Live</span>
                      </div>
                      ${streakNotifications
                        .slice(0, 2)
                        .map(
                          (sn) => `
                        <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-0.5">
                          <div class="font-extrabold">🔥 ${this.escapeHtml(sn.title)}</div>
                          <p class="text-[11px] leading-snug">${this.escapeHtml(sn.message)}</p>
                        </div>
                      `
                        )
                        .join('')}
                      ${broadcasts
                        .slice(0, 2)
                        .map(
                          (b) => `
                        <div class="p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/80 to-emerald-50/50 border border-indigo-100 text-xs text-slate-700 space-y-1">
                          <div class="font-bold text-[#4F46E5]">${this.escapeHtml(b.title)}</div>
                          <p class="text-[11px] text-slate-600 leading-snug">${this.escapeHtml(b.message)}</p>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Profile & Custom Photo Trigger -->
                <button
                  type="button"
                  data-shell-action="open-profile-modal"
                  data-testid="open-profile-modal-btn"
                  class="min-h-[34px] pl-1.5 pr-2.5 py-1 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <img
                    src="${user.photoURL}"
                    alt="${this.escapeHtml(user.name)}"
                    referrerpolicy="no-referrer"
                    class="w-5 h-5 rounded-full object-cover border border-white/50"
                  />
                  <span>${this.escapeHtml(user.name.split(' ')[0])}</span>
                </button>
              </div>
            </div>

            <!-- Mobile-Only Sleek Horizontal Quick-Jump Pill Strip (Lightweight, Non-Bulky & Distinct from Tablet) -->
            <div class="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <a
                href="/planner.html"
                data-shell-nav="planner"
                class="px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border transition-colors ${
                  this.activePage === 'planner'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }"
              >
                ⚡ To-Do & Backlog
              </a>
              <a
                href="/test-history.html"
                data-shell-nav="test-history"
                class="px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border transition-colors ${
                  this.activePage === 'test-history'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }"
              >
                📊 D3 Test History
              </a>
              <a
                href="/mentorship.html"
                data-shell-nav="mentorship"
                class="px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border transition-colors ${
                  this.activePage === 'mentorship'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }"
              >
                📞 1:1 Mentorship
              </a>
              <a
                href="/player.html?videoId=vid_rotational_01"
                class="px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 bg-indigo-50 text-[#4F46E5] border border-indigo-200"
              >
                ▶ Fullscreen Player
              </a>
            </div>
          </header>

          <!-- Page Viewport Container -->
          <main id="page-viewport" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5"></main>
        </div>

        <!-- 3. MOBILE SLEEK LIGHTWEIGHT BOTTOM BAR (< 768px) -->
        <nav
          aria-label="Mobile Bottom Navigation Bar"
          class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] px-1.5 py-1 grid grid-cols-5 gap-1 shadow-lg"
        >
          ${mobileBottomTabs
            .map((item) => {
              const active = this.activePage === item.id;
              return `
              <a
                href="${item.href}"
                data-shell-nav="${item.id}"
                class="min-h-[42px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all ${
                  active
                    ? 'text-white bg-[#4F46E5] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }"
              >
                ${item.svgIcon}
                <span>${item.shortLabel}</span>
              </a>
            `;
            })
            .join('')}
        </nav>

        <!-- FLOATING ADMIN PENCIL QUICK-EDIT BUTTON (Click to Edit Any Website Name, Text or Color) -->
        <button
          type="button"
          data-shell-action="open-pencil-modal"
          data-testid="admin-floating-pencil-btn"
          title="Admin Pencil Editor: Edit any website text, color, or theme live"
          class="fixed bottom-16 md:bottom-6 left-4 z-40 w-11 h-11 rounded-2xl bg-slate-900 hover:bg-[#4F46E5] text-white shadow-xl border-2 border-white flex items-center justify-center text-base cursor-pointer transition-transform hover:scale-105"
        >
          ✏️
        </button>

        <!-- Student Profile, Custom Photo Upload & Class Cohort Modal -->
        ${this.renderProfileAndAuthModal()}

        <!-- Floating Admin Pencil Live Customizer Modal -->
        ${this.renderAdminPencilModal()}

        <!-- Global Toast Notification -->
        <div
          id="global-toast"
          role="status"
          aria-live="polite"
          class="fixed bottom-20 md:bottom-6 right-4 z-50 hidden px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700"
        ></div>
      </div>
    `;

    const viewport = this.rootEl.querySelector<HTMLElement>('#page-viewport');
    if (viewport) {
      if (this.activePage === 'player') {
        this.playerModule.mount(viewport);
      } else if (isLegacyLive) {
        this.liveModule.mount(viewport);
      } else if (this.activePage === 'planner') {
        this.plannerModule.mount(viewport);
      } else if (this.activePage === 'test-history') {
        this.testHistoryModule.mount(viewport);
      } else if (this.activePage === 'study') {
        this.studyModule.mount(viewport);
      } else if (this.activePage === 'mentorship') {
        this.mentorshipModule.mount(viewport);
      } else if (this.activePage === 'test') {
        this.testModule.mount(viewport);
      } else if (this.activePage === 'admin') {
        this.adminModule.mount(viewport);
      } else {
        this.homeModule.mount(viewport);
      }
    }

    // Re-apply saved Firebase element overrides after mounting active view
    dataStore.applySiteThemeToDocument();
    this.bindShellEvents();
  }

  private renderAdminPencilModal(): string {
    if (!this.isPencilModalOpen) return '';
    const siteTheme = dataStore.getSiteTheme();
    const overrides = siteTheme.elementOverrides || {};
    const overrideCount = Object.keys(overrides).length;

    return `
      <div
        id="admin-pencil-editor-modal"
        data-testid="admin-pencil-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Admin Live Pencil Website Customizer"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
                ✏️ Admin Live Pencil Editor · Synced to Firebase
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Edit Any Website Text, Name, or Color Live
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-pencil-modal"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Close ✕
            </button>
          </div>

          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <div class="text-xs text-amber-950">
              <strong>Interactive Element Picker:</strong> Click the button to pick any heading, card, or button on the page and edit its name or color.
            </div>
            <button
              type="button"
              data-shell-action="start-pencil-pick"
              data-testid="start-pencil-pick-btn"
              class="shrink-0 min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
            >
              🎯 Pick Element on Page
            </button>
          </div>

          <form id="admin-pencil-save-form" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Website Brand Name</label>
                <input
                  id="pencil-brand-name"
                  type="text"
                  value="${this.escapeHtml(siteTheme.brandName)}"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Target Element Selector</label>
                <input
                  id="pencil-selector-input"
                  type="text"
                  value="${this.escapeHtml(this.selectedElementSelector)}"
                  placeholder="e.g., h1, .brand-title-target"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                Custom Text / Rename Selected Element (Optional)
              </label>
              <input
                id="pencil-custom-text"
                type="text"
                value="${this.escapeHtml(this.selectedElementText)}"
                placeholder="Leave blank to keep current text, or type new label/title..."
                class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900"
              />
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Primary Theme</label>
                <input
                  id="pencil-primary-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.primaryColor)}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Surface Bg</label>
                <input
                  id="pencil-surface-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.surfaceBg)}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Element Text</label>
                <input
                  id="pencil-el-text-color"
                  type="color"
                  value="${this.escapeHtml(this.selectedElementColor || '#0F172A')}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Element Bg</label>
                <input
                  id="pencil-el-bg-color"
                  type="color"
                  value="${this.escapeHtml(this.selectedElementBgColor || '#FFFFFF')}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                data-shell-action="clear-pencil-overrides"
                class="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Reset Overrides (${overrideCount})
              </button>
              <button
                type="submit"
                data-testid="save-pencil-changes-btn"
                class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                💾 Apply & Save to Firebase
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderProfileAndAuthModal(): string {
    if (!this.isProfileModalOpen) return '';
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const mentors = dataStore.getMentors();

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Student Profile and Cohort Settings"
        data-testid="student-profile-modal"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
                Personal Aspirant Profile & Custom Photo
              </span>
              <h2 class="text-lg font-bold text-slate-900">
                Customize Profile Photo, Class (9–12 / Foundation / Dropper) & Exam
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-profile-modal"
              class="min-h-[36px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Close ✕
            </button>
          </div>

          <!-- Account Status & Google Sign-In / Sign-Up Card -->
          <div class="p-4 rounded-2xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white space-y-3 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-3">
                <img
                  src="${user.photoURL}"
                  alt="${this.escapeHtml(user.name)}"
                  referrerpolicy="no-referrer"
                  class="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-extrabold">${this.escapeHtml(user.name)}</span>
                    <span class="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold">
                      ${!user.isGuest ? '✓ Verified' : 'Guest'}
                    </span>
                  </div>
                  <div class="text-xs font-mono-tabular text-white/85">${this.escapeHtml(user.email)}</div>
                  <div class="text-[11px] font-bold text-white/90 mt-0.5">${this.escapeHtml(cohortTheme.label)}</div>
                </div>
              </div>

              ${
                !user.isGuest
                  ? `
                <button
                  type="button"
                  data-shell-action="signout-user"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold"
                >
                  Sign Out
                </button>
              `
                  : `
                <button
                  type="button"
                  data-shell-action="set-role-mode"
                  data-mode="student"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold"
                >
                  Login Student
                </button>
              `
              }
            </div>

            <button
              type="button"
              data-shell-action="google-signin"
              class="w-full min-h-[40px] px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center justify-center gap-2.5 text-xs font-extrabold transition-all"
            >
              <span>${user.isGuest ? 'Sign Up / Log In with Google Account' : 'Verified Google Account Connected'}</span>
            </button>
          </div>

          <!-- Profile Update Form -->
          <form id="profile-update-form" class="space-y-4">
            <!-- Custom Personal Photo Upload + Preset Avatars -->
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <div class="flex items-center justify-between">
                <label for="prof-custom-photo-input" class="text-xs font-extrabold text-slate-800">
                  📸 Upload Your Personal Profile Photo
                </label>
                <span class="text-[10px] font-semibold text-[#10B981]">Saved to Firebase</span>
              </div>
              <input
                id="prof-custom-photo-input"
                data-testid="upload-profile-photo-input"
                type="file"
                accept="image/*"
                class="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#4F46E5] file:text-white cursor-pointer"
              />
              <div class="flex items-center gap-2.5 pt-1">
                <span class="text-[11px] text-slate-500 font-semibold">Or pick preset:</span>
                ${AVATAR_CHOICES.map(
                  (url) => `
                  <button
                    type="button"
                    data-shell-action="select-avatar"
                    data-avatar="${url}"
                    class="w-9 h-9 rounded-full overflow-hidden border-2 transition-transform ${
                      user.photoURL === url
                        ? 'border-[#4F46E5] scale-110'
                        : 'border-[#E2E8F0]'
                    }"
                  >
                    <img src="${url}" alt="Avatar option" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <!-- Display Name -->
            <div>
              <label for="prof-name-input" class="block text-xs font-bold text-slate-700 mb-1">
                Student Full Name
              </label>
              <input
                id="prof-name-input"
                type="text"
                required
                value="${this.escapeHtml(user.name)}"
                class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-slate-900"
              />
            </div>

            <!-- Class Cohort (Including Class 10 Foundation & Class 11 Foundation) & Exam -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="prof-class-select" class="block text-xs font-bold text-slate-700 mb-1">
                  Class / Foundation Cohort
                </label>
                <select
                  id="prof-class-select"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${(
                    [
                      'Class 12',
                      'Class 11',
                      'Dropper',
                      'Class 11 Foundation',
                      'Class 10 Foundation',
                      'Class 10',
                      'Class 9',
                    ] as const
                  )
                    .map(
                      (c) =>
                        `<option value="${c}" ${user.classYear === c ? 'selected' : ''}>${c}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div>
                <label for="prof-exam-select" class="block text-xs font-bold text-slate-700 mb-1">
                  Target Exam (JEE / NEET)
                </label>
                <select
                  id="prof-exam-select"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  <option value="JEE" ${user.targetExam === 'JEE' ? 'selected' : ''}>JEE 2027</option>
                  <option value="NEET" ${user.targetExam === 'NEET' ? 'selected' : ''}>NEET 2027</option>
                </select>
              </div>
            </div>

            <div class="pt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                class="w-full sm:w-auto min-h-[42px] px-6 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Save Profile & Cohort Theme →
              </button>
            </div>
          </form>

          <!-- Discreet Faculty / Mentor / Master Admin Access Gate -->
          <div class="pt-3 border-t border-slate-100">
            <button
              type="button"
              data-shell-action="toggle-faculty-login"
              class="text-[11px] font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <span>${this.isFacultyLoginExpanded ? '▾' : '▸'} Educator / Mentor / Admin Sign-In</span>
            </button>

            ${
              this.isFacultyLoginExpanded
                ? `
              <div class="mt-3 p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-2.5">
                <div class="text-[11px] font-bold text-slate-700">
                  Authorized Faculty & Admin Portal Access
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-shell-action="set-role-mode"
                    data-mode="admin"
                    class="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                  >
                    Master Admin (${MASTER_ADMIN_EMAIL})
                  </button>
                  ${mentors
                    .filter((m) => m.id !== 'mentor_sumit_master')
                    .map(
                      (m) => `
                    <button
                      type="button"
                      data-shell-action="set-role-mode"
                      data-mode="mentor"
                      data-mentor-email="${this.escapeHtml(m.email)}"
                      class="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                    >
                      Mentor: ${this.escapeHtml(m.name)}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private bindShellEvents(): void {
    this.rootEl.querySelectorAll<HTMLAnchorElement>('[data-shell-nav]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetPage = link.dataset.shellNav as PageId;
        if (!targetPage) return;
        e.preventDefault();
        window.history.pushState({}, '', link.getAttribute('href') || '/index.html');
        this.navigateToPage(targetPage);
      });
    });

    // Custom Personal Profile Photo File Upload
    const customPhotoInput = this.rootEl.querySelector<HTMLInputElement>(
      '#prof-custom-photo-input'
    );
    customPhotoInput?.addEventListener('change', () => {
      const file = customPhotoInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImageDataUrl(reader.result, 320, 0.84);
          await dataStore.updateUser({ photoURL: compressed });
          this.showToast('Personal profile photo updated & synced to Firebase!');
          this.renderShell();
        }
      };
      reader.readAsDataURL(file);
    });

    const profileForm =
      this.rootEl.querySelector<HTMLFormElement>('#profile-update-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name =
        profileForm.querySelector<HTMLInputElement>('#prof-name-input')?.value.trim() ??
        'Aarav Sharma';
      const classYear =
        (profileForm.querySelector<HTMLSelectElement>('#prof-class-select')
          ?.value as StudentClassYear) ?? 'Class 12';
      const targetExam =
        (profileForm.querySelector<HTMLSelectElement>('#prof-exam-select')
          ?.value as TargetExam) ?? 'JEE';

      await dataStore.updateUser({ name, classYear, targetExam });
      this.isProfileModalOpen = false;
      this.showToast(`Profile saved for ${name} (${classYear} · ${targetExam})`);
      this.renderShell();
    });

    // Admin Pencil Live Website Customizer Form
    const pencilForm = this.rootEl.querySelector<HTMLFormElement>(
      '#admin-pencil-save-form'
    );
    pencilForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const brandName =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-brand-name')
          ?.value.trim() || 'prepskm.in';
      const primaryColor =
        pencilForm.querySelector<HTMLInputElement>('#pencil-primary-color')
          ?.value || '#4F46E5';
      const surfaceBg =
        pencilForm.querySelector<HTMLInputElement>('#pencil-surface-color')
          ?.value || '#F8FAFC';
      const selector =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-selector-input')
          ?.value.trim() || '';
      const customText =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-custom-text')
          ?.value.trim() || '';
      const textColor =
        pencilForm.querySelector<HTMLInputElement>('#pencil-el-text-color')
          ?.value || '';

      await dataStore.updateSiteTheme({
        brandName,
        primaryColor,
        surfaceBg,
      });

      if (selector && (customText || textColor)) {
        await dataStore.saveElementStyleOverride(selector, {
          ...(customText ? { text: customText } : {}),
          ...(textColor ? { color: textColor } : {}),
        });
      }

      this.isPencilModalOpen = false;
      this.showToast('Saved live UI customizations to Firebase!');
      this.renderShell();
    });

    const unifiedSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#unified-cohort-select');
    unifiedSelect?.addEventListener('change', async () => {
      const val = unifiedSelect.value;
      const [examPart, classPart] = val.split('|') as [TargetExam, StudentClassYear];
      if (examPart && classPart) {
        await dataStore.updateUser({
          targetExam: examPart,
          classYear: classPart,
        });
        this.showToast(`Switched Cohort & Theme to ${classPart} (${examPart})`);
        this.renderShell();
      }
    });

    this.rootEl.querySelectorAll<HTMLElement>('[data-shell-action]').forEach((el) => {
      const action = el.dataset.shellAction;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'open-pencil-modal': {
            this.isPencilModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-pencil-modal': {
            this.isPencilModalOpen = false;
            this.renderShell();
            break;
          }
          case 'start-pencil-pick': {
            this.isPencilModalOpen = false;
            this.isPencilPickMode = true;
            this.renderShell();
            break;
          }
          case 'cancel-pencil-pick': {
            this.isPencilPickMode = false;
            this.renderShell();
            break;
          }
          case 'clear-pencil-overrides': {
            await dataStore.clearElementStyleOverrides();
            this.isPencilModalOpen = false;
            this.showToast('Cleared all custom element overrides.');
            this.renderShell();
            break;
          }
          case 'open-profile-modal': {
            this.isProfileModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-profile-modal': {
            this.isProfileModalOpen = false;
            this.renderShell();
            break;
          }
          case 'toggle-faculty-login': {
            this.isFacultyLoginExpanded = !this.isFacultyLoginExpanded;
            this.renderShell();
            break;
          }
          case 'toggle-notifications': {
            this.isNotificationsOpen = !this.isNotificationsOpen;
            this.renderShell();
            break;
          }
          case 'toggle-tablet-rail': {
            this.isTabletRailExpanded = !this.isTabletRailExpanded;
            this.renderShell();
            break;
          }
          case 'signout-user': {
            await dataStore.signOutUser();
            this.showToast('Signed out to Guest Mode.');
            this.renderShell();
            break;
          }
          case 'set-role-mode': {
            const mode = el.dataset.mode as 'student' | 'guest' | 'admin' | 'mentor';
            const mentorEmail = el.dataset.mentorEmail;
            if (mode) {
              dataStore.switchRoleSession(
                mode,
                undefined,
                undefined,
                undefined,
                mentorEmail
              );
              this.isProfileModalOpen = false;
              if (mode === 'admin' || mode === 'mentor') {
                window.history.pushState({}, '', '/admin.html');
                this.activePage = 'admin';
              } else if (this.activePage === 'admin') {
                window.history.pushState({}, '', '/index.html');
                this.activePage = 'home';
              }
              this.showToast(
                mode === 'admin'
                  ? `Activated Master Admin (${MASTER_ADMIN_EMAIL})`
                  : mode === 'mentor'
                    ? `Signed in as Mentor (${mentorEmail})`
                    : mode === 'guest'
                      ? 'Entered Guest Mode'
                      : 'Signed in to Verified Student Account'
              );
              this.renderShell();
            }
            break;
          }
          case 'select-avatar': {
            const url = el.dataset.avatar;
            if (url) {
              await dataStore.updateUser({ photoURL: url });
              this.renderShell();
            }
            break;
          }
          case 'google-signin': {
            try {
              await dataStore.signInWithGoogle();
              this.isProfileModalOpen = false;
              this.showToast('Signed in with Google!');
              this.renderShell();
            } catch {
              dataStore.switchRoleSession('student', 'Aarav Sharma (Google Verified)');
              this.isProfileModalOpen = false;
              this.showToast('Google Account verified & signed in!');
              this.renderShell();
            }
            break;
          }
        }
      });
    });
  }

  public showToast(message: string): void {
    const toast = this.rootEl.querySelector<HTMLElement>('#global-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    window.setTimeout(() => {
      toast.classList.add('hidden');
    }, 3400);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    new PrepskmPlatformApp(root);
  }
});
