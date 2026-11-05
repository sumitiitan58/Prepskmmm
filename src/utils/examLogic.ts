import type {
  AdminQuestionItem,
  BacklogKillerResult,
  CBTQuestion,
  ChapterEntity,
  ChapterPerformanceBreakdown,
  DailyGoalProgress,
  LeaderboardEntry,
  ModuleId,
  ProficiencyLevel,
  QuestionStatus,
  StreakCalendarDay,
  StudyPlan,
  StudyPlanWeek,
  StudyTask,
  SubjectName,
  SubjectScoreBreakdown,
  SubjectSyllabusSummary,
  SyllabusTopicItem,
  TargetExam,
} from '../types';

/**
 * Formats seconds into MM:SS or HH:MM:SS tabular string.
 */
export function formatDuration(totalSeconds: number, forceHours = false): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0 || forceHours) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Returns valid subjects for the selected target exam.
 */
export function getSubjectsForExam(exam: TargetExam): SubjectName[] {
  return exam === 'JEE'
    ? ['Physics', 'Chemistry', 'Math']
    : ['Physics', 'Chemistry', 'Biology'];
}

/**
 * Calculates mentorship session price in INR based on duration in minutes.
 * Pricing rule: 15 mins @ ₹75, 30 mins @ ₹150, 45 mins @ ₹225 (₹5 per minute).
 */
export function calculateMentorshipPrice(durationMinutes: number): {
  durationMinutes: number;
  priceInr: number;
  tierName: string;
  upiUri: string;
  whatsappUrl: string;
} {
  const validDuration = [15, 30, 45].includes(durationMinutes)
    ? durationMinutes
    : 30;
  const priceInr = validDuration * 5;
  const tierName =
    validDuration === 15
      ? 'Rapid Audit Pass'
      : validDuration === 30
        ? 'Deep Strategy Sprint'
        : 'Full Rank Acceleration';

  const upiUri = `upi://pay?pa=sumit.prepskm@okaxis&pn=Prepskm%20Mentorship&am=${priceInr}&cu=INR&tn=${encodeURIComponent(
    `Prepskm 1:1 Mentorship (${validDuration}m)`
  )}`;
  const whatsappText = `Hi Sumit Bhaiya, I have booked the Prepskm ${validDuration}-Minute 1:1 Mentorship Pass (Rs. ${priceInr}). Please share my slot confirmation.`;
  const whatsappUrl = `https://wa.me/919876543210?text=${encodeURIComponent(whatsappText)}`;

  return {
    durationMinutes: validDuration,
    priceInr,
    tierName,
    upiUri,
    whatsappUrl,
  };
}

/**
 * Computes updated study streak when a task is completed today.
 */
export function computeUpdatedStreak(
  currentStreak: number,
  lastActiveDate: string,
  todayIsoDate: string
): { currentStreak: number; lastActiveDate: string; incremented: boolean } {
  if (lastActiveDate === todayIsoDate) {
    return {
      currentStreak: Math.max(1, currentStreak),
      lastActiveDate: todayIsoDate,
      incremented: false,
    };
  }
  return {
    currentStreak: Math.max(0, currentStreak) + 1,
    lastActiveDate: todayIsoDate,
    incremented: true,
  };
}

/**
 * Calculates poll option percentages and total votes.
 */
export function calculatePollPercentages(
  options: string[],
  votes: Record<string, number>
): { totalVotes: number; percentages: number[]; counts: number[] } {
  const counts = options.map((_, idx) => Math.max(0, Number(votes[String(idx)] ?? 0)));
  const totalVotes = counts.reduce((acc, val) => acc + val, 0);
  const percentages = counts.map((count) =>
    totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
  );
  return { totalVotes, percentages, counts };
}

/**
 * Evaluates an NTA CBT Mock Test submission using +4 for correct, -1 for wrong, 0 for unattempted.
 */
export function evaluateCBTSubmission(
  questions: CBTQuestion[],
  responses: Record<string, string>
): {
  totalScore: number;
  maxPossibleScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracyPercent: number;
  subjectBreakdown: Record<string, SubjectScoreBreakdown>;
  perQuestionResult: Record<
    string,
    { status: 'correct' | 'wrong' | 'unattempted'; marks: number; userAnswer: string }
  >;
} {
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;

  const subjectBreakdown: Record<string, SubjectScoreBreakdown> = {};
  const perQuestionResult: Record<
    string,
    { status: 'correct' | 'wrong' | 'unattempted'; marks: number; userAnswer: string }
  > = {};

  for (const q of questions) {
    if (!subjectBreakdown[q.subject]) {
      subjectBreakdown[q.subject] = {
        subject: q.subject,
        score: 0,
        maxScore: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0,
        accuracyPercent: 0,
      };
    }
    const sub = subjectBreakdown[q.subject];
    sub.maxScore += 4;

    const rawAns = responses[q.id];
    const trimmed = rawAns !== undefined ? String(rawAns).trim() : '';

    if (trimmed === '') {
      unattemptedCount += 1;
      sub.unattempted += 1;
      perQuestionResult[q.id] = {
        status: 'unattempted',
        marks: 0,
        userAnswer: '',
      };
      continue;
    }

    const isCorrect =
      q.type === 'NAT'
        ? Math.abs(Number(trimmed) - Number(q.correctAnswer)) < 0.01
        : trimmed === q.correctAnswer;

    if (isCorrect) {
      totalScore += 4;
      correctCount += 1;
      sub.score += 4;
      sub.correct += 1;
      perQuestionResult[q.id] = {
        status: 'correct',
        marks: 4,
        userAnswer: trimmed,
      };
    } else {
      totalScore -= 1;
      wrongCount += 1;
      sub.score -= 1;
      sub.wrong += 1;
      perQuestionResult[q.id] = {
        status: 'wrong',
        marks: -1,
        userAnswer: trimmed,
      };
    }
  }

  for (const key of Object.keys(subjectBreakdown)) {
    const sub = subjectBreakdown[key];
    const attempted = sub.correct + sub.wrong;
    sub.accuracyPercent =
      attempted > 0 ? Math.round((sub.correct / attempted) * 100) : 0;
  }

  const totalAttempted = correctCount + wrongCount;
  const accuracyPercent =
    totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;

  return {
    totalScore,
    maxPossibleScore: questions.length * 4,
    correctCount,
    wrongCount,
    unattemptedCount,
    accuracyPercent,
    subjectBreakdown,
    perQuestionResult,
  };
}

/**
 * Counts question palette states for the NTA CBT sidebar.
 */
export function summarizePaletteStatuses(
  questionIds: string[],
  statusMap: Record<string, QuestionStatus>
): {
  answered: number;
  notAnswered: number;
  markedReview: number;
  notVisited: number;
} {
  let answered = 0;
  let notAnswered = 0;
  let markedReview = 0;
  let notVisited = 0;

  for (const id of questionIds) {
    const st = statusMap[id] ?? 'not_visited';
    if (st === 'answered') answered += 1;
    else if (st === 'not_answered') notAnswered += 1;
    else if (st === 'marked_review' || st === 'answered_marked_review')
      markedReview += 1;
    else notVisited += 1;
  }

  return { answered, notAnswered, markedReview, notVisited };
}

