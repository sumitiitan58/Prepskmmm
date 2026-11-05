import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStreakCalendarStrip,
  calculateBacklogKillerPlan,
  calculateDailyGoalProgress,
  calculateLeaderboardCompositePoints,
  calculateMentorshipPrice,
  calculatePollPercentages,
  calculateStudentXp,
  calculateSyllabusProgress,
  computePerformanceTrendsForD3,
  computeUpdatedStreak,
  evaluateCBTSubmission,
  evaluateStreakRiskStatus,
  formatDuration,
  generateAIStudyDiagnosis,
  generatePersonalizedStudyPlan,
  getCurrentWeekKey,
  getSubjectsForExam,
  getValidInfinitePracticeCounts,
  rankLeaderboardEntries,
  selectAutoBalancedQuestions,
  selectInfinitePracticeEqualByChapter,
  summarizePaletteStatuses,
} from './examLogic';
import {
  CBT_QUESTION_BANK,
  DEFAULT_USER,
  INITIAL_CHAPTERS,
  INITIAL_LEADERBOARD,
  INITIAL_MATERIALS,
  INITIAL_MENTORS,
  INITIAL_TASKS,
  INITIAL_TEST_SUBMISSIONS,
  INITIAL_VIDEOS,
  SYLLABUS_TOPICS,
} from '../constants';
import type { CBTQuestion, LeaderboardEntry, StudyTask, TestSubmission } from '../types';

test('formatDuration formats MM:SS and HH:MM:SS accurately', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(525), '08:45');
  assert.equal(formatDuration(10800, true), '03:00:00');
});

test('getSubjectsForExam switches Math and Biology for JEE vs NEET', () => {
  assert.deepEqual(getSubjectsForExam('JEE'), ['Physics', 'Chemistry', 'Math']);
  assert.deepEqual(getSubjectsForExam('NEET'), ['Physics', 'Chemistry', 'Biology']);
});

test('calculateMentorshipPrice enforces 15/30/45 min @ Rs 75/150/225 tiers', () => {
  const tier15 = calculateMentorshipPrice(15);
  assert.equal(tier15.priceInr, 75);
  assert.ok(tier15.upiUri.includes('am=75'));

  const tier30 = calculateMentorshipPrice(30);
  assert.equal(tier30.priceInr, 150);

  const tier45 = calculateMentorshipPrice(45);
  assert.equal(tier45.priceInr, 225);
});

test('computeUpdatedStreak increments only once per active calendar day', () => {
  const firstCompletion = computeUpdatedStreak(4, '2026-11-03', '2026-11-04');
  assert.equal(firstCompletion.currentStreak, 5);
  assert.equal(firstCompletion.incremented, true);

  const secondCompletionSameDay = computeUpdatedStreak(5, '2026-11-04', '2026-11-04');
  assert.equal(secondCompletionSameDay.currentStreak, 5);
  assert.equal(secondCompletionSameDay.incremented, false);
});

test('calculatePollPercentages computes accurate vote totals and percentages', () => {
  const res = calculatePollPercentages(['A', 'B', 'C', 'D'], {
    '0': 10,
    '1': 25,
    '2': 5,
    '3': 10,
  });
  assert.equal(res.totalVotes, 50);
  assert.deepEqual(res.percentages, [20, 50, 10, 20]);
});

test('evaluateCBTSubmission applies +4 correct, -1 wrong, 0 unattempted across MCQ and NAT', () => {
  const mockQuestions: CBTQuestion[] = [
    {
      id: 'q1',
      number: 1,
      subject: 'Physics',
      type: 'MCQ',
      topic: 'Rotational Dynamics',
      prompt: 'Moment of inertia of a uniform solid sphere about its diameter:',
      options: ['(2/5)MR^2', '(2/3)MR^2', '(1/2)MR^2', 'MR^2'],
      correctAnswer: '0',
      solution: 'Solid sphere I = (2/5)MR^2.',
    },
    {
      id: 'q2',
      number: 2,
      subject: 'Chemistry',
      type: 'MCQ',
      topic: 'Electrochemistry',
      prompt: 'Number of Faradays required to reduce 1 mol of MnO4- to Mn2+:',
      options: ['3', '5', '7', '2'],
      correctAnswer: '1',
      solution: 'Oxidation state changes from +7 to +2, so 5 Faradays.',
    },
    {
      id: 'q3',
      number: 3,
      subject: 'Math',
      type: 'NAT',
      topic: 'Calculus',
      prompt: 'Evaluate integral of 2x from 0 to 3:',
      correctAnswer: '9',
      solution: 'x^2 evaluated from 0 to 3 is 9.',
    },
  ];

  const evaluation = evaluateCBTSubmission(mockQuestions, {
    q1: '0',
    q2: '0',
    q3: '',
  });

  assert.equal(evaluation.totalScore, 3);
  assert.equal(evaluation.correctCount, 1);
  assert.equal(evaluation.wrongCount, 1);
  assert.equal(evaluation.unattemptedCount, 1);
  assert.equal(evaluation.accuracyPercent, 50);
});

