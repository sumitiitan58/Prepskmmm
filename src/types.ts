export type TargetExam = 'JEE' | 'NEET';
export type SubjectName = 'Physics' | 'Chemistry' | 'Math' | 'Biology';
export type TaskBucket = 'Today' | 'Backlog';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type ModuleId = 'dashboard' | 'player' | 'live' | 'cbt';
export type PageId =
  | 'home'
  | 'study'
  | 'mentorship'
  | 'test'
  | 'test-history'
  | 'planner'
  | 'player'
  | 'admin'
  | 'profile';
export type ProficiencyLevel = 'Weak' | 'Moderate' | 'Strong';
export type StudentClassYear =
  | 'Class 9'
  | 'Class 10'
  | 'Class 10 Foundation'
  | 'Class 11'
  | 'Class 11 Foundation'
  | 'Class 12'
  | 'Dropper';

export interface StreakNotificationItem {
  id: string;
  uid: string;
  studentName: string;
  currentStreak: number;
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
  hoursRemaining: number;
  title: string;
  message: string;
  actionHref: string;
  isRead?: boolean;
  createdAt: string;
}

export interface ElementStyleOverride {
  selectorKey: string;
  label?: string;
  text?: string;
  color?: string;
  bgColor?: string;
}

export interface AspirantUser {
  uid: string;
  email: string;
  name: string;
  classYear: StudentClassYear;
  targetExam: TargetExam;
  photoURL: string;
  isGuest: boolean;
  currentStreak: number;
  dailyGoalTasks?: number;
  totalFocusMinutes?: number;
  subjectFocusMinutes?: Record<SubjectName, number>;
  lastActiveDate: string;
  createdAt: string;
}

export interface FocusSessionRecord {
  id: string;
  uid: string;
  studentName: string;
  subject: SubjectName;
  durationMinutes: number;
  modeLabel: string;
  completedAt: string;
}

export interface GroupCallSchedule {
  id: string;
  title: string;
  mentorId: string;
  mentorName: string;
  scheduledTimeText: string;
  scheduledTime?: string;
  targetCohort: string;
  jitsiRoom: string;
  isActive: boolean;
  joinedStudents: { uid: string; name: string; joinedAt: string }[];
  participantNames?: string[];
  updatedAt: string;
}

export interface StreakCalendarDay {
  dayShort: string; // 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  dayLabel: string;
  dateNumber: number;
  dayNumber: number;
  isoDate: string;
  dateIso: string;
  isToday: boolean;
  status: 'streak_active' | 'today_pending' | 'upcoming' | 'missed' | 'milestone' | 'completed';
  lucideIcon:
    | 'flame'
    | 'check-circle-2'
    | 'zap'
    | 'circle-dot'
    | 'circle'
    | 'Flame'
    | 'CheckCircle2'
    | 'Zap'
    | 'CircleDot'
    | 'Circle';
  label: string;
}

export interface DailyGoalProgress {
  completedCount: number;
  completedTasks: number;
  dailyGoalTarget: number;
  totalTasksToday: number;
  totalTasks: number;
  percentage: number;
  goalProgressPct: number;
  goalMet: boolean;
  circumference: number;
  strokeDashoffset: number;
  statusLabel: string;
}

export interface MentorProfileItem {
  id: string;
  email: string;
  name: string;
  roleTitle: string;
  role: 'Master Admin' | 'Co-Admin & Mentor' | 'Video Mentor' | string;
  qualification: string;
  subjectSpecialty: SubjectName | 'All Subjects' | string;
  avatarUrl: string;
  jitsiRoomSlug: string;
  jitsiRoomPrefix: string;
  isOnline?: boolean;
  isMasterAdmin?: boolean;
  createdAt: string;
}

export interface BroadcastMessageItem {
  id: string;
  title: string;
  message: string;
  badge: string;
  badgeType: 'ANNOUNCEMENT' | 'URGENT' | 'LIVE_CLASS' | 'TEST_ALERT' | string;
  targetCohort: string;
  actionLink?: string;
  ctaLabel?: string;
  ctaHref?: string;
  senderName: string;
  senderEmail?: string;
  createdAt: string;
}