const SYLLABUS_ROADMAP: Record<SubjectName, string[]> = {
  Physics: [
    'Rotational Mechanics, IAOR & Moment of Inertia Theorems',
    'Electrostatics, Gauss Law & Dielectrics in Capacitors',
    'Electromagnetic Induction, Alternating Current & LCR Resonance',
    'Modern Physics, Photoelectric Effect & Nuclear Binding Energy',
  ],
  Chemistry: [
    'Chemical Bonding, VSEPR & Coordination Isomerism',
    'Electrochemistry, Nernst Equation & Chemical Kinetics',
    'Aldehydes, Ketones, Aldol & Cannizzaro Reaction Mechanisms',
    'Thermodynamics, Ionic Equilibrium & p-Block High-Yield Trends',
  ],
  Math: [
    'Definite Integration, King Property & Differential Equations',
    'Conic Sections: Parabola, Ellipse & Director Circle Loci',
    'Matrices, Determinants, Cramers Rule & Vector 3D Planes',
    'Complex Numbers, De Moivres Theorem & Probability Distributions',
  ],
  Biology: [
    'Molecular Basis of Inheritance, Lac Operon & DNA Replication',
    'Human Physiology: Cardiac Cycle, Bohr Effect & Renal Filtration',
    'Plant Physiology: C3/C4 Photosynthesis & Chemiosmotic ATP Synthesis',
    'Biotechnology Principles (pBR322, PCR) & Hardy-Weinberg Genetics',
  ],
};

/**
 * Generates a personalized 4-week study schedule prioritizing weaker subjects
 * and recommending specific Prepskm modules and CBT practice tests.
 */
export function generatePersonalizedStudyPlan(params: {
  uid: string;
  targetExam: TargetExam;
  dailyHours: number;
  proficiency: Record<string, ProficiencyLevel>;
  planId?: string;
  now?: number;
}): StudyPlan {
  const clampedDailyHours = Math.max(2, Math.min(16, Math.round(params.dailyHours)));
  const totalWeeklyHours = clampedDailyHours * 7;
  const subjects = getSubjectsForExam(params.targetExam);

  // Weight subjects inversely to proficiency: Weak = 3, Moderate = 2, Strong = 1
  const weights: Record<ProficiencyLevel, number> = {
    Weak: 3,
    Moderate: 2,
    Strong: 1,
  };

  const totalWeight = subjects.reduce((acc, sub) => {
    const level = params.proficiency[sub] ?? 'Moderate';
    return acc + weights[level];
  }, 0);

  const weekThemes = [
    'Week 1: Core Concept Repair & High-Weightage Foundations',
    'Week 2: Multi-Concept Application & Live Classroom Derivations',
    'Week 3: Speed Drills, NAT Precision & PYQ Dissection',
    'Week 4: Full-Length NTA CBT Simulation & Error Log Consolidation',
  ];

  const weeks: StudyPlanWeek[] = weekThemes.map((theme, weekIndex) => {
    let allocatedSum = 0;
    const allocations = subjects.map((subject, subIdx) => {
      const level: ProficiencyLevel = params.proficiency[subject] ?? 'Moderate';
      const rawHours = Math.round((totalWeeklyHours * weights[level]) / totalWeight);
      const allocatedHoursPerWeek =
        subIdx === subjects.length - 1
          ? Math.max(2, totalWeeklyHours - allocatedSum)
          : Math.max(2, rawHours);
      allocatedSum += allocatedHoursPerWeek;

      const recommendedModule: ModuleId =
        level === 'Weak'
          ? weekIndex % 2 === 0
            ? 'player'
            : 'live'
          : level === 'Moderate'
            ? weekIndex % 2 === 0
              ? 'live'
              : 'cbt'
            : 'cbt';

      const moduleActionLabel =
        recommendedModule === 'player'
          ? 'Watch Private Lecture & Formula Recap'
          : recommendedModule === 'live'
            ? 'Attend Live Classroom Derivation'
            : 'Attempt Timed NTA CBT Sectional Drill';

      return {
        subject,
        proficiency: level,
        allocatedHoursPerWeek,
        focusTopics: SYLLABUS_ROADMAP[subject][weekIndex % 4],
        recommendedModule,
        moduleActionLabel,
      };
    });

    // Sort allocations so Weak subjects appear first (highest priority)
    allocations.sort((a, b) => weights[b.proficiency] - weights[a.proficiency]);

    return {
      weekNumber: weekIndex + 1,
      theme,
      totalWeeklyHours,
      practiceTestGoal:
        weekIndex < 2
          ? `Complete ${params.targetExam} Part-Syllabus CBT Mock (${15 * (weekIndex + 1)} Qs) with >75% Accuracy`
          : `Full 180-Min ${params.targetExam} NTA CBT Mock Test + Negative Marking Audit`,
      allocations,
    };
  });

  return {
    planId: params.planId ?? `plan_${params.targetExam.toLowerCase()}_${Date.now()}`,
    uid: params.uid,
    targetExam: params.targetExam,
    dailyHours: clampedDailyHours,
    proficiency: { ...params.proficiency },
    weeks,
    createdAt: params.now ?? Date.now(),
  };
}

/**
 * Computes gamified composite points from daily task completion rate (0-100),
 * best CBT mock test score, and active study streak.
 * Formula: (taskCompletionRate * 12) + (max(0, bestMockScore) * 15) + (currentStreak * 40)
 */
export function calculateLeaderboardCompositePoints(
  taskCompletionRate: number,
  bestMockScore: number,
  currentStreak: number
): number {
  const clampedRate = Math.max(0, Math.min(100, Math.round(taskCompletionRate)));
  const clampedScore = Math.max(0, Math.round(bestMockScore));
  const clampedStreak = Math.max(0, Math.round(currentStreak));
  return clampedRate * 12 + clampedScore * 15 + clampedStreak * 40;
}

/**
 * Ranks all leaderboard entries in descending order of compositePoints,
 * returning the Top 10 and the current user's standing and rank.
 */
export function rankLeaderboardEntries(
  entries: LeaderboardEntry[],
  currentUid: string
): {
  top10: (LeaderboardEntry & { rank: number })[];
  currentUserRank: number;
  currentUserEntry: (LeaderboardEntry & { rank: number }) | null;
  totalParticipants: number;
} {
  // Visibility rule: Signed-up users never see Guest users.
  // A Guest user only sees their own local guest entry alongside real signed-up users.
  const visibleEntries = entries.filter(
    (entry) => !entry.isGuest || entry.uid === currentUid
  );

  const sorted = [...visibleEntries]
    .sort((a, b) => {
      if (b.compositePoints !== a.compositePoints) {
        return b.compositePoints - a.compositePoints;
      }
      return b.bestMockScore - a.bestMockScore;
    })
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

  const currentUserEntry = sorted.find((e) => e.uid === currentUid) ?? null;

  return {
    top10: sorted.slice(0, 10),
    currentUserRank: currentUserEntry ? currentUserEntry.rank : sorted.length + 1,
    currentUserEntry,
    totalParticipants: sorted.length,
  };
}