test('summarizePaletteStatuses tallies NTA palette buckets accurately', () => {
  const summary = summarizePaletteStatuses(['q1', 'q2', 'q3', 'q4'], {
    q1: 'answered',
    q2: 'not_answered',
    q3: 'marked_review',
  });
  assert.deepEqual(summary, {
    answered: 1,
    notAnswered: 1,
    markedReview: 1,
    notVisited: 1,
  });
});

test('generatePersonalizedStudyPlan prioritizes Weak subjects with highest weekly hours', () => {
  const plan = generatePersonalizedStudyPlan({
    uid: 'user_1',
    targetExam: 'JEE',
    dailyHours: 6,
    proficiency: {
      Physics: 'Weak',
      Chemistry: 'Moderate',
      Math: 'Strong',
    },
    planId: 'plan_test_1',
    now: 1700000000000,
  });

  assert.equal(plan.weeks.length, 4);
  assert.equal(plan.weeks[0].totalWeeklyHours, 42);
  assert.equal(plan.weeks[0].allocations[0].subject, 'Physics');
  assert.equal(plan.weeks[0].allocations[0].proficiency, 'Weak');
  assert.ok(
    plan.weeks[0].allocations[0].allocatedHoursPerWeek >
      plan.weeks[0].allocations[2].allocatedHoursPerWeek
  );
});

test('calculateLeaderboardCompositePoints and rankLeaderboardEntries rank single user as Rank #1 and multi-user Top 10 accurately', () => {
  const pts = calculateLeaderboardCompositePoints(80, 50, 5);
  assert.equal(pts, 1910);

  // Single user on the platform -> must be Rank #1!
  const soloEntries: LeaderboardEntry[] = [
    {
      uid: 'u_solo',
      name: 'Sumit Kumar',
      targetExam: 'JEE',
      taskCompletionRate: 100,
      bestMockScore: 24,
      currentStreak: 1,
      compositePoints: 1600,
    },
  ];
  const soloRanked = rankLeaderboardEntries(soloEntries, 'u_solo');
  assert.equal(soloRanked.top10.length, 1);
  assert.equal(soloRanked.top10[0].rank, 1);
  assert.equal(soloRanked.currentUserRank, 1);

  const sampleEntries: LeaderboardEntry[] = [
    {
      uid: 'u2',
      name: 'Riya',
      targetExam: 'JEE',
      taskCompletionRate: 95,
      bestMockScore: 56,
      currentStreak: 12,
      compositePoints: 2460,
    },
    {
      uid: 'u1',
      name: 'Aarav',
      targetExam: 'JEE',
      taskCompletionRate: 80,
      bestMockScore: 50,
      currentStreak: 5,
      compositePoints: 1910,
    },
  ];

  const ranked = rankLeaderboardEntries(sampleEntries, 'u1');
  assert.equal(ranked.top10[0].uid, 'u2');
  assert.equal(ranked.top10[0].rank, 1);
  assert.equal(ranked.currentUserRank, 2);
});

test('calculateBacklogKillerPlan computes daily extra quota and generates micro-tasks', () => {
  const result = calculateBacklogKillerPlan({
    uid: 'u1',
    subject: 'Physics',
    chapterName: 'Rotational Motion & IAOR',
    pendingHours: 9,
    targetDays: 6,
    examFocus: 'JEE',
    now: 1700000000000,
  });

  assert.equal(result.dailyQuotaHours, 1.5);
  assert.equal(result.microTasks.length, 3);
  assert.equal(result.microTasks[0].priority, 'High');
  assert.ok(result.microTasks[0].title.includes('1.5h/day'));
});