export interface SiteThemeSettings {
  brandName: string;
  brandTagline: string;
  logoDataUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceTint: string;
  surfaceBg: string;
  presetName: string;
  elementOverrides?: Record<string, ElementStyleOverride>;
  cohortThemeOverrides?: Record<
    string,
    {
      headline?: string;
      subheadline?: string;
      primaryColor?: string;
      secondaryColor?: string;
      surfaceBg?: string;
    }
  >;
  updatedAt: string;
}

export interface VideoDoubtItem {
  id: string;
  videoId: string;
  videoTitle?: string;
  studentId: string;
  studentName: string;
  timestampSeconds: number;
  timestampSec: number;
  timestampFormatted: string;
  questionText: string;
  doubtText: string;
  attachmentDataUrl?: string;
  mentorId?: string;
  mentorReply?: string;
  mentorName?: string;
  createdAt: string;
}

export interface StudyPlanWeekItem {
  subject: SubjectName;
  proficiency: ProficiencyLevel;
  allocatedHoursPerWeek: number;
  focusTopics: string;
  recommendedModule: ModuleId;
  moduleActionLabel: string;
}

export interface StudyPlanWeek {
  weekNumber: number;
  theme: string;
  totalWeeklyHours: number;
  practiceTestGoal: string;
  allocations: StudyPlanWeekItem[];
}

export interface StudyPlan {
  planId: string;
  uid: string;
  targetExam: TargetExam;
  dailyHours: number;
  proficiency: Record<string, ProficiencyLevel>;
  weeks: StudyPlanWeek[];
  createdAt: number;
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  targetExam: TargetExam;
  taskCompletionRate: number;
  bestMockScore: number;
  currentStreak: number;
  compositePoints: number;
}

export interface StudyTask {
  taskId: string;
  uid: string;
  title: string;
  subject: SubjectName;
  type: TaskBucket;
  priority?: TaskPriority;
  examFocus?: TargetExam;
  dayOfWeek?: string;
  dateIso?: string;
  dailyQuotaHours?: number;
  isCompleted: boolean;
  timestamp: number;
}

export interface BacklogKillerResult {
  subject: SubjectName;
  chapterName: string;
  pendingHours: number;
  targetDays: number;
  dailyQuotaHours: number;
  microTasks: StudyTask[];
}

export interface ClassEntity {
  id: string;
  name: string;
  order: number;
}

export interface SubjectEntity {
  id: string;
  classId: string;
  name: string;
}

export interface ChapterEntity {
  id: string;
  classId: string;
  subjectId: string;
  name: string;
}

export interface StudyMaterialItem {
  id: string;
  title: string;
  section: string; // 'PYQs' | 'Formula Sheets' | 'Hand-written Notes' | 'DPPs' or custom
  classId: string;
  cohortTag?: string;
  examTag?: 'JEE' | 'NEET' | 'BOTH';
  subjectId: string;
  pdfUrl: string;
  thumbnailUrl: string;
  downloads: number;
  pagesCount: number;
  summaryPages: string[];
  createdAt: string;
}

export interface VideoRoadmapItem {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  topicTag: string;
  section?: string;
  classCohort?: string;
  mentorId?: string;
  mentorName?: string;
  mentorEmail?: string;
  mentorRole?: string;
  mentorAvatar?: string;
  isNewRoadmap: boolean;
  createdAt: string;
}

export interface MentorshipMessage {
  id: string;
  senderName: string;
  senderRole: 'student' | 'admin';
  text: string;
  timestamp: string;
  attachmentType?: 'IMAGE' | 'VIDEO' | 'FILE' | 'APPOINTMENT';
  attachmentUrl?: string;
  attachmentName?: string;
  appointmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  appointmentTime?: string;
  appointmentTopic?: string;
}