/**
 * Backlog Killer Engine:
 * Calculates daily extra study quota (pendingHours / targetDays) and generates
 * structured micro-tasks automatically pushed into the daily to-do list.
 */
export function calculateBacklogKillerPlan(params: {
  uid: string;
  subject: SubjectName;
  chapterName: string;
  pendingHours: number;
  targetDays: number;
  examFocus: TargetExam;
  now?: number;
}): BacklogKillerResult {
  const safeHours = Math.max(1, Math.min(120, Number(params.pendingHours) || 6));
  const safeDays = Math.max(1, Math.min(60, Math.round(Number(params.targetDays) || 3)));
  const dailyQuotaHours = Math.round((safeHours / safeDays) * 10) / 10;
  const baseTs = params.now ?? Date.now();
  const cleanChapter = params.chapterName.trim() || 'Core High-Yield Chapter';
  const daysPool = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const microPhases = [
    `[Backlog · ${dailyQuotaHours}h/day] ${cleanChapter}: Concept Notes & Formula Derivation`,
    `[Backlog · ${dailyQuotaHours}h/day] ${cleanChapter}: 20 Solved Archetypes & In-Chapter Drills`,
    `[Backlog · ${dailyQuotaHours}h/day] ${cleanChapter}: 15-Year PYQ Sprint & Error Log`,
  ];

  const microTasks: StudyTask[] = microPhases.map((title, idx) => ({
    taskId: `backlog_${baseTs}_${idx}`,
    uid: params.uid,
    title,
    subject: params.subject,
    type: 'Today',
    priority: idx === 0 ? 'High' : 'Medium',
    examFocus: params.examFocus,
    dayOfWeek: daysPool[idx % daysPool.length],
    dailyQuotaHours,
    isCompleted: false,
    timestamp: baseTs + idx,
  }));

  return {
    subject: params.subject,
    chapterName: cleanChapter,
    pendingHours: safeHours,
    targetDays: safeDays,
    dailyQuotaHours,
    microTasks,
  };
}

/**
 * Intelligent Auto-Balancing Question Selector:
 * - JEE Pattern: Strictly 80% Single-Choice MCQs + 20% Numerical Input Questions (NAT).
 * - NEET Pattern: 100% Single-Choice MCQs covering selected subjects (Physics, Chemistry, Biology).
 * Distributes selection evenly across available subjects and chapters.
 */
export function selectAutoBalancedQuestions(
  questionPool: CBTQuestion[],
  examType: TargetExam,
  selectedSubjects: SubjectName[],
  totalCount: number
): CBTQuestion[] {
  const validCount = Math.max(5, Math.min(30, Math.round(totalCount / 5) * 5 || 10));
  const activeSubjects: SubjectName[] =
    selectedSubjects.length > 0 ? selectedSubjects : getSubjectsForExam(examType);

  const subjectFiltered = questionPool.filter((q) => activeSubjects.includes(q.subject));
  const pool = subjectFiltered.length > 0 ? subjectFiltered : questionPool;

  const mcqs = pool.filter((q) => q.type === 'MCQ');
  const nats = pool.filter((q) => q.type === 'NAT');

  const pickEvenlyBySubject = (items: CBTQuestion[], targetCount: number): CBTQuestion[] => {
    if (targetCount <= 0 || items.length === 0) return [];
    const bySubject = new Map<SubjectName, CBTQuestion[]>();
    for (const sub of activeSubjects) {
      bySubject.set(
        sub,
        items.filter((q) => q.subject === sub)
      );
    }

    const picked: CBTQuestion[] = [];
    let round = 0;
    while (picked.length < targetCount && round < 50) {
      let addedInRound = false;
      for (const sub of activeSubjects) {
        if (picked.length >= targetCount) break;
        const list = bySubject.get(sub) ?? [];
        if (round < list.length) {
          picked.push(list[round]);
          addedInRound = true;
        }
      }
      if (!addedInRound) break;
      round++;
    }

    // If targetCount exceeds unique items, cycle cleanly with cloned IDs
    let cloneIdx = 0;
    while (picked.length < targetCount && items.length > 0) {
      const template = items[cloneIdx % items.length];
      picked.push({
        ...template,
        id: `${template.id}_ext_${cloneIdx + 1}`,
      });
      cloneIdx++;
    }
    return picked;
  };

  let chosen: CBTQuestion[] = [];
  if (examType === 'NEET') {
    // 100% MCQs
    chosen = pickEvenlyBySubject(mcqs, validCount);
  } else {
    // JEE Pattern: Strictly 80% MCQ + 20% Numerical Input
    const natCount = Math.round(validCount * 0.2);
    const mcqCount = validCount - natCount;
    const pickedMcqs = pickEvenlyBySubject(mcqs, mcqCount);
    const pickedNats = pickEvenlyBySubject(nats, natCount);
    chosen = [...pickedMcqs, ...pickedNats];
  }

  return chosen.map((q, index) => ({
    ...q,
    number: index + 1,
  }));
}

/**
 * Generates Post-Test Chapter Strength/Weakness Breakdown and AI Study Diagnosis bullets.
 */
export function generateAIStudyDiagnosis(
  questions: CBTQuestion[],
  responses: Record<string, string>,
  examType: TargetExam
): {
  chapterBreakdown: ChapterPerformanceBreakdown[];
  diagnosisBullets: string[];
} {
  const chapterMap = new Map<
    string,
    { chapter: string; subject: SubjectName; correct: number; total: number }
  >();

  for (const q of questions) {
    const key = `${q.subject}::${q.topic}`;
    const existing = chapterMap.get(key) ?? {
      chapter: q.topic,
      subject: q.subject,
      correct: 0,
      total: 0,
    };
    existing.total += 1;

    const rawAns = responses[q.id];
    const ans = rawAns !== undefined ? String(rawAns).trim() : '';
    let isCorrect = false;
    if (ans !== '') {
      if (q.type === 'MCQ') {
        isCorrect = ans === q.correctAnswer;
      } else {
        const uVal = Number(ans);
        const cVal = Number(q.correctAnswer);
        isCorrect = !Number.isNaN(uVal) && Math.abs(uVal - cVal) <= 0.05;
      }
    }
    if (isCorrect) existing.correct += 1;
    chapterMap.set(key, existing);
  }

  const chapterBreakdown: ChapterPerformanceBreakdown[] = Array.from(chapterMap.values()).map(
    (item) => {
      const accuracyPercent =
        item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
      const status: ChapterPerformanceBreakdown['status'] =
        accuracyPercent >= 75
          ? 'Strong'
          : accuracyPercent >= 45
            ? 'Moderate'
            : 'Needs Immediate Revision';
      return {
        ...item,
        accuracyPercent,
        status,
      };
    }
  );

  const weakChapters = chapterBreakdown.filter(
    (c) => c.status === 'Needs Immediate Revision'
  );
  const strongChapters = chapterBreakdown.filter((c) => c.status === 'Strong');

  const diagnosisBullets: string[] = [];
  if (weakChapters.length > 0) {
    const names = weakChapters
      .slice(0, 3)
      .map((c) => `${c.chapter} (${c.subject})`)
      .join(', ');
    diagnosisBullets.push(
      `Immediate Revision Priority: Allocate 90 mins/day in the Backlog Killer Engine to ${names} where accuracy dropped below 45%.`
    );
  } else {
    diagnosisBullets.push(
      `Zero Critical Blindspots: All tested ${examType} chapters scored above the 45% threshold. Shift focus to speed under timed pressure.`
    );
  }

  if (strongChapters.length > 0) {
    const topNames = strongChapters
      .slice(0, 3)
      .map((c) => `${c.chapter} (${c.accuracyPercent}%)`)
      .join(', ');
    diagnosisBullets.push(
      `High-Yield Strengths: Strong command demonstrated in ${topNames}. Maintain retention via weekly 15-min Formula Sheet sprints.`
    );
  }

  diagnosisBullets.push(
    examType === 'JEE'
      ? 'JEE 80/20 Pattern Strategy: Attempt high-confidence Numerical Value (NAT) questions first before taking negative-marking risks on multi-step MCQs.'
      : 'NEET 100% MCQ Precision: Eliminate 2 options using NCERT dimensional & factual checks before locking responses to protect your +4/-1 ratio.'
  );

  return { chapterBreakdown, diagnosisBullets };
}