test('selectAutoBalancedQuestions enforces 80% MCQ + 20% NAT for JEE and 100% MCQ for NEET', () => {
  const jeeSet = selectAutoBalancedQuestions(
    CBT_QUESTION_BANK,
    'JEE',
    ['Physics', 'Chemistry', 'Math'],
    10
  );
  assert.equal(jeeSet.length, 10);
  const jeeMcqs = jeeSet.filter((q) => q.type === 'MCQ').length;
  const jeeNats = jeeSet.filter((q) => q.type === 'NAT').length;
  assert.equal(jeeMcqs, 8);
  assert.equal(jeeNats, 2);

  const neetSet = selectAutoBalancedQuestions(
    CBT_QUESTION_BANK,
    'NEET',
    ['Physics', 'Chemistry', 'Biology'],
    10
  );
  assert.equal(neetSet.length, 10);
  const neetMcqs = neetSet.filter((q) => q.type === 'MCQ').length;
  assert.equal(neetMcqs, 10);
});

test('generateAIStudyDiagnosis flags low-accuracy chapters for immediate revision', () => {
  const sampleQs = CBT_QUESTION_BANK.slice(0, 3);
  const diagnosis = generateAIStudyDiagnosis(
    sampleQs,
    { [sampleQs[0].id]: sampleQs[0].correctAnswer },
    'JEE'
  );
  assert.equal(diagnosis.chapterBreakdown.length, 3);
  assert.ok(diagnosis.diagnosisBullets.length >= 2);
});

test('calculateDailyGoalProgress computes SVG ring circumference and dashoffset dynamically', () => {
  const sampleTasks: StudyTask[] = [
    {
      taskId: 't1',
      uid: 'u1',
      title: 'Solve 15 Rotational PYQs',
      subject: 'Physics',
      type: 'Today',
      isCompleted: true,
      timestamp: 1000,
    },
    {
      taskId: 't2',
      uid: 'u1',
      title: 'Revise Nernst Equation',
      subject: 'Chemistry',
      type: 'Today',
      isCompleted: true,
      timestamp: 2000,
    },
  ];
  const progress = calculateDailyGoalProgress(sampleTasks, 4, 36);
  assert.equal(progress.completedCount, 2);
  assert.equal(progress.dailyGoalTarget, 4);
  assert.equal(progress.percentage, 50);
  assert.equal(progress.statusLabel, 'Strong Momentum');
  assert.ok(progress.strokeDashoffset > 0 && progress.strokeDashoffset < progress.circumference);
});

test('buildStreakCalendarStrip builds 7-day strip synced with currentStreak and Lucide icons', () => {
  const strip = buildStreakCalendarStrip(4, '2026-11-04', '2026-11-04');
  assert.equal(strip.length, 7);
  const activeDays = strip.filter((d) => d.status === 'streak_active');
  assert.equal(activeDays.length, 4);
  const todayItem = strip.find((d) => d.isToday);
  assert.ok(todayItem);
  assert.equal(todayItem.lucideIcon, 'flame');
});

test('getValidInfinitePracticeCounts and selectInfinitePracticeEqualByChapter enforce equal questions per chapter', () => {
  const countsFor3 = getValidInfinitePracticeCounts(3);
  assert.deepEqual(countsFor3, [3, 6, 9, 12, 15, 18, 24, 30]);

  const selectedChapters = INITIAL_CHAPTERS.slice(0, 3);
  const res = selectInfinitePracticeEqualByChapter(CBT_QUESTION_BANK, selectedChapters, 9);
  assert.equal(res.totalQuestions, 9);
  assert.equal(res.questionsPerChapter, 3);
  assert.equal(res.questions.length, 9);
  for (const ch of selectedChapters) {
    assert.equal(res.perChapterCounts[ch.id], 3);
  }
});