export interface MentorshipSessionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  mentorId?: string;
  mentorName?: string;
  jitsiRoom?: string;
  requestType: 'CHAT' | 'AUDIO' | 'VIDEO';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  appointmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  scheduledCallTime?: string;
  requestedCallTime?: string;
  appointmentTopic?: string;
  messages: MentorshipMessage[];
  updatedAt: string;
}

export interface AdminQuestionItem {
  id: string;
  classId: string;
  classCohort?: StudentClassYear;
  targetExam?: TargetExam;
  mockTestTitle?: string;
  subjectId: string;
  chapterId?: string;
  subjectName: SubjectName;
  chapterName?: string;
  type: 'MCQ' | 'NUMERICAL' | 'MULTI_MCQ';
  prompt: string;
  equationBlock?: string;
  options?: [string, string, string, string];
  questionImg: string;
  solutionImg: string;
  correctVal: string;
  solutionText: string;
  marks: number;
  createdAt: string;
}

export interface FormulaSheet {
  id: string;
  title: string;
  classLevel: 'Class 11' | 'Class 12';
  subject: SubjectName;
  chapter: string;
  pageCount: number;
  examTrack: 'BOTH' | 'JEE' | 'NEET';
  highYieldFormulas: {
    label: string;
    equation: string;
    note: string;
  }[];
}

export interface LectureChapter {
  id: string;
  timestampSeconds: number;
  formattedTime: string;
  title: string;
  summary: string;
  keyEquation: string;
}

export interface LectureProgress {
  uid: string;
  lectureId: string;
  lastPositionSeconds: number;
  completed: boolean;
  notes: string;
}

export interface LivePoll {
  id: string;
  question: string;
  options: [string, string, string, string];
  votes: Record<string, number>;
  correctOptionIndex: number;
  explanation: string;
}

export interface LiveSession {
  sessionId: string;
  mentor: string;
  title: string;
  isLive: boolean;
  activePoll: {
    question: string;
    options: string[];
    votes: Record<string, number>;
  };
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: 'mentor' | 'student';
  text: string;
  isDoubt: boolean;
  timestamp: string;
}

export type QuestionStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_review'
  | 'answered_marked_review';

export interface CBTQuestion {
  id: string;
  number: number;
  subject: SubjectName;
  type: 'MCQ' | 'NAT';
  topic: string;
  classId?: string;
  chapterId?: string;
  prompt: string;
  equationBlock?: string;
  questionImg?: string;
  solutionImg?: string;
  options?: [string, string, string, string];
  correctAnswer: string;
  solution: string;
}

export interface SubjectScoreBreakdown {
  subject: SubjectName;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  unattempted: number;
  accuracyPercent: number;
}

export interface ChapterPerformanceBreakdown {
  chapter: string;
  subject: SubjectName;
  correct: number;
  total: number;
  accuracyPercent: number;
  status: 'Strong' | 'Moderate' | 'Needs Immediate Revision';
}

export interface QuestionAttemptRow {
  id: string;
  number: number;
  subject: SubjectName;
  topic: string;
  type: 'MCQ' | 'NAT';
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  status: 'CORRECT' | 'WRONG' | 'UNATTEMPTED';
  marks: number;
  solution: string;
  questionImg?: string;
  solutionImg?: string;
}

export interface TestSubmission {
  testId: string;
  uid: string;
  title?: string;
  classYear?: StudentClassYear;
  examType?: TargetExam;
  mode?: 'MOCK' | 'INFINITE_PRACTICE';
  totalQuestions?: number;
  score: number;
  maxScore?: number;
  accuracyPercent?: number;
  correctCount: number;
  wrongCount: number;
  timeTaken: number;
  subjectBreakdown: Record<string, SubjectScoreBreakdown>;
  chapterBreakdown?: ChapterPerformanceBreakdown[];
  questionRows?: QuestionAttemptRow[];
  diagnosisBullets?: string[];
  timestamp?: string;
}