/**
 * Computes dynamic metrics for the Dashboard Visual Progress Ring tracking
 * daily study goals versus completed tasks.
 */
export function calculateDailyGoalProgress(
  tasks: StudyTask[],
  dailyGoalTarget = 4,
  radius = 36
): DailyGoalProgress {
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const safeTarget = Math.max(1, Math.min(25, Math.round(dailyGoalTarget || 4)));
  const percentage = Math.min(100, Math.round((completedCount / safeTarget) * 100));
  const circumference = Number((2 * Math.PI * radius).toFixed(2));
  const strokeDashoffset = Number(
    (circumference - (percentage / 100) * circumference).toFixed(2)
  );
  const goalMet = completedCount >= safeTarget;

  const statusLabel =
    percentage >= 100
      ? 'Daily Target Achieved'
      : percentage >= 50
        ? 'Strong Momentum'
        : completedCount > 0
          ? 'In Progress'
          : 'Ready to Start';

  return {
    completedCount,
    completedTasks: completedCount,
    dailyGoalTarget: safeTarget,
    totalTasksToday: tasks.length,
    totalTasks: tasks.length,
    percentage,
    goalProgressPct: percentage,
    goalMet,
    circumference,
    strokeDashoffset,
    statusLabel,
  };
}

/**
 * Generates a 7-day visual calendar strip (Mon–Sun) synced with Firebase user 'currentStreak'
 * and mapped to Lucide icons.
 */
export function buildStreakCalendarStrip(
  currentStreak: number,
  lastActiveDate = '2026-11-04',
  referenceDateOrActiveToday: string | boolean = '2026-11-04'
): StreakCalendarDay[] {
  const safeStreak = Math.max(0, Math.floor(currentStreak || 0));
  const referenceDateIso =
    typeof referenceDateOrActiveToday === 'string'
      ? referenceDateOrActiveToday
      : lastActiveDate || '2026-11-04';
  const refParts = referenceDateIso.split('-').map(Number);
  const refDate =
    refParts.length === 3 && !refParts.some(Number.isNaN)
      ? new Date(Date.UTC(refParts[0], refParts[1] - 1, refParts[2]))
      : new Date(Date.UTC(2026, 10, 4));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const strip: StreakCalendarDay[] = [];

  for (let offset = -5; offset <= 1; offset++) {
    const d = new Date(refDate.getTime() + offset * 86400000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const dayShort = dayNames[d.getUTCDay()];
    const dateNumber = d.getUTCDate();
    const isToday = offset === 0;

    if (offset > 0) {
      strip.push({
        dayShort,
        dayLabel: dayShort,
        dateNumber,
        dayNumber: dateNumber,
        isoDate,
        dateIso: isoDate,
        isToday: false,
        status: 'upcoming',
        lucideIcon: 'circle',
        label: 'Upcoming',
      });
      continue;
    }

    const daysAgo = Math.abs(offset);
    const activeToday =
      typeof referenceDateOrActiveToday === 'boolean'
        ? referenceDateOrActiveToday || safeStreak > 0
        : lastActiveDate === referenceDateIso || safeStreak > 0;
    const withinStreak =
      safeStreak > 0 &&
      (activeToday ? daysAgo < safeStreak : daysAgo > 0 && daysAgo <= safeStreak);

    if (withinStreak) {
      strip.push({
        dayShort,
        dayLabel: dayShort,
        dateNumber,
        dayNumber: dateNumber,
        isoDate,
        dateIso: isoDate,
        isToday,
        status: 'streak_active',
        lucideIcon: isToday ? 'flame' : 'check-circle-2',
        label: isToday ? 'Streak Active' : 'Completed',
      });
    } else if (isToday) {
      strip.push({
        dayShort,
        dayLabel: dayShort,
        dateNumber,
        dayNumber: dateNumber,
        isoDate,
        dateIso: isoDate,
        isToday: true,
        status: 'today_pending',
        lucideIcon: 'zap',
        label: 'Complete 1 Task',
      });
    } else {
      strip.push({
        dayShort,
        dayLabel: dayShort,
        dateNumber,
        dayNumber: dateNumber,
        isoDate,
        dateIso: isoDate,
        isToday: false,
        status: 'missed',
        lucideIcon: 'circle-dot',
        label: 'Rest Day',
      });
    }
  }

  return strip;
}

/**
 * Returns valid total question counts for Infinite Practice Mode that are strict multiples
 * of the number of selected chapters, guaranteeing every chosen chapter receives the
 * exact same number of questions.
 */
export function getValidInfinitePracticeCounts(selectedChapterCount: number): number[] {
  const n = Math.max(1, Math.floor(selectedChapterCount || 1));
  const multipliers = [1, 2, 3, 4, 5, 6, 8, 10];
  return multipliers.map((m) => n * m);
}

/**
 * Selects questions for Infinite Practice Mode such that total questions is a multiple
 * of the selected chapters and every chosen chapter contributes the exact same count.
 */
export function selectInfinitePracticeEqualByChapter(
  questionPool: CBTQuestion[],
  selectedChapters: Array<Pick<ChapterEntity, 'id' | 'name'> & { classId?: string; subjectId?: string; subjectName?: SubjectName }>,
  requestedTotalCount: number
): {
  questions: CBTQuestion[];
  questionsPerChapter: number;
  totalQuestions: number;
  perChapterCounts: Record<string, number>;
} {
  const activeChapters =
    selectedChapters.length > 0
      ? selectedChapters
      : [
          {
            id: 'ch_rotational',
            classId: 'cls_11',
            subjectId: 'sub_phy_11',
            name: 'Rotational Mechanics & IAOR',
          },
        ];

  const chapterCount = activeChapters.length;
  const questionsPerChapter = Math.max(
    1,
    Math.min(15, Math.round((requestedTotalCount || chapterCount * 2) / chapterCount))
  );
  const totalQuestions = chapterCount * questionsPerChapter;

  const chosen: CBTQuestion[] = [];
  const perChapterCounts: Record<string, number> = {};

  for (const ch of activeChapters) {
    perChapterCounts[ch.id] = 0;
    const matching = questionPool.filter(
      (q) =>
        q.chapterId === ch.id ||
        q.topic.toLowerCase().includes(ch.name.split(' ')[0].toLowerCase())
    );
    const sourcePool = matching.length > 0 ? matching : questionPool;

    for (let i = 0; i < questionsPerChapter; i++) {
      const template = sourcePool[i % sourcePool.length];
      const variantNum = Math.floor(i / sourcePool.length) + 1;
      chosen.push({
        ...template,
        id: `${ch.id}_${template.id}_p${i + 1}`,
        chapterId: ch.id,
        topic: ch.name,
        prompt:
          variantNum > 1
            ? `[Practice Set #${variantNum} · ${ch.name}] ${template.prompt}`
            : template.prompt,
      });
      perChapterCounts[ch.id] += 1;
    }
  }

  const numbered = chosen.map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));

  return {
    questions: numbered,
    questionsPerChapter,
    totalQuestions,
    perChapterCounts,
  };
}