test('evaluateStreakRiskStatus flags CRITICAL when near midnight with 0 tasks today and SAFE when task completed', () => {
  const criticalRisk = evaluateStreakRiskStatus({
    uid: 'u1',
    studentName: 'Sumit Kumar',
    currentStreak: 6,
    lastActiveDate: '2026-11-03',
    todayIso: '2026-11-04',
    completedTasksToday: 0,
    currentHour24: 21,
  });
  assert.equal(criticalRisk.riskLevel, 'CRITICAL');
  assert.equal(criticalRisk.hoursRemaining, 3);
  assert.ok(criticalRisk.notificationPayload.title.includes('Streak at Risk'));

  const safeStatus = evaluateStreakRiskStatus({
    uid: 'u1',
    studentName: 'Sumit Kumar',
    currentStreak: 7,
    lastActiveDate: '2026-11-04',
    todayIso: '2026-11-04',
    completedTasksToday: 2,
    currentHour24: 21,
  });
  assert.equal(safeStatus.riskLevel, 'SAFE');
});

test('computePerformanceTrendsForD3 computes chronological improvement delta and subject accuracy aggregates', () => {
  const fixtureSubmissions: TestSubmission[] = [
    {
      testId: 't_1',
      uid: 'u1',
      score: 11,
      maxScore: 24,
      accuracyPercent: 60,
      correctCount: 3,
      wrongCount: 2,
      timeTaken: 1200,
      timestamp: '2026-10-27T17:00:00Z',
      subjectBreakdown: {
        Physics: { subject: 'Physics', score: 8, maxScore: 8, correct: 2, wrong: 0, unattempted: 0, accuracyPercent: 100 },
      },
    },
    {
      testId: 't_2',
      uid: 'u1',
      score: 19,
      maxScore: 24,
      accuracyPercent: 83,
      correctCount: 5,
      wrongCount: 1,
      timeTaken: 1100,
      timestamp: '2026-11-03T16:30:00Z',
      subjectBreakdown: {
        Physics: { subject: 'Physics', score: 8, maxScore: 8, correct: 2, wrong: 0, unattempted: 0, accuracyPercent: 100 },
      },
    },
  ];
  const trends = computePerformanceTrendsForD3(fixtureSubmissions);
  assert.equal(trends.chronologicalTrend.length, 2);
  assert.equal(trends.chronologicalTrend[0].accuracyPercent, 60);
  assert.equal(trends.chronologicalTrend[1].accuracyPercent, 83);
  assert.equal(trends.overallImprovementDelta, 23);
  const phy = trends.subjectAggregates.find((s) => s.subject === 'Physics');
  assert.ok(phy);
  assert.ok(phy.avgAccuracy >= 75);
});

test('calculateSyllabusProgress computes subject completion percentages and remaining topics for Google Tasks', () => {
  const completed = ['syl_phy_kinematics_nlm', 'syl_phy_rotational', 'syl_chem_bonding_periodic'];
  const jeeProgress = calculateSyllabusProgress(SYLLABUS_TOPICS, completed, 'JEE');
  assert.equal(jeeProgress.targetExam, 'JEE');
  assert.equal(jeeProgress.subjects.length, 3);
  const phy = jeeProgress.subjects.find((s) => s.subject === 'Physics');
  assert.ok(phy);
  assert.equal(phy.completedTopics, 2);
  assert.equal(phy.totalTopics, 6);
  assert.equal(phy.completionPercent, 33);
  assert.equal(jeeProgress.overallCompleted, 3);
  assert.equal(jeeProgress.remainingTopics.length, jeeProgress.overallTotal - 3);
});

test('calculateStudentXp awards +75 XP per completed task and getCurrentWeekKey returns ISO week', () => {
  assert.equal(calculateStudentXp(0), 0);
  assert.equal(calculateStudentXp(1), 75);
  assert.equal(calculateStudentXp(4), 300);
  assert.equal(calculateStudentXp(3, 50), 275);
  const wk = getCurrentWeekKey('2026-11-04');
  assert.match(wk, /^2026-W\d{2}$/);
});

test('production launch constants start with clean empty state and only Master Admin Sumit Kumar mentor', () => {
  assert.equal(DEFAULT_USER.isGuest, true);
  assert.equal(INITIAL_TASKS.length, 0);
  assert.equal(INITIAL_MATERIALS.length, 0);
  assert.equal(INITIAL_VIDEOS.length, 0);
  assert.equal(INITIAL_TEST_SUBMISSIONS.length, 0);
  assert.equal(INITIAL_LEADERBOARD.length, 0);
  assert.equal(INITIAL_MENTORS.length, 1);
  assert.equal(INITIAL_MENTORS[0].email.toLowerCase(), 'sumit586kumar@gmail.com');
});



