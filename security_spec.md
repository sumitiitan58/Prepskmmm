# Security Specification — Prepskm JEE & NEET Portal

## 1. Data Invariants
- **Identity Ownership**: Every document in `users/{userId}`, `tasks/{taskId}`, `lecture_progress/{progressId}`, and `test_submissions/{submissionId}` must belong strictly to the authenticated user (`uid == request.auth.uid`) with verified email (`request.auth.token.email_verified == true`).
- **Strict Key Allowlisting**: Every write operation enforces exact key sets via `.keys().hasAll(...)` and `.keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` on update.
- **Size & Domain Bounds**: All string fields have explicit `.size()` bounds; enum fields (`targetExam`, `subject`, `type`) are validated against strict allowlists; numeric fields (`currentStreak`, `lastPositionSeconds`, `score`) are bounded.
- **Query Enforcement**: All `allow list` rules enforce `resource.data.uid == request.auth.uid` so queries cannot scrape other aspirants' records.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on Task Creation**: `{ taskId: "t1", uid: "victim_uid", title: "Solve Irodov", subject: "Physics", type: "Today", isCompleted: false, timestamp: 1700000000 }` -> Rejected (`incoming().uid == request.auth.uid`).
2. **Shadow Field Injection on User Profile**: `{ uid: "u1", name: "Aspirant", targetExam: "JEE", currentStreak: 4, lastActiveDate: "2026-11-04", isAdmin: true }` -> Rejected (`hasOnly` check).
3. **Oversized String DoS on Scratchpad**: `notes` > 10,000 characters -> Rejected (`notes.size() <= 10000`).
4. **Invalid Enum on Target Exam**: `targetExam: "UPSC"` -> Rejected (`targetExam in ['JEE', 'NEET']`).
5. **Invalid Subject on Task**: `subject: "History"` -> Rejected (`subject in ['Physics', 'Chemistry', 'Math', 'Biology']`).
6. **Cross-User Task Read/List**: Authenticated user querying `/tasks` without `where('uid', '==', auth.uid)` -> Rejected (`resource.data.uid == request.auth.uid`).
7. **Immutable UID Mutation on Update**: Updating `uid` on an existing task -> Rejected (`incoming().uid == existing().uid` and `affectedKeys().hasOnly(...)`).
8. **Negative Streak Manipulation**: Setting `currentStreak: -5` -> Rejected (`currentStreak >= 0 && currentStreak <= 3650`).
9. **Unverified Email Write**: Token with `email_verified == false` attempting to create a task -> Rejected (`isVerifiedUser()`).
10. **Malformed Document ID Poisoning**: Creating document with ID containing spaces or special characters -> Rejected (`isValidId()`).
11. **Test Submission Score Tampering**: Updating a completed test submission after creation -> Rejected (`allow update: if false` on `test_submissions` — terminal state locked).
12. **Unbounded Poll Options in Live Session**: Injecting > 4 options into `activePoll` -> Rejected (`activePoll.options.size() == 4`).