/**
 * Evaluates whether a student is at risk of losing their study streak and returns
 * a real-time Firebase notification payload.
 */
export function evaluateStreakRiskStatus(params: {
  uid: string;
  studentName: string;
  currentStreak: number;
  lastActiveDate: string;
  todayIso: string;
  completedTasksToday: number;
  currentHour24?: number;
}): {
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
  hoursRemaining: number;
  statusHeadline: string;
  notificationPayload: {
    uid: string;
    studentName: string;
    currentStreak: number;
    riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
    hoursRemaining: number;
    title: string;
    message: string;
    actionHref: string;
  };
} {
  const safeHour = Math.max(0, Math.min(23, Math.floor(params.currentHour24 ?? 19)));
  const hoursRemaining = Math.max(1, 24 - safeHour);
  const safeStreak = Math.max(1, Math.floor(params.currentStreak || 1));
  const isCompletedToday =
    params.completedTasksToday > 0 || params.lastActiveDate === params.todayIso;

  if (isCompletedToday) {
    return {
      riskLevel: 'SAFE',
      hoursRemaining,
      statusHeadline: `🔥 ${safeStreak}-Day Streak Protected Today`,
      notificationPayload: {
        uid: params.uid,
        studentName: params.studentName,
        currentStreak: safeStreak,
        riskLevel: 'SAFE',
        hoursRemaining,
        title: `🔥 ${safeStreak}-Day Study Streak Protected!`,
        message: `Awesome work ${params.studentName}! You completed ${Math.max(1, params.completedTasksToday)} task(s) today. Complete one more backlog micro-task to boost your rank!`,
        actionHref: '/planner.html',
      },
    };
  }

  const riskLevel: 'WARNING' | 'CRITICAL' = hoursRemaining <= 5 ? 'CRITICAL' : 'WARNING';
  const statusHeadline =
    riskLevel === 'CRITICAL'
      ? `⚠️ URGENT: ${hoursRemaining}h Left Before Your ${safeStreak}-Day Streak Resets!`
      : `⚡ Streak Alert: Complete 1 Task Within ${hoursRemaining}h to Keep ${safeStreak}-Day Streak`;

  return {
    riskLevel,
    hoursRemaining,
    statusHeadline,
    notificationPayload: {
      uid: params.uid,
      studentName: params.studentName,
      currentStreak: safeStreak,
      riskLevel,
      hoursRemaining,
      title:
        riskLevel === 'CRITICAL'
          ? `🚨 Streak at Risk! Only ${hoursRemaining}h Left (${safeStreak}-Day Streak)`
          : `⚡ Don't Lose Your ${safeStreak}-Day Study Streak!`,
      message: `${params.studentName}, you haven't logged a completed study task today. Finish 1 daily task or 15-min PYQ sprint in the next ${hoursRemaining} hours to advance to Day ${safeStreak + 1}!`,
      actionHref: '/planner.html',
    },
  };
}

/**
 * Aggregates mock test submissions into chronological D3 trend points and
 * subject-wise accuracy metrics for the D3.js Performance & Test History charts.
 */
export function computePerformanceTrendsForD3(
  submissions: Array<{
    testId: string;
    title?: string;
    score: number;
    maxScore?: number;
    accuracyPercent?: number;
    correctCount: number;
    wrongCount: number;
    timestamp?: string;
    subjectBreakdown: Record<string, SubjectScoreBreakdown>;
  }>
): {
  chronologicalTrend: Array<{
    index: number;
    testId: string;
    shortLabel: string;
    title: string;
    dateLabel: string;
    accuracyPercent: number;
    scorePercent: number;
    score: number;
    maxScore: number;
  }>;
  subjectAggregates: Array<{
    subject: SubjectName;
    avgAccuracy: number;
    totalCorrect: number;
    totalWrong: number;
    totalUnattempted: number;
    totalScore: number;
    totalMaxScore: number;
    attemptsCount: number;
  }>;
  overallImprovementDelta: number;
} {
  const attemptedSubmissions = submissions.filter(
    (s) => (s.correctCount || 0) + (s.wrongCount || 0) > 0 || (s.score || 0) !== 0
  );
  const effectiveList =
    attemptedSubmissions.length >= 2 ? attemptedSubmissions : submissions;

  const sorted = [...effectiveList].sort((a, b) => {
    const tA = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tB = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tA - tB;
  });

  const chronologicalTrend = sorted.map((sub, idx) => {
    const maxScore = Math.max(4, sub.maxScore ?? 24);
    const attempted = sub.correctCount + sub.wrongCount;
    const accuracyPercent =
      sub.accuracyPercent !== undefined
        ? Math.max(0, Math.min(100, Math.round(sub.accuracyPercent)))
        : attempted > 0
          ? Math.round((sub.correctCount / attempted) * 100)
          : 0;
    const scorePercent = Math.max(0, Math.min(100, Math.round((sub.score / maxScore) * 100)));
    const rawDate = sub.timestamp ? new Date(sub.timestamp) : null;
    const dateLabel =
      rawDate && !Number.isNaN(rawDate.getTime())
        ? rawDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        : `Test #${idx + 1}`;

    return {
      index: idx + 1,
      testId: sub.testId,
      shortLabel: `T${idx + 1}`,
      title: sub.title || `Mock Test #${idx + 1}`,
      dateLabel,
      accuracyPercent,
      scorePercent,
      score: sub.score,
      maxScore,
    };
  });

  const subjectMap = new Map<
    SubjectName,
    {
      accSum: number;
      count: number;
      correct: number;
      wrong: number;
      unattempted: number;
      score: number;
      maxScore: number;
    }
  >();

  const allSubjects: SubjectName[] = ['Physics', 'Chemistry', 'Math', 'Biology'];
  for (const s of allSubjects) {
    subjectMap.set(s, {
      accSum: 0,
      count: 0,
      correct: 0,
      wrong: 0,
      unattempted: 0,
      score: 0,
      maxScore: 0,
    });
  }

  for (const sub of sorted) {
    for (const key of Object.keys(sub.subjectBreakdown || {})) {
      const sb = sub.subjectBreakdown[key];
      if (!sb) continue;
      const subjectKey = sb.subject as SubjectName;
      const entry = subjectMap.get(subjectKey);
      if (!entry) continue;
      entry.accSum += sb.accuracyPercent;
      entry.count += 1;
      entry.correct += sb.correct;
      entry.wrong += sb.wrong;
      entry.unattempted += sb.unattempted;
      entry.score += sb.score;
      entry.maxScore += sb.maxScore;
    }
  }

  const subjectAggregates = allSubjects
    .map((subject) => {
      const entry = subjectMap.get(subject)!;
      const attempted = entry.correct + entry.wrong;
      const avgAccuracy =
        attempted > 0
          ? Math.round((entry.correct / attempted) * 100)
          : entry.count > 0
            ? Math.round(entry.accSum / entry.count)
            : 0;
      return {
        subject,
        avgAccuracy,
        totalCorrect: entry.correct,
        totalWrong: entry.wrong,
        totalUnattempted: entry.unattempted,
        totalScore: entry.score,
        totalMaxScore: entry.maxScore,
        attemptsCount: entry.count,
      };
    })
    .filter((item) => item.attemptsCount > 0 || item.subject !== 'Biology');

  const overallImprovementDelta =
    chronologicalTrend.length >= 2
      ? chronologicalTrend[chronologicalTrend.length - 1].accuracyPercent -
        chronologicalTrend[0].accuracyPercent
      : 0;

  return {
    chronologicalTrend,
    subjectAggregates,
    overallImprovementDelta,
  };
}

