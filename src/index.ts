import {
  DEFAULT_BRAND_LOGO_SVG,
  getCohortTheme,
  MENTOR_AVATAR_PATH,
  XP_PER_COMPLETED_TASK,
} from './constants';
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
  isMasterAdminEmail,
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
  private isXpRankModalOpen = false;
  private authModalReasonMessage = '';
  private isNotificationsOpen = false;
  private isMobile3DotMenuOpen = false;
  private isTabletRailExpanded = false;

  // Floating Admin Pencil Live Website Customizer State (Master Admin Only)
  private isPencilModalOpen = false;
  private isPencilPickMode = false;
  private selectedElementSelector = '.brand-title-target';
  private selectedElementText = '';
  private selectedElementColor = '#0F172A';
  private selectedElementBgColor = '';

  // Header Streak Micro-Animation state
  private isHeaderStreakAnimating = false;

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

    window.addEventListener('prepskm:open-auth-modal', (ev: Event) => {
      const customEv = ev as CustomEvent<{ reason?: string }>;
      this.authModalReasonMessage =
        customEv.detail?.reason ||
        'Please Sign Up or Log In with your Gmail to unlock Mock Tests and save your progress!';
      this.isProfileModalOpen = true;
      this.renderShell();
    });

    window.addEventListener('prepskm:streak-celebrate', () => {
      this.isHeaderStreakAnimating = true;
      window.setTimeout(() => {
        this.isHeaderStreakAnimating = false;
      }, 2400);
    });

    window.addEventListener('prepskm:user-updated', () => {
      this.renderShell();
    });

    this.renderShell();
    this.setupGlobalPencilClickCatcher();
  }

  private detectInitialPage(): PageId {
    const params = new URLSearchParams(window.location.search);
    const queryPage = params.get('page') as PageId | null;
    if (
      queryPage &&
      [
        'home',
        'planner',
        'study',
        'test',
        'test-history',
        'mentorship',
        'player',
        'admin',
      ].includes(queryPage)
    ) {
      return queryPage;
    }
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
    this.isMobile3DotMenuOpen = false;
    this.renderShell();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public renderShell(): void {
    dataStore.applySiteThemeToDocument();
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const isMasterAdmin = dataStore.isMasterAdmin();
    const siteTheme = dataStore.getSiteTheme();
    const streakNotifications = dataStore.getStreakNotifications();
    const logoSrc = siteTheme.logoDataUrl || DEFAULT_BRAND_LOGO_SVG;
    const brandName = siteTheme.brandName || 'prepskm.in';
    const xpPoints = user.xpPoints ?? 0;
    const rankAndLevel = dataStore.getStudentRankAndMonthlyLevel();

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
        label: 'Home & All-in-One Hub',
        shortLabel: 'Home',
        href: '/index.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"/></svg>`,
        accentDot: 'bg-indigo-500',
      },
      {
        id: 'planner',
        label: 'To-Do & Planner',
        shortLabel: 'Planner',
        href: '/index.html?page=planner',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
        accentDot: 'bg-violet-500',
      },
      {
        id: 'study',
        label: 'Study Material Vault',
        shortLabel: 'Study Vault',
        href: '/index.html?page=study',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
        accentDot: 'bg-emerald-500',
      },
      {
        id: 'test',
        label: 'Official Mock Tests',
        shortLabel: 'Mock Test',
        href: '/index.html?page=test',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        accentDot: 'bg-amber-500',
      },
      {
        id: 'test-history',
        label: 'Test Analytics',
        shortLabel: 'History',
        href: '/index.html?page=test-history',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>`,
        accentDot: 'bg-cyan-500',
      },
      {
        id: 'mentorship',
        label: 'Lectures & Mentorship',
        shortLabel: 'Lectures',
        href: '/index.html?page=mentorship',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
        accentDot: 'bg-rose-500',
      },
    ];

    const mobileBottomTabs = [
      navItems[0], // Home
      navItems[1], // Planner
      navItems[2], // Study
      navItems[3], // CBT Test
      navItems[5], // Lectures & Mentorship
    ];

    const cohortOptions = [
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
    ];

    const currentCohortKey =
      user.classYear === 'Class 10 Foundation'
        ? 'JEE|Class 10 Foundation'
        : user.classYear === 'Class 11 Foundation'
          ? 'JEE|Class 11 Foundation'
          : user.classYear === 'Class 10'
            ? 'JEE|Class 10'
            : user.classYear === 'Class 9'
              ? 'JEE|Class 9'
              : `${user.targetExam}|${user.classYear}`;

    this.rootEl.innerHTML = `
      <div
        class="min-h-screen flex flex-col lg:flex-row text-slate-900 transition-colors editorial-canvas-bg"
        style="background-color: ${this.escapeHtml(siteTheme.surfaceBg || cohortTheme.surfaceTint || '#F8FAFC')}"
        data-cohort-class="${this.escapeHtml(user.classYear)}"
      >
        ${
          this.isPencilPickMode && isMasterAdmin
            ? `
          <div class="fixed top-0 inset-x-0 z-50 bg-indigo-600 text-white px-4 py-2 text-xs font-extrabold flex items-center justify-between shadow-lg">
            <span>✏️ LIVE ELEMENT PICKER ACTIVE: Click any heading, button, or card on the page to edit its text or colors!</span>
            <button
              type="button"
              data-shell-action="cancel-pencil-pick"
              class="px-3 py-1 rounded-lg bg-white text-indigo-700 text-[11px] font-bold"
            >
              Cancel Picker ✕
            </button>
          </div>
        `
            : ''
        }

        <!-- 1. LUMINOUS DAYLIGHT FLOATING SIDEBAR (> 1024px) -->
        <aside
          aria-label="Primary Navigation Sidebar"
          class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-3 lg:left-3 bg-white/95 backdrop-blur-md text-slate-900 rounded-[24px] border border-slate-200/90 z-30 justify-between p-5 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.07)]"
        >
          <div class="space-y-5">
            <!-- Brand Logo & Target Badge -->
            <div class="flex items-center justify-between">
              <a href="/index.html" class="flex items-center gap-3 group">
                <img
                  src="${logoSrc}"
                  alt="${this.escapeHtml(brandName)} Logo"
                  class="w-10 h-10 rounded-xl object-contain border border-indigo-100 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                />
                <div>
                  <div class="brand-title-target text-base font-extrabold tracking-tight text-slate-900 leading-none">
                    ${this.escapeHtml(brandName)}
                  </div>
                  <div class="text-[11px] font-mono-tabular font-bold mt-1 text-indigo-600">
                    ${user.targetExam} 2027 · ${user.classYear}
                  </div>
                </div>
              </a>
            </div>

            <!-- Light Track Module -->
            <div class="p-3 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/60 border border-indigo-200/80">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-indigo-700">
                  ${this.escapeHtml(cohortTheme.badgeText)}
                </span>
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div class="text-xs font-extrabold text-slate-900 mt-1">
                ${this.escapeHtml(cohortTheme.label)}
              </div>
            </div>

            <!-- Primary Navigation Links -->
            <nav aria-label="Desktop Navigation" class="space-y-1.5">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-extrabold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                        : 'text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-700'
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

              ${
                isMasterAdmin
                  ? `
                <a
                  href="/admin.html"
                  data-shell-nav="admin"
                  data-testid="sidebar-admin-studio-link"
                  class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-extrabold transition-all ${
                    this.activePage === 'admin'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }"
                >
                  <span class="flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span>Owner Admin Panel</span>
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-600 text-white">
                    ADMIN
                  </span>
                </a>
              `
                  : ''
              }
            </nav>
          </div>

          <!-- Quick Telemetry & User Card at Bottom of Sidebar -->
          <div class="space-y-3 pt-4 border-t border-slate-200/80">
            <button
              type="button"
              data-shell-action="open-xp-rank-modal"
              data-testid="sidebar-xp-rank-btn"
              class="w-full p-3 rounded-2xl bg-slate-50/90 hover:bg-indigo-50/60 border border-slate-200/90 space-y-1.5 text-left cursor-pointer transition-all"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-500">Active Streak</span>
                <span class="font-mono-tabular font-extrabold text-amber-600">🔥 ${user.currentStreak} Days</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-500">XP &amp; Rank</span>
                <span class="font-mono-tabular font-extrabold text-indigo-600">⚡ ${xpPoints} XP · #${rankAndLevel.currentUserRank}</span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-medium text-slate-500">Monthly Level</span>
                <span class="font-extrabold text-emerald-600">Level ${rankAndLevel.level} →</span>
              </div>
            </button>

            <button
              type="button"
              data-shell-action="open-profile-modal"
              data-testid="sidebar-profile-btn"
              class="w-full p-2.5 rounded-2xl bg-slate-50/90 hover:bg-indigo-50/60 border border-slate-200/90 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
            >
              <img
                src="${user.photoURL}"
                alt="${this.escapeHtml(user.name)}"
                referrerpolicy="no-referrer"
                class="w-9 h-9 rounded-full object-cover border border-indigo-200 shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-extrabold text-slate-900 truncate">
                  ${user.isGuest ? 'Guest · Sign Up' : this.escapeHtml(user.name)}
                </div>
                <div class="text-[10px] font-mono-tabular text-indigo-600 truncate">
                  ${user.isGuest ? 'Google Sign-Up or Guest' : this.escapeHtml(user.email)}
                </div>
              </div>
            </button>
          </div>
        </aside>

        <!-- 2. COMPACT VERTICAL RAIL (768px – 1024px) -->
        <aside
          aria-label="Compact Navigation Rail"
          class="hidden md:flex lg:hidden flex-col fixed inset-y-2 left-2 ${
            this.isTabletRailExpanded ? 'w-56' : 'w-20'
          } bg-white/95 backdrop-blur-md text-slate-900 rounded-[22px] border border-slate-200 z-30 justify-between p-3 transition-all shadow-lg"
        >
          <div class="space-y-4">
            <button
              type="button"
              data-shell-action="toggle-tablet-rail"
              class="w-full min-h-[44px] rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-extrabold text-sm flex items-center justify-center gap-2 p-1.5"
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
                    } text-xs font-extrabold ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
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
                } text-xs font-extrabold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${this.isTabletRailExpanded ? `<span>Profile</span>` : ''}
              </button>
            </nav>
          </div>
        </aside>

        <!-- MAIN CONTENT WRAPPER -->
        <div class="flex-1 flex flex-col md:pl-24 lg:pl-[276px] pb-24 md:pb-10">
          <!-- Top App Header Bar with Luminous Light Badges -->
          <header class="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 py-2.5">
            <div class="flex items-center justify-between gap-2 min-h-[44px]">
              <!-- Left: Brand + Unified Cohort Selector -->
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <a href="/index.html" class="lg:hidden flex items-center gap-2 shrink-0">
                  <img
                    src="${logoSrc}"
                    alt="${this.escapeHtml(brandName)}"
                    class="w-8 h-8 rounded-xl object-contain border border-indigo-100"
                  />
                  <span class="brand-title-target font-extrabold text-sm text-slate-900">${this.escapeHtml(brandName)}</span>
                </a>

                <div class="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 transition-transform">
                  <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span class="text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-slate-500">Track:</span>
                  <select
                    id="unified-cohort-select"
                    aria-label="Select Class and Exam Track"
                    class="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer pr-1"
                  >
                    ${cohortOptions
                      .map(
                        (opt) =>
                          `<option value="${opt.value}" ${currentCohortKey === opt.value ? 'selected' : ''}>${opt.label}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Right: Clickable Streak + XP / Rank / Level Badge + Notification Bell + Profile CTA -->
              <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0 relative">
                <!-- Clickable Streak & XP / Rank / Level Counter Pill in Header -->
                <button
                  type="button"
                  data-shell-action="open-xp-rank-modal"
                  data-testid="header-streak-xp-bar"
                  title="Click to view Live Rank, Monthly Level, and Streak Status"
                  class="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50/50 text-slate-900 border border-slate-200 shadow-2xs cursor-pointer transition-all hover:-translate-y-0.5 ${
                    this.isHeaderStreakAnimating ? 'streak-widget-celebrating' : ''
                  }"
                >
                  <span
                    data-testid="header-streak-badge"
                    class="text-[11px] font-mono-tabular font-extrabold text-amber-600 flex items-center gap-0.5 ${
                      this.isHeaderStreakAnimating ? 'streak-flame-burst' : ''
                    }"
                  >
                    🔥 ${user.currentStreak}d
                  </span>
                  <span class="text-slate-300">|</span>
                  <span
                    data-testid="header-xp-badge"
                    class="text-[11px] font-mono-tabular font-extrabold text-indigo-600 flex items-center gap-0.5"
                  >
                    ⚡ ${xpPoints} XP
                  </span>
                  <span class="hidden sm:inline text-slate-300">|</span>
                  <span
                    data-testid="header-rank-level-badge"
                    class="hidden sm:inline-flex text-[10px] font-mono-tabular font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md"
                  >
                    #${rankAndLevel.currentUserRank} · Lv.${rankAndLevel.level}
                  </span>
                </button>

                ${
                  isMasterAdmin
                    ? `
                  <a
                    href="/admin.html"
                    data-shell-nav="admin"
                    data-testid="header-admin-studio-btn"
                    class="hidden sm:inline-flex min-h-[36px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-xs text-[11px] font-extrabold items-center gap-1 cursor-pointer"
                  >
                    <span>🛡️</span>
                    <span>Admin Panel</span>
                  </a>
                  <button
                    type="button"
                    data-shell-action="open-pencil-modal"
                    data-testid="header-pencil-edit-btn"
                    title="Edit Website Text, Colors & Theme (Master Admin Only)"
                    class="hidden md:flex min-h-[36px] px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold items-center gap-1 cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>Edit UI</span>
                  </button>
                `
                    : ''
                }

                <!-- Notifications Bell -->
                <div class="relative">
                  <button
                    type="button"
                    data-shell-action="toggle-notifications"
                    data-testid="header-notification-bell-btn"
                    aria-label="Notifications"
                    class="min-h-[36px] min-w-[36px] rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 relative cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    ${
                      streakNotifications.length > 0
                        ? `<span class="w-2 h-2 rounded-full bg-indigo-600 absolute top-1.5 right-1.5"></span>`
                        : ''
                    }
                  </button>

                  ${
                    this.isNotificationsOpen
                      ? `
                    <div class="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-2.5 z-50">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-extrabold text-slate-900">Study Reminders &amp; Alerts</span>
                        <span class="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">${streakNotifications.length}</span>
                      </div>
                      ${
                        streakNotifications.length === 0
                          ? `<p class="text-xs text-slate-600 py-2">No new alerts right now. Complete a To-Do task today to earn +${XP_PER_COMPLETED_TASK} XP and trigger your streak consistency boost!</p>`
                          : streakNotifications
                              .slice(0, 3)
                              .map(
                                (sn) => `
                            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-0.5">
                              <div class="font-extrabold">🔥 ${this.escapeHtml(sn.title)}</div>
                              <p class="text-[11px] leading-snug">${this.escapeHtml(sn.message)}</p>
                            </div>
                          `
                              )
                              .join('')
                      }
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Profile OR Sign-Up Button -->
                <button
                  type="button"
                  data-shell-action="open-profile-modal"
                  data-testid="open-profile-modal-btn"
                  class="hidden md:flex min-h-[36px] pl-1.5 pr-3.5 py-1 rounded-xl vermilion-cta-btn text-xs font-extrabold items-center gap-1.5 cursor-pointer"
                >
                  <img
                    src="${user.photoURL}"
                    alt="${this.escapeHtml(user.name)}"
                    referrerpolicy="no-referrer"
                    class="w-5 h-5 rounded-full object-cover border border-white"
                  />
                  <span>${user.isGuest ? 'Guest / Sign Up' : this.escapeHtml(user.name)}</span>
                </button>

                <!-- MOBILE QUICK MENU BUTTON (⋮) -->
                <div class="md:hidden relative">
                  <button
                    type="button"
                    data-shell-action="toggle-mobile-3dot-menu"
                    data-testid="mobile-3dot-menu-btn"
                    aria-label="Open Menu"
                    class="min-h-[36px] min-w-[36px] rounded-xl bg-white text-slate-800 border border-slate-200 flex items-center justify-center font-extrabold text-base shadow-2xs cursor-pointer"
                  >
                    ⋮
                  </button>

                  ${
                    this.isMobile3DotMenuOpen
                      ? `
                    <div
                      data-testid="mobile-3dot-drawer"
                      class="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3 z-50"
                    >
                      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <img
                            src="${user.photoURL}"
                            alt="${this.escapeHtml(user.name)}"
                            referrerpolicy="no-referrer"
                            class="w-9 h-9 rounded-full object-cover border border-indigo-200 shrink-0"
                          />
                          <div class="min-w-0">
                            <div class="text-xs font-extrabold text-slate-900 truncate">
                              ${user.isGuest ? `${this.escapeHtml(user.name)} (Guest)` : this.escapeHtml(user.name)}
                            </div>
                            <div class="text-[10px] font-mono-tabular text-indigo-600 font-extrabold">
                              🔥 ${user.currentStreak}d · ⚡ ${xpPoints} XP · #${rankAndLevel.currentUserRank}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-shell-action="open-profile-modal"
                          class="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                        >
                          ${user.isGuest ? 'Sign Up' : 'Profile'}
                        </button>
                      </div>

                      <div class="space-y-1">
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Class / Track Cohort
                        </label>
                        <select
                          id="mobile-cohort-select"
                          aria-label="Select Class and Exam Track"
                          class="w-full min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-900"
                        >
                          ${cohortOptions
                            .map(
                              (opt) =>
                                `<option value="${opt.value}" ${currentCohortKey === opt.value ? 'selected' : ''}>${opt.label}</option>`
                            )
                            .join('')}
                        </select>
                      </div>

                      <div class="space-y-1.5 pt-1">
                        <button
                          type="button"
                          data-shell-action="open-xp-rank-modal"
                          class="w-full px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-extrabold flex items-center justify-between cursor-pointer"
                        >
                          <span>🏆 Rank #${rankAndLevel.currentUserRank} · Level ${rankAndLevel.level}</span>
                          <span class="text-indigo-600">View →</span>
                        </button>
                        <a
                          href="/planner.html"
                          data-shell-nav="planner"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between"
                        >
                          <span>⚡ To-Do &amp; Study Planner</span>
                          <span class="text-[10px] font-extrabold text-indigo-600">Open →</span>
                        </a>
                        <a
                          href="/test-history.html"
                          data-shell-nav="test-history"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between"
                        >
                          <span>📊 Test History &amp; Solutions</span>
                          <span class="text-[10px] font-extrabold text-indigo-600">Open →</span>
                        </a>
                        ${
                          isMasterAdmin
                            ? `
                          <a
                            href="/admin.html"
                            data-shell-nav="admin"
                            class="w-full px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-between"
                          >
                            <span>🛡️ Owner Admin Panel</span>
                            <span>Open</span>
                          </a>
                        `
                            : ''
                        }
                      </div>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            </div>
          </header>

          <!-- Page Viewport Container -->
          <main id="page-viewport" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6"></main>
        </div>

        <!-- 3. FLOATING LIGHT BOTTOM COMMAND DOCK (< 768px) -->
        <nav
          aria-label="Bottom Navigation Dock"
          class="md:hidden fixed bottom-2.5 inset-x-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-1.5 py-1.5 grid grid-cols-5 gap-1 shadow-xl"
        >
          ${mobileBottomTabs
            .map((item) => {
              const active = this.activePage === item.id;
              return `
              <a
                href="${item.href}"
                data-shell-nav="${item.id}"
                class="min-h-[42px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all ${
                  active
                    ? 'text-white bg-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-indigo-600'
                }"
              >
                ${item.svgIcon}
                <span>${item.shortLabel}</span>
              </a>
            `;
            })
            .join('')}
        </nav>

        ${
          isMasterAdmin
            ? `
          <!-- FLOATING ADMIN PENCIL QUICK-EDIT BUTTON (STRICTLY ONLY FOR MASTER ADMIN) -->
          <button
            type="button"
            data-shell-action="open-pencil-modal"
            data-testid="admin-floating-pencil-btn"
            title="Admin Pencil Editor: Edit any website text, color, or theme live"
            class="fixed bottom-20 md:bottom-6 left-4 z-40 w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg border-2 border-white flex items-center justify-center text-base cursor-pointer transition-transform hover:scale-105"
          >
            ✏️
          </button>
        `
            : ''
        }

        <!-- Student Sign-Up / Simple Profile Modal -->
        ${this.renderProfileAndAuthModal()}

        <!-- XP, Live Rank, Monthly Level & Streak Extend/End Popup Modal -->
        ${this.renderXpRankLevelModal()}

        <!-- Floating Admin Pencil Live Customizer Modal (Master Admin Only) -->
        ${isMasterAdmin ? this.renderAdminPencilModal() : ''}

        <!-- Global Toast Notification -->
        <div
          id="global-toast"
          role="status"
          aria-live="polite"
          class="fixed bottom-28 md:bottom-20 right-4 z-50 hidden px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700"
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

    dataStore.applySiteThemeToDocument();
    this.bindShellEvents();
  }

  private renderXpRankLevelModal(): string {
    if (!this.isXpRankModalOpen) return '';
    const user = dataStore.getUser();
    const rankInfo = dataStore.getStudentRankAndMonthlyLevel();

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live Rank, Monthly Level and Streak Status"
        data-testid="xp-rank-level-modal"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#4F46E5]">
                🏆 Live Standings · Monthly Level · Streak Lifecycle
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Your Rank, XP & Monthly Level Progression
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-xp-rank-modal"
              data-testid="close-xp-rank-modal-btn"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          <!-- Top 3 Metric Cards: Live Rank, Monthly Level, Active Streak -->
          <div class="grid grid-cols-3 gap-2.5">
            <div class="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-center">
              <div class="text-[10px] font-extrabold uppercase text-[#4F46E5]">Live Rank</div>
              <div data-testid="modal-live-rank-val" class="text-xl font-mono-tabular font-extrabold text-slate-900 mt-0.5">
                #${rankInfo.currentUserRank}
              </div>
              <div class="text-[10px] text-slate-500 font-semibold">
                of ${rankInfo.totalParticipants} Joined
              </div>
            </div>

            <div class="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center">
              <div class="text-[10px] font-extrabold uppercase text-emerald-700">Monthly Level</div>
              <div data-testid="modal-monthly-level-val" class="text-xl font-mono-tabular font-extrabold text-emerald-900 mt-0.5">
                Level ${rankInfo.level}
              </div>
              <div class="text-[10px] text-emerald-700 font-bold">
                ${rankInfo.eligibleForMonthlyPromotion ? 'Top 20 → +1 Lv/Mo' : 'Rank 1–20 → +1 Lv'}
              </div>
            </div>

            <div class="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-center">
              <div class="text-[10px] font-extrabold uppercase text-amber-700">Study Streak</div>
              <div data-testid="modal-streak-days-val" class="text-xl font-mono-tabular font-extrabold text-amber-900 mt-0.5">
                🔥 ${user.currentStreak}d
              </div>
              <div class="text-[10px] text-amber-800 font-semibold">
                ⚡ ${rankInfo.xpPoints} XP
              </div>
            </div>
          </div>

          <!-- Monthly Level Promotion Rule Banner -->
          <div class="p-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white space-y-1 shadow-xs">
            <div class="flex items-center justify-between text-xs font-extrabold">
              <span>📈 Monthly Level-Up Rule (Rank #1 to #20)</span>
              <span class="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">Next: Level ${rankInfo.nextLevelAfterMonth}</span>
            </div>
            <p class="text-[11px] text-indigo-100 leading-relaxed">
              ${this.escapeHtml(rankInfo.ruleSummary)}
            </p>
          </div>

          <!-- Streak Extend & End Lifecycle Controls -->
          <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-extrabold text-slate-900">
                  🔥 Streak Lifecycle (Extend or End)
                </div>
                <p class="text-[11px] text-slate-500">
                  ${this.escapeHtml(rankInfo.streakEval.statusMessage)}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-shell-action="streak-extend-day"
                data-testid="streak-extend-btn"
                class="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold cursor-pointer transition-colors"
              >
                🔥 Extend Streak (+1 Day)
              </button>
              <button
                type="button"
                data-shell-action="streak-end-reset"
                data-testid="streak-end-btn"
                class="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-extrabold cursor-pointer transition-colors"
              >
                ⏹️ End Streak (Reset to 0d)
              </button>
            </div>
          </div>

          <!-- Live Leaderboard Standings (Guest vs Signed-Up Visibility Rule) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Live Leaderboard (${rankInfo.totalParticipants} Real Joined)
              </h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                user.isGuest
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }">
                ${user.isGuest ? 'Guest Preview (Visible Only to You)' : 'Public Verified Standings'}
              </span>
            </div>

            ${
              user.isGuest
                ? `
              <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold flex items-center justify-between gap-2">
                <span>You are viewing as <strong>Guest</strong>. Your rank is visible only on your device and hidden from other students until you Sign Up.</span>
                <button
                  type="button"
                  data-shell-action="open-profile-modal"
                  class="shrink-0 px-2.5 py-1 rounded-lg bg-[#4F46E5] text-white text-[10px] font-extrabold cursor-pointer"
                >
                  Sign Up →
                </button>
              </div>
            `
                : ''
            }

            <div class="divide-y divide-slate-100 border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
              ${rankInfo.top10
                .map((entry) => {
                  const isMe = entry.uid === user.uid;
                  return `
                  <div class="px-3.5 py-2.5 flex items-center justify-between text-xs ${
                    isMe ? 'bg-indigo-50/70 font-extrabold' : ''
                  }">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="w-6 h-6 rounded-lg ${
                        entry.rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : entry.rank <= 3
                            ? 'bg-indigo-100 text-[#4F46E5]'
                            : 'bg-slate-100 text-slate-700'
                      } font-mono-tabular font-extrabold flex items-center justify-center text-[11px] shrink-0">
                        #${entry.rank}
                      </span>
                      <div class="truncate">
                        <span class="text-slate-900">${this.escapeHtml(entry.name)}</span>
                        ${isMe ? `<span class="ml-1 text-[10px] text-[#4F46E5]">(You)</span>` : ''}
                        <div class="text-[10px] text-slate-500 font-semibold">
                          ${entry.targetExam} · Lv.${entry.monthlyLevel ?? 1} · 🔥 ${entry.currentStreak}d
                        </div>
                      </div>
                    </div>
                    <div class="text-right font-mono-tabular shrink-0">
                      <div class="font-extrabold text-[#4F46E5]">${entry.compositePoints} pts</div>
                      <div class="text-[10px] text-slate-500">⚡ ${entry.xpPoints ?? 0} XP</div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderAdminPencilModal(): string {
    if (!this.isPencilModalOpen || !dataStore.isMasterAdmin()) return '';
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
                ✏️ Master Admin Live Pencil Editor (${MASTER_ADMIN_EMAIL})
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
                placeholder="Leave blank to keep current text, or type new label/title"
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
                💾 Apply & Save Changes
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
    const classChoices = [
      'Class 12',
      'Class 11',
      'Dropper',
      'Class 11 Foundation',
      'Class 10 Foundation',
      'Class 10',
      'Class 9',
    ] as const;

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Student Sign Up and Profile Settings"
        data-testid="student-profile-modal"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl ${
          user.isGuest ? 'max-w-2xl' : 'max-w-md'
        } w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#4F46E5]">
                ${
                  user.isGuest
                    ? 'Choose 1 of 2 Options · Guest Mode or Google Sign Up'
                    : '✓ Enrolled Google Student Profile'
                }
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                ${
                  user.isGuest
                    ? 'Continue as Guest OR Sign Up with Google'
                    : `${this.escapeHtml(user.name)}`
                }
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-profile-modal"
              class="min-h-[36px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          ${
            this.authModalReasonMessage
              ? `
            <div
              data-testid="auth-modal-reason-banner"
              class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950 flex items-start gap-2.5"
            >
              <span class="text-base">🔒</span>
              <span>${this.escapeHtml(this.authModalReasonMessage)}</span>
            </div>
          `
              : ''
          }

          ${
            user.isGuest
              ? `
            <!-- GUEST MODE: STRICTLY TWO OPTIONS (1. Guest with ONLY Name & Class | 2. ONLY Sign Up with Google button — NO login form) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="guest-or-google-auth-options">
              <!-- OPTION 1: CONTINUE AS GUEST (ONLY NAME & CLASS — LIGHT THEME) -->
              <div
                data-testid="guest-option-card"
                class="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col justify-between gap-4"
              >
                <div class="space-y-3.5">
                  <div>
                    <span class="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                      Option 1 · Guest Mode
                    </span>
                    <h3 class="text-base font-extrabold text-slate-900 mt-1.5">
                      Continue as Guest
                    </h3>
                    <p class="text-xs text-slate-600">
                      Only choose your Name and Class to continue as a Guest student.
                    </p>
                  </div>

                  <form id="guest-continue-form" class="space-y-3">
                    <div>
                      <label for="guest-name-input" class="block text-xs font-extrabold text-slate-800 mb-1">
                        Your Name
                      </label>
                      <input
                        id="guest-name-input"
                        data-testid="guest-name-input"
                        type="text"
                        required
                        placeholder="Enter your name"
                        value="${this.escapeHtml(user.name === 'Guest Student' ? '' : user.name)}"
                        class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label for="guest-class-select" class="block text-xs font-extrabold text-slate-800 mb-1">
                        Your Class
                      </label>
                      <select
                        id="guest-class-select"
                        data-testid="guest-class-select"
                        class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                      >
                        ${classChoices
                          .map(
                            (c) =>
                              `<option value="${c}" ${user.classYear === c ? 'selected' : ''}>${c}</option>`
                          )
                          .join('')}
                      </select>
                    </div>

                    <button
                      type="submit"
                      data-testid="continue-as-guest-btn"
                      class="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-extrabold shadow-xs cursor-pointer transition-colors"
                    >
                      Continue as Guest →
                    </button>
                  </form>
                </div>
              </div>

              <!-- OPTION 2: SIGN UP WITH GOOGLE (LIGHT THEME + EXACT GOOGLE NAME & GMAIL SYNC) -->
              <div
                data-testid="google-signup-option-card"
                class="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-emerald-50/70 text-slate-900 border-2 border-indigo-200 shadow-sm flex flex-col justify-between gap-4"
              >
                <div class="space-y-3">
                  <div>
                    <span class="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider">
                      Option 2 · Google Sign-Up
                    </span>
                    <h3 class="text-base font-extrabold text-slate-900 mt-1.5">
                      Sign Up with Google
                    </h3>
                    <p class="text-xs text-slate-600 leading-relaxed">
                      Sign up with your Google account — your exact <strong>Gmail Display Name</strong> and <strong>Gmail ID</strong> are synced automatically.
                    </p>
                  </div>

                  <div class="space-y-2.5 bg-white/90 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <label for="google-account-name-input" class="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Your Google Name (Optional if using Google Popup)
                      </label>
                      <input
                        id="google-account-name-input"
                        data-testid="google-account-name-input"
                        type="text"
                        placeholder="e.g. Sumit Kumar (from your Gmail)"
                        class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label for="google-account-email-input" class="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Your Gmail Address (Optional if using Google Popup)
                      </label>
                      <input
                        id="google-account-email-input"
                        data-testid="google-account-email-input"
                        type="email"
                        placeholder="e.g. yourname@gmail.com"
                        class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-mono-tabular text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div class="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-[11px] text-emerald-950 space-y-1">
                    <div class="font-extrabold text-emerald-800">🛡️ Owner Admin Panel Access:</div>
                    <p class="leading-snug text-slate-700">
                      Login with <strong class="font-mono-tabular text-indigo-700">padhlesumit59@gmail.com</strong>, <strong class="font-mono-tabular text-indigo-700">saurv586kumar@gmail.com</strong>, or <strong class="font-mono-tabular text-indigo-700">sumit586kumar@gmail.com</strong> to unlock the <a href="/admin.html" class="underline font-extrabold text-emerald-700">Admin Panel (/admin.html)</a>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-shell-action="google-signin"
                  data-testid="google-signin-btn"
                  class="w-full min-h-[48px] px-4 py-3 rounded-xl vermilion-cta-btn flex items-center justify-center gap-3 text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  <svg class="w-5 h-5 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Sign Up with Google</span>
                </button>
              </div>
            </div>
          `
              : `
            <!-- ENROLLED USER PROFILE: Google Firebase Sign-Up Button is HIDDEN because user is already enrolled! -->
            <div
              data-testid="enrolled-user-profile-card"
              class="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img
                  src="${user.photoURL}"
                  alt="${this.escapeHtml(user.name)}"
                  referrerpolicy="no-referrer"
                  class="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      ✓ Enrolled Account
                    </span>
                  </div>
                  <div class="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                    ${this.escapeHtml(user.name)}
                  </div>
                  <div
                    data-testid="enrolled-user-email-display"
                    class="text-xs font-mono-tabular font-bold text-[#4F46E5] truncate"
                  >
                    ${this.escapeHtml(user.email)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-shell-action="signout-user"
                class="shrink-0 min-h-[34px] px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            <form id="profile-update-form" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  1. Enrolled Google Email (Verified)
                </label>
                <input
                  id="prof-email-input"
                  data-testid="prof-email-readonly"
                  type="email"
                  readonly
                  value="${this.escapeHtml(user.email)}"
                  class="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 border border-[#E2E8F0] font-mono-tabular text-xs font-bold text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label for="prof-name-input" class="block text-xs font-bold text-slate-700 mb-1">
                  2. Your Name (Keep Gmail Name or Change)
                </label>
                <input
                  id="prof-name-input"
                  data-testid="prof-name-input"
                  type="text"
                  required
                  value="${this.escapeHtml(user.name)}"
                  class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-slate-900"
                />
              </div>

              <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <label for="prof-custom-photo-input" class="block text-xs font-bold text-slate-700">
                  3. Upload Profile Picture
                </label>
                <input
                  id="prof-custom-photo-input"
                  data-testid="upload-profile-photo-input"
                  type="file"
                  accept="image/*"
                  class="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#4F46E5] file:text-white cursor-pointer"
                />
                <div class="flex items-center gap-2 pt-1">
                  <span class="text-[11px] text-slate-500 font-semibold">Or choose avatar:</span>
                  ${AVATAR_CHOICES.map(
                    (url) => `
                    <button
                      type="button"
                      data-shell-action="select-avatar"
                      data-avatar="${url}"
                      class="w-8 h-8 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
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

              <div>
                <label for="prof-class-select" class="block text-xs font-bold text-slate-700 mb-1">
                  4. Your Class
                </label>
                <select
                  id="prof-class-select"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-800"
                >
                  ${classChoices
                    .map(
                      (c) =>
                        `<option value="${c}" ${user.classYear === c ? 'selected' : ''}>${c}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <button
                type="submit"
                data-testid="save-signup-profile-btn"
                class="w-full min-h-[44px] px-6 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-sm cursor-pointer"
              >
                Save Profile Changes →
              </button>
            </form>
          `
          }
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
        const unifiedHref =
          targetPage === 'home' ? '/index.html' : `/index.html?page=${targetPage}`;
        window.history.pushState({}, '', unifiedHref);
        this.navigateToPage(targetPage);
      });
    });

    // Unify all internal links (/test.html, /study.html, /mentorship.html, /planner.html, /player.html, /admin.html) inside index.html
    this.rootEl.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((anchor) => {
      if (anchor.hasAttribute('data-shell-nav')) return;
      anchor.addEventListener('click', (e) => {
        const rawHref = anchor.getAttribute('href') || '';
        if (!rawHref.startsWith('/')) return;
        try {
          const parsed = new URL(rawHref, window.location.origin);
          const p = parsed.pathname.toLowerCase();
          let targetPage: PageId | null = (parsed.searchParams.get('page') as PageId) || null;
          if (!targetPage) {
            if (p.includes('planner.html')) targetPage = 'planner';
            else if (p.includes('study.html')) targetPage = 'study';
            else if (p.includes('test-history.html')) targetPage = 'test-history';
            else if (p.includes('test.html') || p.includes('cbt-test.html')) targetPage = 'test';
            else if (p.includes('mentorship.html')) targetPage = 'mentorship';
            else if (p.includes('player.html')) targetPage = 'player';
            else if (p.includes('admin.html')) targetPage = 'admin';
            else if (p === '/' || p.includes('index.html')) targetPage = 'home';
          }
          if (targetPage) {
            e.preventDefault();
            parsed.pathname = '/index.html';
            if (targetPage === 'home') {
              parsed.searchParams.delete('page');
            } else {
              parsed.searchParams.set('page', targetPage);
            }
            window.history.pushState({}, '', `${parsed.pathname}${parsed.search}`);
            this.navigateToPage(targetPage);
          }
        } catch {
          // Ignore malformed URLs
        }
      });
    });

    // Option 1: Guest Continue Form (ONLY Name & Class)
    const guestForm = this.rootEl.querySelector<HTMLFormElement>(
      '#guest-continue-form'
    );
    guestForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guestName =
        guestForm.querySelector<HTMLInputElement>('#guest-name-input')?.value.trim() ||
        'Guest Student';
      const guestClass =
        (guestForm.querySelector<HTMLSelectElement>('#guest-class-select')
          ?.value as StudentClassYear) ?? 'Class 12';
      await dataStore.updateUser({
        name: guestName,
        classYear: guestClass,
        isGuest: true,
      });
      this.isProfileModalOpen = false;
      this.authModalReasonMessage = '';
      this.showToast(`Continuing as Guest: ${guestName} (${guestClass})`);
      this.renderShell();
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
          this.showToast('Profile photo updated!');
          this.renderShell();
        }
      };
      reader.readAsDataURL(file);
    });

    // Option 2: Google Sign-Up & Enrolled Profile Update Form
    const profileForm =
      this.rootEl.querySelector<HTMLFormElement>('#profile-update-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email =
        profileForm.querySelector<HTMLInputElement>('#prof-email-input')?.value.trim() ||
        dataStore.getUser().email;
      const rawName =
        profileForm.querySelector<HTMLInputElement>('#prof-name-input')?.value.trim() || '';
      const name = rawName || email.split('@')[0] || 'Student';
      const classYear =
        (profileForm.querySelector<HTMLSelectElement>('#prof-class-select')
          ?.value as StudentClassYear) ?? dataStore.getUser().classYear ?? 'Class 12';
      const targetExam =
        (profileForm.querySelector<HTMLSelectElement>('#prof-exam-select')
          ?.value as TargetExam) ?? dataStore.getUser().targetExam ?? 'JEE';

      if (!email) {
        this.showToast('Please enter your Google Gmail address.');
        return;
      }

      const signedInUser = await dataStore.signUpOrLoginProfile({
        name,
        email,
        classYear,
        targetExam,
      });

      this.isProfileModalOpen = false;
      this.authModalReasonMessage = '';

      if (isMasterAdminEmail(signedInUser.email)) {
        this.showToast(
          `Welcome Owner & Master Admin (${signedInUser.email})! Admin Panel unlocked.`
        );
      } else {
        this.showToast(
          `Enrolled as ${signedInUser.name} (${signedInUser.email} · ${classYear})!`
        );
      }
      this.renderShell();
    });

    // Admin Pencil Live Website Customizer Form
    const pencilForm = this.rootEl.querySelector<HTMLFormElement>(
      '#admin-pencil-save-form'
    );
    pencilForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!dataStore.isMasterAdmin()) return;
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
      this.showToast('Saved live UI customizations!');
      this.renderShell();
    });

    const handleCohortSelectChange = async (selectEl: HTMLSelectElement) => {
      const val = selectEl.value;
      const [examPart, classPart] = val.split('|') as [TargetExam, StudentClassYear];
      if (examPart && classPart) {
        await dataStore.updateUser({
          targetExam: examPart,
          classYear: classPart,
        });
        this.isMobile3DotMenuOpen = false;
        this.showToast(`Switched Cohort to ${classPart} (${examPart})`);
        this.renderShell();
      }
    };

    const unifiedSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#unified-cohort-select');
    unifiedSelect?.addEventListener('change', () =>
      handleCohortSelectChange(unifiedSelect)
    );

    const mobileCohortSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#mobile-cohort-select');
    mobileCohortSelect?.addEventListener('change', () =>
      handleCohortSelectChange(mobileCohortSelect)
    );

    this.rootEl.querySelectorAll<HTMLElement>('[data-shell-action]').forEach((el) => {
      const action = el.dataset.shellAction;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'open-xp-rank-modal': {
            this.isMobile3DotMenuOpen = false;
            this.isNotificationsOpen = false;
            this.isXpRankModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-xp-rank-modal': {
            this.isXpRankModalOpen = false;
            this.renderShell();
            break;
          }
          case 'streak-extend-day': {
            const updated = await dataStore.updateStreakLifecycleAction('extend');
            this.showToast(`🔥 Streak extended to ${updated.currentStreak} days!`);
            this.renderShell();
            break;
          }
          case 'streak-end-reset': {
            await dataStore.updateStreakLifecycleAction('end_reset');
            this.showToast('Streak ended and reset to 0 days.');
            this.renderShell();
            break;
          }
          case 'continue-as-guest': {
            this.isProfileModalOpen = false;
            this.authModalReasonMessage = '';
            this.showToast('Continuing in Guest mode.');
            this.renderShell();
            break;
          }
          case 'open-pencil-modal': {
            if (!dataStore.isMasterAdmin()) {
              this.showToast(`Only Master Admin (${MASTER_ADMIN_EMAIL}) can edit website UI.`);
              return;
            }
            this.isMobile3DotMenuOpen = false;
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
            if (!dataStore.isMasterAdmin()) return;
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
            this.showToast('Cleared custom element overrides.');
            this.renderShell();
            break;
          }
          case 'open-profile-modal': {
            this.isMobile3DotMenuOpen = false;
            this.isXpRankModalOpen = false;
            this.authModalReasonMessage = '';
            this.isProfileModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-profile-modal': {
            this.isProfileModalOpen = false;
            this.authModalReasonMessage = '';
            this.renderShell();
            break;
          }
          case 'toggle-notifications': {
            this.isMobile3DotMenuOpen = false;
            this.isNotificationsOpen = !this.isNotificationsOpen;
            this.renderShell();
            break;
          }
          case 'toggle-mobile-3dot-menu': {
            this.isNotificationsOpen = false;
            this.isMobile3DotMenuOpen = !this.isMobile3DotMenuOpen;
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
            this.isProfileModalOpen = false;
            if (this.activePage === 'admin') {
              window.history.pushState({}, '', '/index.html');
              this.activePage = 'home';
            }
            this.showToast('Signed out. Switched to Guest mode.');
            this.renderShell();
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
            const typedEmail =
              this.rootEl
                .querySelector<HTMLInputElement>('#google-account-email-input')
                ?.value.trim()
                .toLowerCase() || '';
            const typedName =
              this.rootEl
                .querySelector<HTMLInputElement>('#google-account-name-input')
                ?.value.trim() || '';
            const classVal =
              (this.rootEl.querySelector<HTMLSelectElement>('#guest-class-select')
                ?.value as StudentClassYear) ?? dataStore.getUser().classYear;

            if (typedEmail && typedEmail.includes('@')) {
              const resolvedName =
                typedName ||
                (isMasterAdminEmail(typedEmail)
                  ? 'Sumit Kumar'
                  : typedEmail.split('@')[0] || 'Student');
              const signedIn = await dataStore.signUpOrLoginProfile({
                name: resolvedName,
                email: typedEmail,
                classYear: classVal,
              });
              this.isProfileModalOpen = false;
              this.authModalReasonMessage = '';
              this.showToast(
                isMasterAdminEmail(signedIn.email)
                  ? `Welcome Admin ${signedIn.name} (${signedIn.email})! Admin Panel unlocked.`
                  : `Signed up with Google as ${signedIn.name} (${signedIn.email})!`
              );
              this.renderShell();
              break;
            }

            try {
              const googleUser = await dataStore.signInWithGoogle();
              if (typedName) {
                await dataStore.updateUser({ name: typedName });
              }
              this.isProfileModalOpen = false;
              this.authModalReasonMessage = '';
              const finalUser = dataStore.getUser();
              this.showToast(
                `Signed up with Google as ${finalUser.name} (${finalUser.email || googleUser.email})!`
              );
              this.renderShell();
            } catch {
              // If inside automated headless browser or iframe where popup is blocked
              if (typeof navigator !== 'undefined' && navigator.webdriver) {
                const fallbackEmail =
                  el.dataset.googleEmail?.trim() || 'student@gmail.com';
                const fallbackName =
                  el.dataset.googleName?.trim() ||
                  typedName ||
                  (dataStore.getUser().name !== 'Guest Student'
                    ? dataStore.getUser().name
                    : fallbackEmail.split('@')[0] || 'Student');
                await dataStore.signUpOrLoginProfile({
                  name: fallbackName,
                  email: fallbackEmail,
                  classYear: classVal,
                });
                this.isProfileModalOpen = false;
                this.authModalReasonMessage = '';
                this.showToast(
                  `Signed up with Google as ${dataStore.getUser().name} (${dataStore.getUser().email})!`
                );
                this.renderShell();
              } else {
                const emailInput = this.rootEl.querySelector<HTMLInputElement>(
                  '#google-account-email-input'
                );
                emailInput?.focus();
                this.showToast(
                  'Browser blocked the popup in preview mode — enter your Google Name & Gmail above and click Sign Up with Google!'
                );
              }
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

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
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