/**
 * Updates cumulative focus minutes and subject-wise focus breakdown when a Pomodoro
 * focus session is completed in the Study Module.
 */
export function computeUpdatedFocusStats(
  currentTotalMinutes: number | undefined,
  currentSubjectMinutes: Partial<Record<SubjectName, number>> | undefined,
  subject: SubjectName,
  addedMinutes: number
): {
  totalFocusMinutes: number;
  totalFocusHours: number;
  subjectFocusMinutes: Record<SubjectName, number>;
  subjectFocusHours: Record<SubjectName, number>;
} {
  const safeAdded = Math.max(1, Math.min(300, Math.round(addedMinutes || 25)));
  const baseSubjects: Record<SubjectName, number> = {
    Physics: Math.max(0, Math.round(currentSubjectMinutes?.Physics ?? 0)),
    Chemistry: Math.max(0, Math.round(currentSubjectMinutes?.Chemistry ?? 0)),
    Math: Math.max(0, Math.round(currentSubjectMinutes?.Math ?? 0)),
    Biology: Math.max(0, Math.round(currentSubjectMinutes?.Biology ?? 0)),
  };

  baseSubjects[subject] = (baseSubjects[subject] || 0) + safeAdded;
  const computedSum =
    baseSubjects.Physics +
    baseSubjects.Chemistry +
    baseSubjects.Math +
    baseSubjects.Biology;
  const totalFocusMinutes = Math.max(
    computedSum,
    Math.max(0, Math.round(currentTotalMinutes ?? 0)) + safeAdded
  );

  const totalFocusHours = Number((totalFocusMinutes / 60).toFixed(1));
  const subjectFocusHours: Record<SubjectName, number> = {
    Physics: Number((baseSubjects.Physics / 60).toFixed(1)),
    Chemistry: Number((baseSubjects.Chemistry / 60).toFixed(1)),
    Math: Number((baseSubjects.Math / 60).toFixed(1)),
    Biology: Number((baseSubjects.Biology / 60).toFixed(1)),
  };

  return {
    totalFocusMinutes,
    totalFocusHours,
    subjectFocusMinutes: baseSubjects,
    subjectFocusHours,
  };
}

/**
 * Determines whether a student can initiate a 1:1 Voice or Video call with a mentor.
 * Calling is strictly disabled when the mentor is offline UNLESS the mentor has accepted
 * an appointment and set a scheduled call time.
 */
export function canStudentInitiateMentorCall(params: {
  isMentorOnline: boolean;
  appointmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  scheduledCallTime?: string;
}): {
  canCall: boolean;
  badgeLabel: string;
  helperText: string;
  reason: string;
} {
  if (params.isMentorOnline) {
    const helperText =
      'Mentor is online now. You can start a live 1:1 voice or video call immediately.';
    return {
      canCall: true,
      badgeLabel: 'ONLINE · INSTANT CALL UNLOCKED',
      helperText,
      reason: helperText,
    };
  }

  if (params.appointmentStatus === 'ACCEPTED' && params.scheduledCallTime) {
    const helperText = `Your appointment is approved for ${params.scheduledCallTime}. Voice & Video calls are unlocked for your slot!`;
    return {
      canCall: true,
      badgeLabel: `APPOINTMENT ACCEPTED · ${params.scheduledCallTime}`,
      helperText,
      reason: helperText,
    };
  }

  if (params.appointmentStatus === 'PENDING') {
    const helperText =
      'Mentor is currently offline. Your appointment request is PENDING — once Admin accepts and sets a time, calling will unlock.';
    return {
      canCall: false,
      badgeLabel: 'APPOINTMENT PENDING ADMIN APPROVAL',
      helperText,
      reason: helperText,
    };
  }

  if (params.appointmentStatus === 'REJECTED') {
    const helperText =
      'Mentor is offline and previous slot was declined. Use the + menu in Chat to request a new appointment slot.';
    return {
      canCall: false,
      badgeLabel: 'APPOINTMENT RESCHEDULE NEEDED',
      helperText,
      reason: helperText,
    };
  }

  const helperText =
    'Mentor has turned calls OFF right now. Click the + button in Chat below to Take an Appointment.';
  return {
    canCall: false,
    badgeLabel: 'OFFLINE · BOOK APPOINTMENT IN CHAT (+)',
    helperText,
    reason: helperText,
  };
}

/**
 * Computes subject-wise and overall syllabus completion rates for JEE / NEET
 * and returns remaining uncompleted topics for Google Tasks notification sync.
 */
export function calculateSyllabusProgress(
  allTopics: SyllabusTopicItem[],
  completedTopicIds: string[],
  targetExam: TargetExam
): {
  targetExam: TargetExam;
  overallTotal: number;
  overallCompleted: number;
  overallPercent: number;
  remainingTopics: SyllabusTopicItem[];
  subjects: SubjectSyllabusSummary[];
} {
  const completedSet = new Set(completedTopicIds || []);
  const activeSubjects = getSubjectsForExam(targetExam);
  const examTopics = allTopics.filter(
    (t) => t.examTypes.includes(targetExam) && activeSubjects.includes(t.subject)
  );

  const subjects: SubjectSyllabusSummary[] = activeSubjects.map((subject) => {
    const subTopics = examTopics.filter((t) => t.subject === subject);
    const totalTopics = subTopics.length;
    const completedTopics = subTopics.filter((t) => completedSet.has(t.id)).length;
    const completionPercent =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const remainingTopics = subTopics.filter((t) => !completedSet.has(t.id));
    return {
      subject,
      totalTopics,
      completedTopics,
      completionPercent,
      remainingTopics,
      allTopics: subTopics.map((t) => ({
        ...t,
        completed: completedSet.has(t.id),
      })),
    };
  });

  const overallTotal = examTopics.length;
  const overallCompleted = examTopics.filter((t) => completedSet.has(t.id)).length;
  const overallPercent =
    overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const remainingTopics = examTopics.filter((t) => !completedSet.has(t.id));

  return {
    targetExam,
    overallTotal,
    overallCompleted,
    overallPercent,
    remainingTopics,
    subjects,
  };
}

/**
 * Calculates total XP/HP points for a student where each completed To-Do task awards +75 XP.
 */
export function calculateStudentXp(completedTasksCount: number, bonusXp = 0): number {
  const safeCount = Math.max(0, Math.floor(completedTasksCount || 0));
  const safeBonus = Math.max(0, Math.floor(bonusXp || 0));
  return safeCount * 75 + safeBonus;
}

/**
 * Computes an ISO week key (e.g., "2026-W45") that resets every Monday for the Weekly Leaderboard.
 */
export function getCurrentWeekKey(referenceDate: Date | string = new Date()): string {
  const d =
    typeof referenceDate === 'string'
      ? new Date(`${referenceDate.slice(0, 10)}T00:00:00Z`)
      : new Date(
          Date.UTC(
            referenceDate.getFullYear(),
            referenceDate.getMonth(),
            referenceDate.getDate()
          )
        );
  if (Number.isNaN(d.getTime())) {
    return '2026-W45';
  }
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Evaluates whether a student's study streak is extended today or has ended (reset to 0)
 * due to a missed day or zero completed tasks.
 */
export function evaluateStreakLifecycle(
  currentStreak: number,
  lastActiveDate: string,
  todayIso: string,
  completedTodayCount: number
): {
  currentStreak: number;
  lastActiveDate: string;
  status: 'EXTENDED' | 'ACTIVE_TODAY' | 'ENDED_RESET' | 'INACTIVE';
  statusMessage: string;
} {
  const safeStreak = Math.max(0, Math.floor(currentStreak || 0));
  const cleanToday = (todayIso || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cleanLast = (lastActiveDate || '').slice(0, 10);

  const todayMs = Date.parse(`${cleanToday}T00:00:00Z`);
  const lastMs = cleanLast ? Date.parse(`${cleanLast}T00:00:00Z`) : Number.NaN;
  const daysDiff =
    !Number.isNaN(todayMs) && !Number.isNaN(lastMs)
      ? Math.round((todayMs - lastMs) / 86400000)
      : 999;

  if (completedTodayCount > 0) {
    if (daysDiff === 0) {
      const nextStreak = Math.max(1, safeStreak);
      return {
        currentStreak: nextStreak,
        lastActiveDate: cleanToday,
        status: 'ACTIVE_TODAY',
        statusMessage: `🔥 ${nextStreak}-Day Streak Active Today`,
      };
    }
    if (daysDiff === 1) {
      const nextStreak = safeStreak + 1;
      return {
        currentStreak: nextStreak,
        lastActiveDate: cleanToday,
        status: 'EXTENDED',
        statusMessage: `🔥 Streak Extended to ${nextStreak} Days!`,
      };
    }
    return {
      currentStreak: 1,
      lastActiveDate: cleanToday,
      status: 'EXTENDED',
      statusMessage: '🔥 New 1-Day Streak Started Today!',
    };
  }

  // No tasks completed today:
  if (daysDiff > 1 && safeStreak > 0) {
    return {
      currentStreak: 0,
      lastActiveDate: cleanLast,
      status: 'ENDED_RESET',
      statusMessage: 'Streak Ended (Missed a Day) — Complete 1 Task to Restart',
    };
  }

  if (daysDiff === 0 && completedTodayCount === 0) {
    return {
      currentStreak: 0,
      lastActiveDate: '',
      status: 'ENDED_RESET',
      statusMessage: '0-Day Streak — Complete 1 Task Today to Start Streak',
    };
  }

  return {
    currentStreak: safeStreak,
    lastActiveDate: cleanLast,
    status: safeStreak > 0 ? 'ACTIVE_TODAY' : 'INACTIVE',
    statusMessage:
      safeStreak > 0
        ? `🔥 ${safeStreak}-Day Streak — Complete 1 Task Today to Extend`
        : '0-Day Streak — Complete 1 Task to Start',
  };
}

/**
 * Calculates the student's Monthly Level.
 * Rule: Every month, finishing in Rank #1 to #20 increases the student's Level by +1.
 */
export function calculateMonthlyStudentLevel(
  baseLevel = 1,
  currentRank = 1,
  completedTop20Months = 0
): {
  level: number;
  eligibleForMonthlyPromotion: boolean;
  nextLevelAfterMonth: number;
  ruleSummary: string;
} {
  const safeBase = Math.max(1, Math.floor(baseLevel || 1));
  const safeMonths = Math.max(0, Math.floor(completedTop20Months || 0));
  const eligibleForMonthlyPromotion = currentRank >= 1 && currentRank <= 20;
  const level = safeBase + safeMonths;
  const nextLevelAfterMonth = eligibleForMonthlyPromotion ? level + 1 : level;

  return {
    level,
    eligibleForMonthlyPromotion,
    nextLevelAfterMonth,
    ruleSummary: eligibleForMonthlyPromotion
      ? `Rank #${currentRank} qualifies for Top 20! You will advance to Level ${nextLevelAfterMonth} on monthly reset.`
      : `Reach Rank #1–#20 (currently #${currentRank}) to unlock +1 Monthly Level promotion.`,
  };
}

/**
 * Generates a 100-question bank per chapter using Permutation & Combination (P&C)
 * of physical/chemical/mathematical/biological parameters, and selects the exact
 * requested number of questions per chapter (total = selectedChapters.length * questionsPerChapter).
 */
export function generateChapterPnCQuestions(
  selectedChapters: Array<{
    id: string;
    subject: SubjectName;
    chapterName?: string;
    name?: string;
    weightageLabel: string;
  }>,
  questionsPerChapter: number,
  adminQuestions: AdminQuestionItem[] = []
): {
  questions: CBTQuestion[];
  totalQuestions: number;
  questionsPerChapter: number;
  chapterPoolSize: number;
} {
  const safePerChapter = Math.max(1, Math.min(100, Math.floor(questionsPerChapter || 1)));
  const activeChapters =
    selectedChapters.length > 0
      ? selectedChapters.map((c) => ({
          id: c.id,
          subject: c.subject,
          chapterName: c.chapterName || c.name || 'Core Chapter',
          weightageLabel: c.weightageLabel || '10% Weightage',
        }))
      : [
          {
            id: 'syl_phy_rotational',
            subject: 'Physics' as SubjectName,
            chapterName: 'System of Particles & Rotational Motion',
            weightageLabel: '9% Weightage',
          },
        ];

  const chosen: CBTQuestion[] = [];

  for (const chapter of activeChapters) {
    // Build the 100-question P&C pool for this chapter:
    // 10 conceptual archetypes × 10 numerical/contextual parameter combinations = 100 unique questions
    const chapterPool: CBTQuestion[] = [];

    const matchingAdmin = adminQuestions.filter(
      (aq) =>
        aq.chapterId === chapter.id ||
        (aq.chapterName &&
          aq.chapterName.toLowerCase().includes(chapter.chapterName.split(' ')[0].toLowerCase()))
    );

    for (const aq of matchingAdmin) {
      const opts = aq.options ?? ['Option A', 'Option B', 'Option C', 'Option D'];
      const correctAns =
        aq.type === 'MCQ'
          ? opts[Number(aq.correctVal) || 0] ?? aq.correctVal ?? opts[0]
          : aq.correctVal || '0';
      chapterPool.push({
        id: `${chapter.id}_admin_${aq.id}`,
        number: chapterPool.length + 1,
        subject: chapter.subject,
        type: aq.type === 'NUMERICAL' ? 'NAT' : 'MCQ',
        topic: chapter.chapterName,
        chapterId: chapter.id,
        prompt: aq.prompt,
        equationBlock: aq.equationBlock,
        questionImg: aq.questionImg,
        solutionImg: aq.solutionImg,
        options: opts,
        correctAnswer: correctAns,
        solution: aq.solutionText || `Verified ${chapter.chapterName} solution.`,
      });
    }

    const archetypes = [
      'Fundamental Law & Conservation Application',
      'Dimensional & Limiting Case Analysis',
      'Multi-Step Numerical Problem Solving',
      'Graphical Slope & Area Interpretation',
      'Equilibrium & Stability Condition',
      'Rate of Change & Differential Formulation',
      'Energy / Potential Transformation Ratio',
      'Assertion-Reason Conceptual Trap',
      'High-Weightage PYQ Pattern Variant',
      'Experimental Measurement & Error Bound',
    ];

    const paramMultipliers = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15];

    for (let archIdx = 0; archIdx < 10; archIdx++) {
      for (let paramIdx = 0; paramIdx < 10; paramIdx++) {
        if (chapterPool.length >= 100) break;
        const pncIndex = archIdx * 10 + paramIdx + 1;
        const kVal = paramMultipliers[paramIdx];
        const mVal = archIdx + 2;
        const computedResult = kVal * mVal;
        const isNat = pncIndex % 5 === 0;

        if (isNat) {
          chapterPool.push({
            id: `${chapter.id}_pnc_${pncIndex}`,
            number: pncIndex,
            subject: chapter.subject,
            type: 'NAT',
            topic: chapter.chapterName,
            chapterId: chapter.id,
            prompt: `[${chapter.chapterName} · P&C Q#${pncIndex}/100] In an experiment on ${archetypes[archIdx]} with primary parameter α = ${kVal} units and scaling factor β = ${mVal}, calculate the exact resultant magnitude R = α × β:`,
            equationBlock: `R = α · β   (where α = ${kVal}, β = ${mVal} · ${chapter.weightageLabel})`,
            correctAnswer: String(computedResult),
            solution: `Using the ${chapter.chapterName} relation R = α × β with α = ${kVal} and β = ${mVal}, we obtain R = ${kVal} × ${mVal} = ${computedResult}.`,
          });
        } else {
          const correctOptText = `${computedResult} units (Exact State)`;
          chapterPool.push({
            id: `${chapter.id}_pnc_${pncIndex}`,
            number: pncIndex,
            subject: chapter.subject,
            type: 'MCQ',
            topic: chapter.chapterName,
            chapterId: chapter.id,
            prompt: `[${chapter.chapterName} · P&C Q#${pncIndex}/100] For a system governed by ${chapter.chapterName} (${archetypes[archIdx]}) where input state parameter is n = ${kVal} and coupling coefficient is c = ${mVal}, what is the characteristic output value (n × c)?`,
            equationBlock: `Φ(n, c) = n · c = ${kVal} × ${mVal}   [${chapter.weightageLabel}]`,
            options: [
              correctOptText,
              `${computedResult + mVal} units`,
              `${Math.max(1, computedResult - kVal)} units`,
              `${computedResult * 2} units`,
            ],
            correctAnswer: correctOptText,
            solution: `Applying ${archetypes[archIdx]} in ${chapter.chapterName}: for n = ${kVal} and c = ${mVal}, the characteristic output is n × c = ${computedResult} units.`,
          });
        }
      }
    }

    for (let i = 0; i < safePerChapter; i++) {
      const picked = chapterPool[i % chapterPool.length];
      chosen.push({
        ...picked,
        number: chosen.length + 1,
      });
    }
  }

  return {
    questions: chosen,
    totalQuestions: chosen.length,
    questionsPerChapter: safePerChapter,
    chapterPoolSize: 100,
  };
}

export interface StreakMicroAnimationState {
  shouldAnimate: boolean;
  isDailyGoalReached: boolean;
  xpAwarded: number;
  progressPercent: number;
  streakCount: number;
  headline: string;
  encouragementText: string;
  badgeLabel: string;
}

/**
 * Computes visual feedback and micro-animation state for the Streak Widget
 * when a student completes a daily study task.
 */
export function computeStreakMicroAnimationState(params: {
  completedTodayCount: number;
  dailyGoalTarget: number;
  currentStreak: number;
  streakIncremented: boolean;
  taskTitle?: string;
}): StreakMicroAnimationState {
  const safeCompleted = Math.max(0, Math.floor(params.completedTodayCount || 0));
  const safeGoal = Math.max(1, Math.floor(params.dailyGoalTarget || 4));
  const safeStreak = Math.max(0, Math.floor(params.currentStreak || 0));
  const progressPercent = Math.min(100, Math.round((safeCompleted / safeGoal) * 100));
  const isDailyGoalReached = safeCompleted >= safeGoal;
  const shouldAnimate = safeCompleted > 0;
  const cleanTitle = (params.taskTitle || 'Daily Study Task').trim();

  if (!shouldAnimate) {
    return {
      shouldAnimate: false,
      isDailyGoalReached: false,
      xpAwarded: 0,
      progressPercent: 0,
      streakCount: safeStreak,
      headline: 'Complete 1 Task Today to Ignite Your Streak',
      encouragementText: 'Check off any planned task below to trigger your +75 XP consistency boost.',
      badgeLabel: 'Awaiting First Task',
    };
  }

  if (isDailyGoalReached) {
    return {
      shouldAnimate: true,
      isDailyGoalReached: true,
      xpAwarded: 75,
      progressPercent: 100,
      streakCount: Math.max(1, safeStreak),
      headline: `Daily Goal Crushed! ${Math.max(1, safeStreak)}-Day Streak Locked In`,
      encouragementText: `"${cleanTitle}" completed (+75 XP). Your consistency is building top-1% exam momentum!`,
      badgeLabel: '+75 XP · Goal Complete!',
    };
  }

  const remaining = Math.max(0, safeGoal - safeCompleted);
  return {
    shouldAnimate: true,
    isDailyGoalReached: false,
    xpAwarded: 75,
    progressPercent,
    streakCount: Math.max(1, safeStreak),
    headline: params.streakIncremented
      ? `Streak Ignited! ${Math.max(1, safeStreak)}-Day Consistency Active`
      : `Consistency Boost! ${safeCompleted}/${safeGoal} Daily Tasks Done`,
    encouragementText: `"${cleanTitle}" completed (+75 XP). Just ${remaining} more task${remaining === 1 ? '' : 's'} to hit 100% daily target!`,
    badgeLabel: '+75 XP · Streak Active',
  };
}

