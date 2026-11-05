import type {
  AdminQuestionItem,
  AspirantUser,
  BroadcastMessageItem,
  CBTQuestion,
  ChapterEntity,
  ChatMessage,
  ClassEntity,
  FormulaSheet,
  LeaderboardEntry,
  LectureChapter,
  LivePoll,
  MentorProfileItem,
  MentorshipSessionItem,
  SiteThemeSettings,
  StudyMaterialItem,
  StudyTask,
  SubjectEntity,
  TestSubmission,
  VideoDoubtItem,
  VideoRoadmapItem,
} from './types';

export const MENTOR_AVATAR_PATH = '/src/assets/images/mentor_sumit_avatar_1793804168394.jpg';
export const LECTURE_COVER_PATH =
  '/src/assets/images/lecture_rotational_mechanics_cover_1793804167049.jpg';

export const DEFAULT_BRAND_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="prepskmGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#4F46E5"/>
        <stop offset="52%" stop-color="#7C3AED"/>
        <stop offset="100%" stop-color="#10B981"/>
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#prepskmGrad)"/>
    <path d="M18 44V20h13.5c5.5 0 9.5 3.4 9.5 8.5s-4 8.5-9.5 8.5H24.5V44H18zm6.5-12.5h6.2c2.3 0 3.8-1.2 3.8-3s-1.5-3-3.8-3h-6.2v6z" fill="#FFFFFF"/>
    <circle cx="46" cy="42" r="5" fill="#FBBF24"/>
    <path d="M46 16l2.2 4.6L53 21.5l-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.9L46 16z" fill="#FFFFFF" fill-opacity="0.92"/>
  </svg>`
)}`;

export const DEFAULT_USER: AspirantUser = {
  uid: 'local_aspirant_01',
  email: 'aarav.sharma2027@gmail.com',
  name: 'Aarav Sharma',
  classYear: 'Class 12',
  targetExam: 'JEE',
  photoURL: MENTOR_AVATAR_PATH,
  isGuest: false,
  currentStreak: 4,
  dailyGoalTasks: 4,
  totalFocusMinutes: 210,
  subjectFocusMinutes: {
    Physics: 95,
    Chemistry: 55,
    Math: 60,
    Biology: 0,
  },
  lastActiveDate: '2026-11-03',
  createdAt: '2026-10-15T09:00:00Z',
};

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const INITIAL_TASKS: StudyTask[] = [
  {
    taskId: 'task_rotational_pyq',
    uid: 'local_aspirant_01',
    title: 'Solve 25 JEE Advanced PYQs on Pure Rolling & Angular Impulse',
    subject: 'Physics',
    type: 'Today',
    priority: 'High',
    examFocus: 'JEE',
    dayOfWeek: 'Mon',
    dateIso: '2026-11-02',
    isCompleted: true,
    timestamp: 1793780000000,
  },
  {
    taskId: 'task_electrochem_nernst',
    uid: 'local_aspirant_01',
    title: 'Revise Nernst Equation & Conductometric Titration Graphs',
    subject: 'Chemistry',
    type: 'Today',
    priority: 'High',
    examFocus: 'JEE',
    dayOfWeek: 'Mon',
    dateIso: '2026-11-02',
    isCompleted: false,
    timestamp: 1793783600000,
  },
  {
    taskId: 'task_definite_integrals',
    uid: 'local_aspirant_01',
    title: 'Practice King Property & Leibniz Rule Definite Integration Set',
    subject: 'Math',
    type: 'Today',
    priority: 'Medium',
    examFocus: 'JEE',
    dayOfWeek: 'Tue',
    dateIso: '2026-11-03',
    isCompleted: false,
    timestamp: 1793787200000,
  },
  {
    taskId: 'task_genetics_pedigree',
    uid: 'local_aspirant_01',
    title: 'NCERT Line-by-Line: Molecular Basis of Inheritance & Lac Operon',
    subject: 'Biology',
    type: 'Today',
    priority: 'High',
    examFocus: 'NEET',
    dayOfWeek: 'Tue',
    dateIso: '2026-11-03',
    isCompleted: false,
    timestamp: 1793790800000,
  },
  {
    taskId: 'task_backlog_thermodynamics',
    uid: 'local_aspirant_01',
    title: 'Clear Carnot Cycle & Polytropic Process Adiabatic Work Sheet',
    subject: 'Physics',
    type: 'Backlog',
    priority: 'High',
    examFocus: 'JEE',
    dayOfWeek: 'Wed',
    dateIso: '2026-11-04',
    dailyQuotaHours: 1.5,
    isCompleted: false,
    timestamp: 1793700000000,
  },
  {
    taskId: 'task_wed_electrostatics',
    uid: 'local_aspirant_01',
    title: 'Gauss Law Flux Through Cube & Dielectric Slab Insertion Problems',
    subject: 'Physics',
    type: 'Today',
    priority: 'High',
    examFocus: 'JEE',
    dayOfWeek: 'Wed',
    dateIso: '2026-11-04',
    isCompleted: false,
    timestamp: 1793705000000,
  },
  {
    taskId: 'task_backlog_aldol',
    uid: 'local_aspirant_01',
    title: 'Master Intramolecular Aldol & Cannizzaro Reaction Mechanisms',
    subject: 'Chemistry',
    type: 'Backlog',
    priority: 'Medium',
    examFocus: 'JEE',
    dayOfWeek: 'Thu',
    dateIso: '2026-10-29',
    dailyQuotaHours: 1.0,
    isCompleted: false,
    timestamp: 1793710000000,
  },
  {
    taskId: 'task_backlog_conics',
    uid: 'local_aspirant_01',
    title: 'Complete Focal Chord & Director Circle Locus Problems (Parabola)',
    subject: 'Math',
    type: 'Backlog',
    priority: 'Medium',
    examFocus: 'JEE',
    dayOfWeek: 'Fri',
    dateIso: '2026-10-30',
    dailyQuotaHours: 1.2,
    isCompleted: true,
    timestamp: 1793720000000,
  },
  {
    taskId: 'task_backlog_plant_phys',
    uid: 'local_aspirant_01',
    title: 'Revise C3 vs C4 Kranz Anatomy & Chemiosmotic Hypothesis',
    subject: 'Biology',
    type: 'Backlog',
    priority: 'Low',
    examFocus: 'NEET',
    dayOfWeek: 'Sat',
    dateIso: '2026-10-31',
    dailyQuotaHours: 1.0,
    isCompleted: false,
    timestamp: 1793730000000,
  },
  {
    taskId: 'task_sun_mock_analysis',
    uid: 'local_aspirant_01',
    title: 'Full 3-Hour NTA Mock Test Review & Error Notebook Update',
    subject: 'Physics',
    type: 'Today',
    priority: 'High',
    examFocus: 'JEE',
    dayOfWeek: 'Sun',
    dateIso: '2026-11-01',
    dailyQuotaHours: 2.0,
    isCompleted: false,
    timestamp: 1793740000000,
  },
];

export const FORMULA_SHEETS: FormulaSheet[] = [
  {
    id: 'fs_mechanics_11',
    title: 'Rigid Body Dynamics & Rotational Mechanics',
    classLevel: 'Class 11',
    subject: 'Physics',
    chapter: 'Mechanics II',
    pageCount: 14,
    examTrack: 'BOTH',
    highYieldFormulas: [
      {
        label: 'Parallel & Perpendicular Axis Theorems',
        equation: 'I = I_cm + M·d²   |   I_z = I_x + I_y',
        note: 'Valid for any 3D rigid body (Parallel) and planar lamina (Perpendicular).',
      },
      {
        label: 'Rolling Without Slipping Acceleration on Incline',
        equation: 'a_cm = (g · sin θ) / (1 + I_cm / (M·R²))',
        note: 'Minimum friction required: f_s = M·g·sin θ / (1 + M·R² / I_cm).',
      },
      {
        label: 'Conservation of Angular Momentum',
        equation: 'τ_ext = dL/dt = 0  ⇒  I₁ω₁ + m(r × v) = I₂ω₂',
        note: 'Always evaluate about the instantaneous axis of zero external torque.',
      },
    ],
  },
  {
    id: 'fs_chem_bonding_11',
    title: 'Chemical Bonding, VSEPR & Molecular Orbital Theory',
    classLevel: 'Class 11',
    subject: 'Chemistry',
    chapter: 'Inorganic Foundations',
    pageCount: 11,
    examTrack: 'BOTH',
    highYieldFormulas: [
      {
        label: 'Steric Number & Hybridization Index',
        equation: 'SN = ½ [V + M - C + A]',
        note: 'V = valence e⁻ of central atom, M = monovalent atoms, C/A = charge.',
      },
      {
        label: 'MOT Bond Order & Magnetic Moment',
        equation: 'B.O. = ½ (N_b - N_a)   |   μ = √(n(n+2)) B.M.',
        note: 'B₂ and O₂ are paramagnetic due to unpaired π* / π electrons.',
      },
      {
        label: 'Fajans Rule Covalent Character Polarizability',
        equation: 'Polarizing Power ∝ Charge / (Ionic Radius)²',
        note: 'Small cation + large anion maximizes covalent character (LiI > CsI).',
      },
    ],
  },
  {
    id: 'fs_conics_11',
    title: 'Conic Sections: Parabola, Ellipse & Hyperbola',
    classLevel: 'Class 11',
    subject: 'Math',
    chapter: 'Coordinate Geometry',
    pageCount: 16,
    examTrack: 'JEE',
    highYieldFormulas: [
      {
        label: 'Standard Tangent in Slope Form (Parabola y² = 4ax)',
        equation: 'y = m·x + a/m   (Point of contact: (a/m², 2a/m))',
        note: 'Director circle of parabola is its directrix x + a = 0.',
      },
      {
        label: 'Director Circle of Standard Ellipse',
        equation: 'x² + y² = a² + b²',
        note: 'Locus of intersection of perpendicular tangents to x²/a² + y²/b² = 1.',
      },
      {
        label: 'Asymptotes of Rectangular Hyperbola',
        equation: 'x·y = c²  ⇒  Parametric point (ct, c/t)',
        note: 'Orthocenter of triangle inscribed in xy = c² lies on the hyperbola itself.',
      },
    ],
  },
  {
    id: 'fs_physiology_11',
    title: 'Human Physiology: Cardiac Cycle & Bohr Dissociation',
    classLevel: 'Class 11',
    subject: 'Biology',
    chapter: 'Human Physiology',
    pageCount: 18,
    examTrack: 'NEET',
    highYieldFormulas: [
      {
        label: 'Cardiac Output & Stroke Volume Relation',
        equation: 'CO = SV × HR ≈ 70 mL × 72 bpm = 5040 mL/min',
        note: 'Ventricular systole = 0.3s, Joint diastole = 0.4s (Total cycle = 0.8s).',
      },
      {
        label: 'Glomerular Net Filtration Pressure (NFP)',
        equation: 'NFP = GHP (60) - [BCOP (32) + CHP (18)] = 10 mmHg',
        note: 'GFR in healthy adult = 125 mL/min or 180 Liters/day.',
      },
      {
        label: 'Oxygen-Hemoglobin Dissociation Right Shift (Bohr Effect)',
        equation: '↑ pCO₂, ↑ [H⁺], ↑ Temp, ↑ 2,3-BPG  ⇒  ↑ P₅₀ (O₂ Unloading)',
        note: 'Occurs in metabolically active tissues; left shift occurs in alveoli.',
      },
    ],
  },
  {
    id: 'fs_electrodynamics_12',
    title: 'Electrostatics, Gauss Law & Electromagnetic Induction',
    classLevel: 'Class 12',
    subject: 'Physics',
    chapter: 'Electrodynamics',
    pageCount: 19,
    examTrack: 'BOTH',
    highYieldFormulas: [
      {
        label: 'Gauss Law & Electric Field of Non-Conducting Sphere',
        equation: '∮ E · dA = Q_enc / ε₀   |   E_in = (k·Q·r) / R³',
        note: 'Potential at center of solid sphere V_c = 1.5 · (kQ/R).',
      },
      {
        label: 'Faraday-Lenz Law & Motional EMF of Rotating Rod',
        equation: 'ε = -dΦ_B / dt   |   ε_rot = ½ · B · ω · L²',
        note: 'Induced electric field lines form closed loops (non-conservative).',
      },
      {
        label: 'LCR Series Resonance & Quality Factor',
        equation: 'ω₀ = 1 / √(L·C)   |   Q = (1/R) · √(L/C)',
        note: 'At resonance, impedance Z = R and power factor cos φ = 1.',
      },
    ],
  },
  {
    id: 'fs_organic_12',
    title: 'Organic Reaction Mechanisms & Named Reactions Mastermap',
    classLevel: 'Class 12',
    subject: 'Chemistry',
    chapter: 'Organic Chemistry',
    pageCount: 22,
    examTrack: 'BOTH',
    highYieldFormulas: [
      {
        label: 'Reimer-Tiemann vs Kolbe-Schmitt Ortho Selectivity',
        equation: 'Phenol + CHCl₃ + aq. NaOH → Salicylaldehyde (:CCl₂ electrophile)',
        note: 'Dichlorocarbene has incomplete octet (6 valence e⁻, singlet state).',
      },
      {
        label: 'Hofmann Bromamide Degradation Step-Down',
        equation: 'R-CONH₂ + Br₂ + 4NaOH → R-NH₂ + Na₂CO₃ + 2NaBr + 2H₂O',
        note: 'Proceeds via concerted alkyl shift on nitrene/isocyanate; retention of configuration.',
      },
      {
        label: 'Aldol Condensation vs Cannizzaro Disproportionation',
        equation: '2 HCHO + conc. NaOH (50%) → HCOONa + CH₃OH',
        note: 'Hydride transfer is the rate-determining step (Order = 3 in concentrated base).',
      },
    ],
  },
  {
    id: 'fs_calculus_12',
    title: 'Definite Integration, Differential Equations & Area Under Curves',
    classLevel: 'Class 12',
    subject: 'Math',
    chapter: 'Integral Calculus',
    pageCount: 15,
    examTrack: 'JEE',
    highYieldFormulas: [
      {
        label: 'Leibniz Rule for Differentiation Under Integral Sign',
        equation: 'd/dx [∫_{g(x)}^{h(x)} f(t) dt] = f(h(x))·h′(x) - f(g(x))·g′(x)',
        note: 'Crucial for functional equation limits in JEE Advanced Paper 1 & 2.',
      },
      {
        label: 'First-Order Linear Differential Equation Integrating Factor',
        equation: 'dy/dx + P(x)·y = Q(x)  ⇒  I.F. = exp(∫ P(x) dx)',
        note: 'General solution: y · (I.F.) = ∫ Q(x) · (I.F.) dx + C.',
      },
      {
        label: 'Wallis & King Property Symmetry Reduction',
        equation: '∫_a^b f(x) dx = ∫_a^b f(a + b - x) dx',
        note: 'Reduces trigonometric and logarithmic rational integrals in one step.',
      },
    ],
  },
  {
    id: 'fs_genetics_12',
    title: 'Molecular Genetics, Hardy-Weinberg & Recombinant DNA Tech',
    classLevel: 'Class 12',
    subject: 'Biology',
    chapter: 'Genetics & Evolution',
    pageCount: 17,
    examTrack: 'NEET',
    highYieldFormulas: [
      {
        label: 'Hardy-Weinberg Allelic & Genotypic Equilibrium',
        equation: 'p + q = 1   |   p² (AA) + 2pq (Aa) + q² (aa) = 1',
        note: 'Carrier frequency in autosomal recessive traits is always 2pq.',
      },
      {
        label: 'DNA Double Helix Pitch & Chargaff Equivalence',
        equation: '[A] + [G] = [T] + [C]   |   Length = Total bp × 0.34 nm',
        note: 'E. coli has 4.6 × 10⁶ bp; Human haploid genome has 3.3 × 10⁹ bp.',
      },
      {
        label: 'Linkage & Recombination Frequency Map Distance',
        equation: '1 Centimorgan (cM) = 1% Recombinant Progeny Frequency',
        note: 'Maximum recombination frequency between two genes is 50%.',
      },
    ],
  },
];

export const LECTURE_CHAPTERS: LectureChapter[] = [
  {
    id: 'ch_1',
    timestampSeconds: 0,
    formattedTime: '00:00',
    title: 'Intro & Instantaneous Axis of Rotation (IAOR)',
    summary: 'Understanding combined translational and rotational velocity vectors on a rigid body.',
    keyEquation: 'v_P = v_cm + ω × r_P/cm',
  },
  {
    id: 'ch_2',
    timestampSeconds: 525, // 08:45
    formattedTime: '08:45',
    title: 'Moment of Inertia & Parallel Axis Theorem',
    summary: 'Deriving I for hollow vs solid cylinders, discs, and eccentric cavity subtraction.',
    keyEquation: 'I_axis = I_cm + M · d²',
  },
  {
    id: 'ch_3',
    timestampSeconds: 980, // 16:20
    formattedTime: '16:20',
    title: 'Torque & Conservation of Angular Momentum',
    summary: 'Choosing a stationary point where external torque vanishes during eccentric collisions.',
    keyEquation: 'L_O = I_cm · ω + M (r_cm × v_cm)',
  },
  {
    id: 'ch_4',
    timestampSeconds: 1450, // 24:10
    formattedTime: '24:10',
    title: 'Rolling Motion on Inclined Plane & Friction Direction',
    summary: 'Condition for pure rolling v_cm = Rω, acceleration a = g sinθ / (1 + k²/R²).',
    keyEquation: 'a_cm = (g · sin θ) / (1 + I / M·R²)',
  },
  {
    id: 'ch_5',
    timestampSeconds: 1970, // 32:50
    formattedTime: '32:50',
    title: 'Toppling vs Slipping & JEE Advanced PYQ Dissection',
    summary: 'Normal reaction shift Δx at critical tipping torque before static friction saturates.',
    keyEquation: 'F_topple = M·g · (b / 2h)  vs  f_max = μ_s · M·g',
  },
];

export const LECTURE_TOTAL_DURATION_SECONDS = 2400; // 40:00 full masterclass

export const INITIAL_SCRATCHPAD_NOTES = `# Lecture Scratchpad: Rotational Dynamics (L-04)
- Pure rolling condition on stationary surface: v_contact = v_cm - R*omega = 0
- Acceleration down incline: Solid Sphere (5/7 g sinθ) > Disc (2/3 g sinθ) > Ring (1/2 g sinθ)
- Remember: Static friction does ZERO net work in pure rolling on a fixed incline!
- Action item: Re-solve 2023 JEE Adv Paper-2 Chimney Toppling problem tonight.`;

export const LIVE_POLL_BANK: LivePoll[] = [
  {
    id: 'poll_rolling_race',
    question:
      'A uniform solid sphere, a solid cylinder, and a thin hollow ring of identical mass M and radius R are released from rest from the top of a rough incline (pure rolling). Which reaches the bottom with maximum translational speed?',
    options: [
      'A) Solid Sphere (I = 2/5 MR²)',
      'B) Solid Cylinder (I = 1/2 MR²)',
      'C) Thin Hollow Ring (I = MR²)',
      'D) All reach with identical speed',
    ],
    votes: { '0': 142, '1': 31, '2': 14, '3': 19 },
    correctOptionIndex: 0,
    explanation:
      'Since v = √(2gh / (1 + I/MR²)), smaller shape factor β = I/MR² yields higher speed. Solid sphere has β = 0.4, the smallest among the three.',
  },
  {
    id: 'poll_angular_impulse',
    question:
      'A uniform rod of mass M and length L rests on a smooth horizontal table. A horizontal impulse J is applied perpendicular to the rod at a distance x from its center so that the opposite end begins to move with zero initial velocity. Find x:',
    options: [
      'A) L / 6 (Center of Percussion)',
      'B) L / 4',
      'C) L / 3',
      'D) L / 12',
    ],
    votes: { '0': 96, '1': 28, '2': 22, '3': 18 },
    correctOptionIndex: 0,
    explanation:
      'v_cm = J/M and ω = J·x / (ML²/12). Setting v_end = v_cm - ω(L/2) = 0 gives 1/M = 6x/(ML²), so x = L/6.',
  },
  {
    id: 'poll_bohr_orbit',
    question:
      'According to Bohr quantization, if an electron in a Hydrogen atom jumps from n = 4 to n = 2, by what factor does its orbital angular momentum change?',
    options: [
      'A) Decreases by h / π (Halved)',
      'B) Decreases by h / 2π',
      'C) Increases by 2×',
      'D) Remains conserved',
    ],
    votes: { '0': 118, '1': 34, '2': 9, '3': 15 },
    correctOptionIndex: 0,
    explanation:
      'L = n·h/(2π). Change ΔL = (4 - 2)h/(2π) = h/π, which is half of the initial angular momentum.',
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    sender: 'Sumit (Mentor • IITR)',
    role: 'mentor',
    text: 'Welcome everyone! Keep your formula sheet open to Page 4. We are deriving the Instantaneous Axis of Rotation (IAOR) shortcut for rolling cylinders right now.',
    isDoubt: false,
    timestamp: '19:02',
  },
  {
    id: 'msg_2',
    sender: 'Riya Verma (AIR Target <500)',
    role: 'student',
    text: 'Sir, if the plank underneath the cylinder is also accelerating, does v = Rω still hold at the bottom point?',
    isDoubt: true,
    timestamp: '19:04',
  },
  {
    id: 'msg_3',
    sender: 'Sumit (Mentor • IITR)',
    role: 'mentor',
    text: '@Riya Great doubt! No — for a moving plank, match the absolute velocity of the contact point: v_cm - Rω = v_plank (and a_cm - Rα = a_plank).',
    isDoubt: false,
    timestamp: '19:05',
  },
  {
    id: 'msg_4',
    sender: 'Karthik Nair',
    role: 'student',
    text: 'Crystal clear derivation on the smartboard! That β = I/(MR²) table saved me 2 minutes per question.',
    isDoubt: false,
    timestamp: '19:06',
  },
];

export const CBT_QUESTIONS: CBTQuestion[] = [
  // PHYSICS (4 MCQ + 1 NAT)
  {
    id: 'phy_1',
    number: 1,
    subject: 'Physics',
    type: 'MCQ',
    topic: 'Rotational Mechanics',
    prompt:
      'A solid cylinder of mass 2 kg and radius 0.2 m rolls without slipping down a rough inclined plane of inclination 30° with the horizontal. What is the magnitude of static friction acting on the cylinder during its motion? (Take g = 9.8 m/s²)',
    equationBlock: 'f_s = (M · g · sin θ) / (1 + M·R² / I_cm)',
    options: ['3.27 N', '4.90 N', '6.53 N', '1.63 N'],
    correctAnswer: '0',
    solution:
      'For a solid cylinder, I_cm = ½MR². Thus f_s = (M g sin 30°) / (1 + 2) = (2 × 9.8 × 0.5) / 3 = 9.8 / 3 = 3.27 N.',
  },
  {
    id: 'phy_2',
    number: 2,
    subject: 'Physics',
    type: 'MCQ',
    topic: 'Electrodynamics & Capacitors',
    prompt:
      'Two identical parallel plate capacitors of capacitance C each are connected in series with a battery of EMF V. Now a dielectric slab of dielectric constant K = 3 is completely inserted between the plates of one capacitor while the battery remains connected. The ratio of final total electrostatic energy to initial total energy stored in the system is:',
    equationBlock: 'C_eq = (C₁ · C₂) / (C₁ + C₂)   |   U = ½ · C_eq · V²',
    options: ['3 : 2', '2 : 3', '4 : 3', '9 : 4'],
    correctAnswer: '0',
    solution:
      'Initially C_eq,i = C/2. After inserting K = 3 into one capacitor, its capacitance becomes 3C. New C_eq,f = (3C × C)/(3C + C) = 3C/4. Since V is constant, U_f / U_i = (3C/4) / (C/2) = 3 : 2.',
  },
  {
    id: 'phy_3',
    number: 3,
    subject: 'Physics',
    type: 'MCQ',
    topic: 'Modern Physics & De Broglie Wavelength',
    prompt:
      'A proton and an alpha particle are accelerated from rest through the same electrostatic potential difference V. The ratio of their de Broglie wavelengths (λ_p : λ_α) is:',
    equationBlock: 'λ = h / √(2 · m · q · V)',
    options: ['2√2 : 1', '√2 : 1', '4 : 1', '1 : 2√2'],
    correctAnswer: '0',
    solution:
      'Since λ ∝ 1 / √(m·q), with m_α = 4 m_p and q_α = 2 q_p, we get λ_p / λ_α = √(4 × 2) = √8 = 2√2 : 1.',
  },
  {
    id: 'phy_4',
    number: 4,
    subject: 'Physics',
    type: 'MCQ',
    topic: 'Thermodynamics & Adiabatic Process',
    prompt:
      'An ideal monoatomic gas (γ = 5/3) undergoes a polytropic process where P·V² = constant. What is the molar heat capacity C of the gas during this process?',
    equationBlock: 'C = C_v + R / (1 - x)   where P·V^x = constant',
    options: ['R / 2', '3R / 2', '5R / 2', '2R'],
    correctAnswer: '0',
    solution:
      'For a monoatomic gas, C_v = 3R/2. With polytropic exponent x = 2, C = 3R/2 + R/(1 - 2) = 3R/2 - R = R/2.',
  },
  {
    id: 'phy_5',
    number: 5,
    subject: 'Physics',
    type: 'NAT',
    topic: 'gravitation & Escape Velocity',
    prompt:
      'A uniform circular disc of mass 6 kg and radius 2 m is rotating about an axis passing through its center and perpendicular to its plane at an angular speed of 5 rad/s. Calculate its rotational kinetic energy in Joules (enter integer value):',
    equationBlock: 'K_rot = ½ · I_cm · ω²   where I_disc = ½ · M · R²',
    correctAnswer: '150',
    solution:
      'I_disc = ½ × 6 × (2)² = 12 kg·m². Rotational KE = ½ × 12 × (5)² = 6 × 25 = 150 J.',
  },

  // CHEMISTRY (4 MCQ + 1 NAT)
  {
    id: 'chem_1',
    number: 6,
    subject: 'Chemistry',
    type: 'MCQ',
    topic: 'Chemical Bonding & VSEPR',
    prompt:
      'Which of the following pairs of chemical species are both isoelectronic and isostructural (having the exact same molecular geometry)?',
    equationBlock: 'SN = ½ [V + M - C + A]',
    options: [
      'ICl₂⁻ and XeF₂ (Linear)',
      'NO₃⁻ and ClO₃⁻',
      'SO₃ and NH₃',
      'BF₃ and BrF₃',
    ],
    correctAnswer: '0',
    solution:
      'Both ICl₂⁻ and XeF₂ have 22 valence electrons, Steric Number 5 (sp³d hybridization) with 2 bond pairs and 3 equatorial lone pairs, giving a strictly linear geometry.',
  },
  {
    id: 'chem_2',
    number: 7,
    subject: 'Chemistry',
    type: 'MCQ',
    topic: 'Chemical Kinetics',
    prompt:
      'For a first-order gaseous decomposition reaction A(g) → 2B(g) + C(g), the time required for 99.9% completion of the reaction is how many times the half-life (t_1/2) of the reaction?',
    equationBlock: 't = (2.303 / k) · log₁₀([A]₀ / [A]_t)',
    options: ['10 times', '3.32 times', '6.64 times', '100 times'],
    correctAnswer: '0',
    solution:
      't_99.9% / t_50% = log₁₀(100 / 0.1) / log₁₀(2) = log₁₀(10³) / 0.3010 = 3 / 0.3010 ≈ 10.',
  },
  {
    id: 'chem_3',
    number: 8,
    subject: 'Chemistry',
    type: 'MCQ',
    topic: 'Organic Chemistry: Carbonyls',
    prompt:
      'When benzaldehyde (C₆H₅CHO) is heated with concentrated 50% NaOH solution, it undergoes disproportionation (Cannizzaro reaction). Which statement accurately describes the rate-determining step?',
    equationBlock: '2 Ph-CHO + OH⁻ → Ph-COO⁻ + Ph-CH₂OH',
    options: [
      'Intermolecular hydride (H⁻) transfer to the second aldehyde molecule',
      'Nucleophilic attack of OH⁻ on carbonyl carbon',
      'Proton exchange between carboxylic acid and alkoxide ion',
      'Formation of a resonance-stabilized enolate carbanion',
    ],
    correctAnswer: '0',
    solution:
      'In the Cannizzaro reaction, the slow rate-determining step is the intermolecular hydride ion (H⁻) shift from the tetrahedral hydroxyalkoxide intermediate to a second molecule of benzaldehyde.',
  },
  {
    id: 'chem_4',
    number: 9,
    subject: 'Chemistry',
    type: 'MCQ',
    topic: 'Coordination Compounds',
    prompt:
      'What is the spin-only magnetic moment (in Bohr Magnetons) and hybridization of the complex ion [Ni(CN)₄]²⁻ (Atomic number of Ni = 28)?',
    equationBlock: 'Ni²⁺ = [Ar] 3d⁸   |   CN⁻ is a strong-field π-acceptor ligand',
    options: [
      '0 B.M. and dsp² (Square Planar)',
      '2.83 B.M. and sp³ (Tetrahedral)',
      '0 B.M. and sp³',
      '1.73 B.M. and dsp²',
    ],
    correctAnswer: '0',
    solution:
      'In [Ni(CN)₄]²⁻, strong-field CN⁻ pairs all eight 3d electrons into four d-orbitals, leaving one 3d orbital vacant for dsp² square planar hybridization with 0 unpaired electrons (μ = 0 B.M.).',
  },
  {
    id: 'chem_5',
    number: 10,
    subject: 'Chemistry',
    type: 'NAT',
    topic: 'Electrochemistry & Faraday Law',
    prompt:
      'How many moles of electrons (Faradays) are required to completely reduce 1 mole of dichromate ions (Cr₂O₇²⁻) to Cr³⁺ ions in an acidic medium?',
    equationBlock: 'Cr₂O₇²⁻ + 14H⁺ + n e⁻ → 2Cr³⁺ + 7H₂O',
    correctAnswer: '6',
    solution:
      'Each Cr atom changes oxidation state from +6 to +3 (gain of 3 e⁻). For 2 Cr atoms in Cr₂O₇²⁻, total electrons transferred n = 6 moles.',
  },

  // MATHEMATICS (4 MCQ + 1 NAT — Shown when Target Exam = JEE)
  {
    id: 'math_1',
    number: 11,
    subject: 'Math',
    type: 'MCQ',
    topic: 'Definite Integration',
    prompt:
      'Evaluate the definite integral I = ∫₀^(π/2) [ √(sin x) / (√(sin x) + √(cos x)) ] dx using the King symmetry property:',
    equationBlock: '∫₀^a f(x) dx = ∫₀^a f(a - x) dx',
    options: ['π / 4', 'π / 2', 'π / 8', '1'],
    correctAnswer: '0',
    solution:
      'By applying f(π/2 - x), the numerator becomes √(cos x). Adding the two integrals gives 2I = ∫₀^(π/2) 1 dx = π/2, hence I = π/4.',
  },
  {
    id: 'math_2',
    number: 12,
    subject: 'Math',
    type: 'MCQ',
    topic: 'Complex Numbers & Roots of Unity',
    prompt:
      'If ω (≠ 1) is a complex cube root of unity satisfying 1 + ω + ω² = 0 and ω³ = 1, then the value of (1 - ω + ω²)⁵ + (1 + ω - ω²)⁵ is:',
    equationBlock: '1 + ω² = -ω   and   1 + ω = -ω²',
    options: ['32', '-32', '64', '0'],
    correctAnswer: '0',
    solution:
      '(1 - ω + ω²)⁵ + (1 + ω - ω²)⁵ = (-2ω)⁵ + (-2ω²)⁵ = -32(ω⁵ + ω¹⁰) = -32(ω² + ω) = -32(-1) = 32.',
  },
  {
    id: 'math_3',
    number: 13,
    subject: 'Math',
    type: 'MCQ',
    topic: 'Matrices & Determinants',
    prompt:
      'Let A be a 3 × 3 non-singular matrix such that |A| = 5. Then the determinant of the matrix adj(adj(A)) is equal to:',
    equationBlock: '|adj(adj(A))| = |A|^((n - 1)²)',
    options: ['625', '125', '25', '3125'],
    correctAnswer: '0',
    solution:
      'For a matrix of order n = 3, |adj(adj(A))| = |A|^((3 - 1)²) = |A|⁴ = 5⁴ = 625.',
  },
  {
    id: 'math_4',
    number: 14,
    subject: 'Math',
    type: 'MCQ',
    topic: 'Vectors & 3D Geometry',
    prompt:
      'If vectors a, b, and c are mutually perpendicular unit vectors in R³, then the magnitude of the vector |2a + 3b + 6c| is:',
    equationBlock: '|x a + y b + z c| = √(x² + y² + z²)  for orthonormal basis',
    options: ['7', '11', '49', '5'],
    correctAnswer: '0',
    solution:
      'Since a, b, c are mutually orthogonal unit vectors, |2a + 3b + 6c| = √(2² + 3² + 6²) = √(4 + 9 + 36) = √49 = 7.',
  },
  {
    id: 'math_5',
    number: 15,
    subject: 'Math',
    type: 'NAT',
    topic: 'Limits & Continuity',
    prompt:
      'Evaluate the limit: lim_(x → 0) [ (e^(4x) - 1 - 4x) / x² ]. Enter the exact numerical value:',
    equationBlock: 'e^u = 1 + u + u²/2! + u³/3! + ...',
    correctAnswer: '8',
    solution:
      'Using Taylor expansion: e^(4x) = 1 + 4x + (4x)²/2! + O(x³). Thus (1 + 4x + 8x² - 1 - 4x)/x² = 8.',
  },

  // BIOLOGY (4 MCQ + 1 NAT — Shown when Target Exam = NEET)
  {
    id: 'bio_1',
    number: 11,
    subject: 'Biology',
    type: 'MCQ',
    topic: 'Molecular Basis of Inheritance',
    prompt:
      'In the E. coli lac operon, what is the specific functional role of allolactose when lactose is provided as the carbon source in the growth medium?',
    equationBlock: 'Allolactose + Repressor Protein → Inactive Repressor Complex',
    options: [
      'It binds to the repressor protein and prevents it from binding to the operator region',
      'It directly phosphorylates RNA polymerase at the promoter site',
      'It acts as a corepressor to shut down transcription of lacZ, lacY, and lacA',
      'It cleaves beta-galactosidase into permease subunits',
    ],
    correctAnswer: '0',
    solution:
      'Allolactose acts as an inducer: it binds to the active lac repressor protein, inducing a conformational change so the repressor cannot bind to the operator region, allowing RNA polymerase to transcribe the structural genes.',
  },
  {
    id: 'bio_2',
    number: 12,
    subject: 'Biology',
    type: 'MCQ',
    topic: 'Human Physiology: Breathing & Exchange of Gases',
    prompt:
      'Which combination of physiological conditions inside systemic capillaries favors the dissociation of oxygen from oxyhemoglobin (rightward Bohr shift)?',
    equationBlock: 'Hb(O₂)₄ + H⁺ ⇌ HHb⁺ + 4O₂',
    options: [
      'High pCO₂, high H⁺ concentration (low pH), and elevated temperature',
      'Low pCO₂, low H⁺ concentration (high pH), and low temperature',
      'High pO₂, low 2,3-BPG, and alkaline pH',
      'High pO₂ and decreased body temperature',
    ],
    correctAnswer: '0',
    solution:
      'Active tissues produce CO₂, H⁺, and heat. High pCO₂, high [H⁺] (lower pH), and elevated temperature decrease hemoglobin affinity for O₂ (higher P₅₀), shifting the curve right to unload O₂.',
  },
  {
    id: 'bio_3',
    number: 13,
    subject: 'Biology',
    type: 'MCQ',
    topic: 'Plant Physiology: Photosynthesis',
    prompt:
      'In C4 plants such as Maize and Sorghum, the primary CO₂ acceptor in mesophyll cells and the first stable 4-carbon product formed are respectively:',
    equationBlock: 'PEP (3C) + HCO₃⁻  —(PEPcase)→  Oxaloacetic Acid (4C)',
    options: [
      'Phosphoenolpyruvate (PEP) and Oxaloacetic acid (OAA)',
      'Ribulose-1,5-bisphosphate (RuBP) and 3-Phosphoglyceric acid (3-PGA)',
      'Phosphoenolpyruvate (PEP) and Malic acid',
      'RuBP and Oxaloacetic acid (OAA)',
    ],
    correctAnswer: '0',
    solution:
      'In C4 mesophyll cells, PEP (3-carbon molecule) is the primary CO₂ acceptor catalyzed by PEP carboxylase, yielding the 4-carbon Oxaloacetic acid (OAA).',
  },
  {
    id: 'bio_4',
    number: 14,
    subject: 'Biology',
    type: 'MCQ',
    topic: 'Biotechnology: Principles & Processes',
    prompt:
      'In the cloning vector pBR322, if a foreign DNA fragment is ligated at the BamHI restriction site located within the tetracycline resistance gene (tet^R), recombinant transformants will exhibit:',
    equationBlock: 'Insertional Inactivation of tet^R; amp^R remains intact',
    options: [
      'Resistance to ampicillin but sensitivity to tetracycline',
      'Resistance to both ampicillin and tetracycline',
      'Sensitivity to ampicillin but resistance to tetracycline',
      'Blue colonies on X-gal chromogenic medium',
    ],
    correctAnswer: '0',
    solution:
      'Ligating foreign DNA at the BamHI site causes insertional inactivation of the tet^R gene while leaving the amp^R gene functional.',
  },
  {
    id: 'bio_5',
    number: 15,
    subject: 'Biology',
    type: 'NAT',
    topic: 'Population Genetics: Hardy-Weinberg',
    prompt:
      'In a population of 1000 individuals in Hardy-Weinberg equilibrium, 160 individuals are affected by an autosomal recessive disorder (q² = 0.16). Calculate the percentage of heterozygous carrier individuals (2pq × 100) in this population:',
    equationBlock: 'q = √0.16 = 0.4  ⇒  p = 1 - q = 0.6  ⇒  Carrier % = 2·p·q × 100',
    correctAnswer: '48',
    solution:
      'Since q² = 160/1000 = 0.16, q = 0.4 and p = 0.6. Heterozygous frequency 2pq = 2 × 0.6 × 0.4 = 0.48, which is 48%.',
  },
];

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    uid: 'aspirant_ishaan_01',
    name: 'Ishaan Deshmukh',
    targetExam: 'JEE',
    taskCompletionRate: 96,
    bestMockScore: 56,
    currentStreak: 19,
    compositePoints: 2752,
  },
  {
    uid: 'aspirant_ananya_02',
    name: 'Ananya Krishnan',
    targetExam: 'NEET',
    taskCompletionRate: 94,
    bestMockScore: 55,
    currentStreak: 16,
    compositePoints: 2593,
  },
  {
    uid: 'aspirant_rohan_03',
    name: 'Rohan Kulkarni',
    targetExam: 'JEE',
    taskCompletionRate: 91,
    bestMockScore: 52,
    currentStreak: 14,
    compositePoints: 2432,
  },
  {
    uid: 'aspirant_meera_04',
    name: 'Meera Rajput',
    targetExam: 'NEET',
    taskCompletionRate: 89,
    bestMockScore: 51,
    currentStreak: 12,
    compositePoints: 2313,
  },
  {
    uid: 'aspirant_kabir_05',
    name: 'Kabir Malhotra',
    targetExam: 'JEE',
    taskCompletionRate: 86,
    bestMockScore: 48,
    currentStreak: 11,
    compositePoints: 2192,
  },
  {
    uid: 'aspirant_sanya_06',
    name: 'Sanya Chatterjee',
    targetExam: 'NEET',
    taskCompletionRate: 84,
    bestMockScore: 47,
    currentStreak: 9,
    compositePoints: 2073,
  },
  {
    uid: 'aspirant_dev_07',
    name: 'Devansh Joshi',
    targetExam: 'JEE',
    taskCompletionRate: 80,
    bestMockScore: 44,
    currentStreak: 8,
    compositePoints: 1940,
  },
  {
    uid: 'local_aspirant_01',
    name: 'Aarav Sharma',
    targetExam: 'JEE',
    taskCompletionRate: 75,
    bestMockScore: 42,
    currentStreak: 4,
    compositePoints: 1690,
  },
  {
    uid: 'aspirant_prachi_09',
    name: 'Prachi Tiwari',
    targetExam: 'NEET',
    taskCompletionRate: 72,
    bestMockScore: 40,
    currentStreak: 5,
    compositePoints: 1664,
  },
  {
    uid: 'aspirant_aditya_10',
    name: 'Aditya Menon',
    targetExam: 'JEE',
    taskCompletionRate: 68,
    bestMockScore: 38,
    currentStreak: 4,
    compositePoints: 1546,
  },
  {
    uid: 'aspirant_niharika_11',
    name: 'Niharika Sen',
    targetExam: 'NEET',
    taskCompletionRate: 64,
    bestMockScore: 35,
    currentStreak: 3,
    compositePoints: 1413,
  },
];

export const INITIAL_CLASSES: ClassEntity[] = [
  { id: 'cls_9', name: 'Class 9', order: 1 },
  { id: 'cls_10', name: 'Class 10', order: 2 },
  { id: 'cls_10_found', name: 'Class 10 Foundation', order: 3 },
  { id: 'cls_11_found', name: 'Class 11 Foundation', order: 4 },
  { id: 'cls_11', name: 'Class 11', order: 5 },
  { id: 'cls_12', name: 'Class 12', order: 6 },
  { id: 'cls_dropper', name: 'Dropper', order: 7 },
];

export const INITIAL_SUBJECTS: SubjectEntity[] = [
  { id: 'sub_phy_11', classId: 'cls_11', name: 'Physics' },
  { id: 'sub_chem_11', classId: 'cls_11', name: 'Chemistry' },
  { id: 'sub_math_11', classId: 'cls_11', name: 'Math' },
  { id: 'sub_bio_11', classId: 'cls_11', name: 'Biology' },
  { id: 'sub_phy_11_f', classId: 'cls_11_found', name: 'Physics' },
  { id: 'sub_chem_11_f', classId: 'cls_11_found', name: 'Chemistry' },
  { id: 'sub_math_11_f', classId: 'cls_11_found', name: 'Math' },
  { id: 'sub_bio_11_f', classId: 'cls_11_found', name: 'Biology' },
  { id: 'sub_phy_12', classId: 'cls_12', name: 'Physics' },
  { id: 'sub_chem_12', classId: 'cls_12', name: 'Chemistry' },
  { id: 'sub_math_12', classId: 'cls_12', name: 'Math' },
  { id: 'sub_bio_12', classId: 'cls_12', name: 'Biology' },
  { id: 'sub_phy_drop', classId: 'cls_dropper', name: 'Physics' },
  { id: 'sub_chem_drop', classId: 'cls_dropper', name: 'Chemistry' },
  { id: 'sub_math_drop', classId: 'cls_dropper', name: 'Math' },
  { id: 'sub_bio_drop', classId: 'cls_dropper', name: 'Biology' },
  { id: 'sub_phy_10', classId: 'cls_10', name: 'Physics' },
  { id: 'sub_math_10', classId: 'cls_10', name: 'Math' },
  { id: 'sub_phy_10_f', classId: 'cls_10_found', name: 'Physics' },
  { id: 'sub_chem_10_f', classId: 'cls_10_found', name: 'Chemistry' },
  { id: 'sub_math_10_f', classId: 'cls_10_found', name: 'Math' },
  { id: 'sub_bio_10_f', classId: 'cls_10_found', name: 'Biology' },
  { id: 'sub_phy_9', classId: 'cls_9', name: 'Physics' },
];

export const INITIAL_CHAPTERS: ChapterEntity[] = [
  { id: 'ch_rotational', classId: 'cls_11', subjectId: 'sub_phy_11', name: 'Rotational Mechanics & IAOR' },
  { id: 'ch_thermo_phy', classId: 'cls_11', subjectId: 'sub_phy_11', name: 'Laws of Thermodynamics & Carnot Engine' },
  { id: 'ch_electrostatics', classId: 'cls_12', subjectId: 'sub_phy_12', name: 'Electrostatics & Gauss Law' },
  { id: 'ch_current_elec', classId: 'cls_12', subjectId: 'sub_phy_12', name: 'Current Electricity & RC Circuits' },
  { id: 'ch_goc', classId: 'cls_11', subjectId: 'sub_chem_11', name: 'General Organic Chemistry & Isomerism' },
  { id: 'ch_electrochem', classId: 'cls_12', subjectId: 'sub_chem_12', name: 'Electrochemistry & Nernst Equation' },
  { id: 'ch_carbonyls', classId: 'cls_12', subjectId: 'sub_chem_12', name: 'Aldehydes, Ketones & Aldol Condensation' },
  { id: 'ch_conics', classId: 'cls_11', subjectId: 'sub_math_11', name: 'Conic Sections & Locus' },
  { id: 'ch_def_int', classId: 'cls_12', subjectId: 'sub_math_12', name: 'Definite Integration & Differential Equations' },
  { id: 'ch_human_phys', classId: 'cls_11', subjectId: 'sub_bio_11', name: 'Human Physiology & Cardiac Cycle' },
  { id: 'ch_mol_genetics', classId: 'cls_12', subjectId: 'sub_bio_12', name: 'Molecular Basis of Inheritance' },
  { id: 'ch_found_10_optics', classId: 'cls_10_found', subjectId: 'sub_phy_10_f', name: 'Ray Optics, NTSE Light & Lens Makers Bridge' },
  { id: 'ch_found_11_vectors', classId: 'cls_11_found', subjectId: 'sub_phy_11_f', name: 'Vectors, Calculus Bridge & Kinematics 2D' },
];

export const DEFAULT_VAULT_SECTIONS = [
  'PYQs',
  'Formula Sheets',
  'Hand-written Notes',
  'DPPs',
];

export const DEFAULT_VIDEO_SECTIONS = [
  'Master Roadmaps',
  'Physics One-Shots',
  'Chemistry & Biology Masterclass',
  'Mathematics Rank Booster',
  'Foundation Bridge Lectures',
];

export const INITIAL_MATERIALS: StudyMaterialItem[] = [
  {
    id: 'mat_rotational_pyq',
    title: 'JEE Main & Advanced 15-Year PYQ Compendium: Rotational Motion',
    section: 'PYQs',
    classId: 'cls_11',
    examTag: 'JEE',
    subjectId: 'sub_phy_11',
    pdfUrl: '/materials/rotational_motion_pyq_compendium.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1420,
    pagesCount: 3,
    summaryPages: [
      'PAGE 1 — INSTANTANEOUS AXIS OF ROTATION (IAOR) & ROLLING WITHOUT SLIPPING\n\n1. Pure Rolling Condition on Stationary Surface:\n   v_contact = v_cm - R·ω = 0  ==>  v_cm = R·ω\n   a_cm = R·α (for constant radius R)\n\n2. Kinetic Energy of Rolling Body:\n   K_total = (1/2)·M·v_cm² + (1/2)·I_cm·ω² = (1/2)·M·v_cm²·(1 + β), where β = I_cm / (M·R²)\n\n3. PYQ 2023 (JEE Adv): A thin ring and a solid disc of equal radius R are released from rest on a rough incline of angle θ = 30°.\n   • a_disc = (2/3) g sin θ\n   • a_ring = (1/2) g sin θ\n   • Ratio of velocities after distance s: v_disc / v_ring = √(4/3) = 2 / √3.',
      'PAGE 2 — ANGULAR MOMENTUM CONSERVATION & COLLISION WITH RODS\n\n1. Angular Momentum about Arbitrary Point O:\n   L_O = L_cm + (r_cm × M·v_cm) = I_cm·ω + (r_cm × P)\n\n2. Eccentric Impulse on a Free Rigid Rod (Mass M, Length L):\n   If linear impulse J hits at distance x from center of mass:\n   • v_cm = J / M\n   • ω = (J · x) / (M·L² / 12) = 12·J·x / (M·L²)\n   • Center of Percussion (Point of zero initial velocity): y = L² / (12·x).',
      'PAGE 3 — TOPPLE VS SLIP CRITERIA ON ROUGH HORIZONTAL & INCLINED PLANES\n\n1. Cubical Block of side a pushed at height h by force F:\n   • Sliding occurs first if μ_s < a / (2·h)\n   • Toppling about front edge occurs first if μ_s > a / (2·h)\n\n2. Practice Checklist:\n   [✓] Solve Q1–Q18 Single Correct\n   [✓] Solve Q19–Q25 Numerical Integer Type',
    ],
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'mat_electrostatics_pyq',
    title: 'JEE & NEET 2015–2026 Electrostatics, Gauss Law & Dielectrics PYQ Bank',
    section: 'PYQs',
    classId: 'cls_12',
    examTag: 'BOTH',
    subjectId: 'sub_phy_12',
    pdfUrl: '/materials/electrostatics_pyq_bank.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1980,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — GAUSS LAW & CAVITY PROBLEMS IN CONDUCTORS\n\n1. Electric Field Inside Spherical Cavity of Non-Conducting Sphere:\n   • Uniform field E_cavity = (ρ · a) / (3 · ε₀), where a is vector from sphere center to cavity center.\n\n2. Earthing & Charge Redistribution on Parallel Plates:\n   • Outer surfaces carry Q_total / 2 each; facing inner surfaces carry equal & opposite charges.',
      'PAGE 2 — DIELECTRIC INSERTION AT CONSTANT V vs CONSTANT Q\n\n1. Battery Connected (Constant V): C → K·C, Q → K·Q, E → E, U → K·U\n2. Battery Disconnected (Constant Q): C → K·C, V → V/K, E → E/K, U → U/K',
    ],
    createdAt: '2026-10-29T08:00:00Z',
  },
  {
    id: 'mat_goc_pyq',
    title: 'Organic Chemistry 12-Year PYQs: GOC, Aromaticity & Carbocation Rearrangement',
    section: 'PYQs',
    classId: 'cls_11',
    examTag: 'BOTH',
    subjectId: 'sub_chem_11',
    pdfUrl: '/materials/goc_aromaticity_pyq.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1640,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — HUCKEL AROMATICITY & SIRP / SIP STERIC INHIBITION\n\n1. Cyclopropenyl Cation (2π e⁻) & Tropylium Cation (6π e⁻) are planar aromatic.\n2. Ortho-Effect in Benzoic Acids: Any ortho substituent increases Ka due to steric inhibition of resonance.',
      'PAGE 2 — PINACOL-PINACOLONE & RING EXPANSION MIGRATORY APTITUDE\n\n1. Migratory Aptitude in Electron-Deficient Carbocation:\n   • H⁻ > Ph⁻ (p-OMe > p-Me > -H > p-Cl) > 3° Alkyl > 2° Alkyl > 1° Alkyl.',
    ],
    createdAt: '2026-10-30T11:00:00Z',
  },
  {
    id: 'mat_neet_human_phys_pyq',
    title: 'NEET UG 20-Year Solved PYQ Digest: Human Physiology & Cardiac Cycle',
    section: 'PYQs',
    classId: 'cls_dropper',
    examTag: 'NEET',
    subjectId: 'sub_bio_drop',
    pdfUrl: '/materials/neet_human_physiology_pyq.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 2310,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — CARDIAC CYCLE & ECG WAVEFORM CLINICAL CORRELATIONS\n\n1. P-wave: Atrial depolarization | QRS complex: Ventricular depolarization | T-wave: Ventricular repolarization.\n2. First Heart Sound (LUB): Closure of tricuspid & bicuspid valves at onset of ventricular systole.',
      'PAGE 2 — COUNTER-CURRENT MULTIPLIER & OXYGEN DISSOCIATION\n\n1. Osmolarity gradient in renal medulla: 300 mOsmol/L (cortex) to 1200 mOsmol/L (inner medulla) maintained by NaCl & Urea.',
    ],
    createdAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'mat_foundation_10_pyq',
    title: 'Class 10 NTSE & Foundation Olympiad PYQ Sprint: Light, Electricity & Polynomials',
    section: 'PYQs',
    classId: 'cls_10',
    examTag: 'JEE',
    subjectId: 'sub_phy_10',
    pdfUrl: '/materials/foundation_class10_pyq.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 890,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — MIRROR & LENS MAGNIFICATION SIGN CONVENTIONS\n\n1. 1/v + 1/u = 1/f (Mirror) | 1/v - 1/u = 1/f (Lens) | Power P = 100 / f(cm) Dioptres.',
      'PAGE 2 — EQUIVALENT RESISTANCE SYMMETRY & WHEATSTONE BRIDGE\n\n1. Balanced bridge condition: R₁/R₂ = R₃/R₄ ⇒ zero current through central galvanometer arm.',
    ],
    createdAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'mat_foundation_9_pyq',
    title: 'Class 9 Foundation Mechanics PYQs: Equations of Motion, Gravitation & Work-Energy',
    section: 'PYQs',
    classId: 'cls_9',
    examTag: 'JEE',
    subjectId: 'sub_phy_9',
    pdfUrl: '/materials/foundation_class9_mechanics.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 740,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — DISPLACEMENT IN Nth SECOND & GRAPHICAL KINEMATICS\n\n1. s_n = u + (a / 2)·(2n - 1)\n2. Area under v-t graph gives displacement; slope of v-t graph gives instantaneous acceleration.',
      'PAGE 2 — KEPLER LAWS & VARIATION OF g WITH ALTITUDE/DEPTH\n\n1. g_h = g·(1 - 2h/R) for h << R | g_d = g·(1 - d/R) at depth d.',
    ],
    createdAt: '2026-11-01T09:00:00Z',
  },
  {
    id: 'mat_electro_formula',
    title: 'Class 12 Electrodynamics & RC/LR Transient Rapid Formula Sheet',
    section: 'Formula Sheets',
    classId: 'cls_12',
    examTag: 'BOTH',
    subjectId: 'sub_phy_12',
    pdfUrl: '/materials/electrodynamics_formula_sheet.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 2180,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — GAUSS LAW, ELECTRIC POTENTIAL & CAPACITOR NETWORKS\n\n1. Electric Field of Uniformly Charged Solid Sphere (Radius R, Charge Q):\n   • Inside (r < R):  E(r) = (k · Q · r) / R³\n   • Outside (r ≥ R): E(r) = (k · Q) / r²\n\n2. Common Potential & Heat Loss on Connecting Two Capacitors:\n   • V_common = (C₁V₁ + C₂V₂) / (C₁ + C₂)\n   • ΔH = (1/2) · [C₁C₂ / (C₁ + C₂)] · (V₁ - V₂)²',
      'PAGE 2 — TRANSIENT RC / LR CIRCUITS & MAGNETIC FORCE\n\n1. Charging of Capacitor through Resistor R:\n   • q(t) = C·ε·(1 - e^(-t / τ_c)), where τ_c = R_eq · C\n   • Current i(t) = (ε / R) · e^(-t / τ_c)\n\n2. Biot-Savart Law for Finite Straight Wire:\n   • B = (μ₀ · I) / (4·π·d) · (sin θ₁ + sin θ₂)',
    ],
    createdAt: '2026-10-29T14:30:00Z',
  },
  {
    id: 'mat_thermo_formula',
    title: 'Thermodynamics, Carnot Cycle & Kinetic Theory Pocket Formula Handbook',
    section: 'Formula Sheets',
    classId: 'cls_11',
    examTag: 'BOTH',
    subjectId: 'sub_phy_11',
    pdfUrl: '/materials/thermodynamics_formula_handbook.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1750,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — POLYTROPIC PROCESSES & MOLAR HEAT CAPACITY\n\n1. For PV^x = const: Work W = (nRΔT)/(1 - x), Molar Heat Capacity C = C_v + R/(1 - x).',
      'PAGE 2 — MAXWELL SPEEDS & EQUIPARTITION OF ENERGY\n\n1. v_mp : v_avg : v_rms = √2 : √(8/π) : √3 = 1 : 1.128 : 1.224.',
    ],
    createdAt: '2026-10-30T10:30:00Z',
  },
  {
    id: 'mat_organic_notes',
    title: 'AIR-14 Handwritten Notes: Named Reactions, Aldol & Stereochemistry',
    section: 'Hand-written Notes',
    classId: 'cls_12',
    examTag: 'BOTH',
    subjectId: 'sub_chem_12',
    pdfUrl: '/materials/organic_named_reactions_handwritten.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1895,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — ALDOL CONDENSATION vs CANNIZZARO MECHANISM\n\n1. Aldol Condensation (Requires α-Hydrogen):\n   • Reagent: Dilute NaOH / Ba(OH)₂ + Δ\n   • Rate-Determining Step: Enolate attack on carbonyl carbon\n   • Crossed Aldol Intramolecular ring closure priority: 5-membered & 6-membered rings >> 7-membered.\n\n2. Cannizzaro Reaction (No α-Hydrogen: HCHO, PhCHO, Me₃C-CHO):\n   • Reagent: Conc. 50% NaOH / KOH\n   • Hydride transfer (H⁻) is the slow RDS.\n   • In Crossed Cannizzaro with HCHO, Formaldehyde is ALWAYS oxidized to Formate (HCOO⁻).',
      'PAGE 2 — REIMER-TIEMANN, KOLBE-SCHMITT & HOFFMANN BROMAMIDE\n\n1. Reimer-Tiemann Reaction:\n   • Phenol + CHCl₃ + aq. NaOH → Salicylaldehyde (Ortho major due to intramolecular H-bonding)\n   • Electrophile: Dichlorocarbene (:CCl₂, neutral 6-electron singlet species).\n\n2. Hoffmann Bromamide Degradation:\n   • R-CONH₂ + Br₂ + 4 KOH → R-NH₂ (1 carbon less) + K₂CO₃ + 2 KBr + 2 H₂O\n   • Retention of stereochemical configuration at migrating chiral group R.',
    ],
    createdAt: '2026-10-30T09:15:00Z',
  },
  {
    id: 'mat_neet_genetics_notes',
    title: 'NEET UG NCERT Line-by-Line Booster: Molecular Genetics & Operon',
    section: 'Hand-written Notes',
    classId: 'cls_12',
    examTag: 'NEET',
    subjectId: 'sub_bio_12',
    pdfUrl: '/materials/neet_molecular_genetics_booster.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1650,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — DNA PACKAGING, REPLICATION & MESELSON-STAHL EXPERIMENT\n\n1. Nucleosome Core Particle:\n   • Histone Octamer (2 × H2A, H2B, H3, H4) rich in basic amino acids Lysine & Arginine (+ve charge).\n   • Wraps ~200 bp of negatively charged DNA helix (1.75 turns).\n\n2. Meselson & Stahl (1958):\n   • E. coli grown in ¹⁵NH₄Cl then shifted to ¹⁴NH₄Cl (generation time = 20 mins).\n   • After 40 mins (Gen II): 50% Hybrid (¹⁵N-¹⁴N) + 50% Light (¹⁴N-¹⁴N).',
      'PAGE 2 — LAC OPERON (JACOB & MONOD) & GENETIC CODE SALIENT FEATURES\n\n1. Structural Genes in Lac Operon:\n   • lacZ → β-galactosidase (hydrolyzes lactose into glucose + galactose)\n   • lacY → Permease (increases cell permeability to β-galactosides)\n   • lacA → Transacetylase\n\n2. Start & Stop Codons:\n   • AUG: Dual function (codes for Methionine + acts as Initiator codon)\n   • Stop (Nonsense) Codons: UAA (Ochre), UAG (Amber), UGA (Opal).',
    ],
    createdAt: '2026-11-02T16:40:00Z',
  },
  {
    id: 'mat_calculus_dpp',
    title: 'Daily Practice Problem (DPP #14): Definite Integrals & Area Under Curves',
    section: 'DPPs',
    classId: 'cls_12',
    examTag: 'JEE',
    subjectId: 'sub_math_12',
    pdfUrl: '/materials/calculus_dpp_14.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1340,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — DEFINITE INTEGRATION HIGH-SPEED PROPERTIES (DPP #14)\n\n1. King Property:\n   ∫[a to b] f(x) dx = ∫[a to b] f(a + b - x) dx\n\n2. Queen Property:\n   ∫[0 to 2a] f(x) dx = 2 · ∫[0 to a] f(x) dx   if f(2a - x) = f(x)\n                      = 0                        if f(2a - x) = -f(x)\n\n3. Leibniz Rule for Differentiating Under Integral Sign:\n   d/dx [ ∫[φ(x) to ψ(x)] f(t) dt ] = f(ψ(x))·ψ\'(x) - f(φ(x))·φ\'(x)',
      'PAGE 2 — WALLI\'S FORMULA & LIMIT OF A SUM\n\n1. Limit as a Definite Integral:\n   lim (n→∞) (1/n) Σ f(r/n) = ∫[0 to 1] f(x) dx\n\n2. Standard Bounded Area Shortcut:\n   • Area between y² = 4ax and x² = 4by is (16·a·b) / 3\n   • Area between y² = 4ax and y = mx is (8·a²) / (3·m³)',
    ],
    createdAt: '2026-11-01T11:20:00Z',
  },
  {
    id: 'mat_conics_dpp',
    title: 'Daily Practice Problem (DPP #09): Conic Sections, Focal Chords & Director Circle',
    section: 'DPPs',
    classId: 'cls_11',
    examTag: 'JEE',
    subjectId: 'sub_math_11',
    pdfUrl: '/materials/conics_dpp_09.pdf',
    thumbnailUrl: LECTURE_COVER_PATH,
    downloads: 1190,
    pagesCount: 2,
    summaryPages: [
      'PAGE 1 — PARABOLA FOCAL CHORD & TANGENT PROPERTIES\n\n1. Harmonic Mean of semi-focal chord segments: 1/SP + 1/SQ = 1/a.\n2. Foot of perpendicular from focus onto any tangent lies on the tangent at the vertex.',
      'PAGE 2 — AUXILIARY & DIRECTOR CIRCLES OF ELLIPSE/HYPERBOLA\n\n1. Auxiliary Circle: x² + y² = a² | Director Circle: x² + y² = a² ± b².',
    ],
    createdAt: '2026-11-02T10:10:00Z',
  },
];

export const INITIAL_MENTORS: MentorProfileItem[] = [
  {
    id: 'mentor_sumit_master',
    email: 'Sumit586kumar@gmail.com',
    name: 'Sumit Kumar',
    roleTitle: 'Founder & Lead Physics / Strategy Mentor (IIT Roorkee)',
    role: 'Master Admin',
    qualification: 'IIT Roorkee · AIR Mentor',
    subjectSpecialty: 'Physics',
    avatarUrl: MENTOR_AVATAR_PATH,
    jitsiRoomSlug: 'prepskm_mentor_sumit_live',
    jitsiRoomPrefix: 'prepskm_mentor_sumit_live',
    isOnline: true,
    isMasterAdmin: true,
    createdAt: '2026-10-01T09:00:00Z',
  },
  {
    id: 'mentor_ananya',
    email: 'ananya.verma@prepskm.in',
    name: 'Dr. Ananya Verma',
    roleTitle: 'Senior NEET Biology & Organic Chemistry Mentor (AIIMS Delhi)',
    role: 'Co-Admin & Mentor',
    qualification: 'AIIMS Delhi · NEET Specialist',
    subjectSpecialty: 'Biology',
    avatarUrl: MENTOR_AVATAR_PATH,
    jitsiRoomSlug: 'prepskm_mentor_ananya_live',
    jitsiRoomPrefix: 'prepskm_mentor_ananya_live',
    isOnline: true,
    isMasterAdmin: false,
    createdAt: '2026-10-12T10:00:00Z',
  },
  {
    id: 'mentor_rohan',
    email: 'rohan.iitd@prepskm.in',
    name: 'Rohan Kulkarni',
    roleTitle: 'JEE Advanced Mathematics & Calculus Specialist (IIT Delhi)',
    role: 'Video Mentor',
    qualification: 'IIT Delhi · Calculus Specialist',
    subjectSpecialty: 'Math',
    avatarUrl: MENTOR_AVATAR_PATH,
    jitsiRoomSlug: 'prepskm_mentor_rohan_live',
    jitsiRoomPrefix: 'prepskm_mentor_rohan_live',
    isOnline: true,
    isMasterAdmin: false,
    createdAt: '2026-10-18T14:00:00Z',
  },
];

export const INITIAL_VIDEOS: VideoRoadmapItem[] = [
  {
    id: 'vid_roadmap_2027',
    title: '90-Day High-Yield Block Strategy: Score 220+ in JEE Main & 680+ in NEET',
    description:
      'Complete chapter prioritization matrix, 80/20 weightage breakdown, and daily 3-slot revision architecture curated by Mentor Sumit (IIT Roorkee).',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: LECTURE_COVER_PATH,
    duration: '34:20',
    topicTag: 'Master Roadmap · JEE & NEET',
    section: 'Master Roadmaps',
    classCohort: 'Class 12',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorEmail: 'Sumit586kumar@gmail.com',
    mentorRole: 'IIT Roorkee · Physics & Strategy',
    mentorAvatar: MENTOR_AVATAR_PATH,
    isNewRoadmap: true,
    createdAt: '2026-11-03T18:00:00Z',
  },
  {
    id: 'vid_rotational_masterclass',
    title: 'Rotational Mechanics One-Shot: IAOR, Pure Rolling & Toppling Masterclass',
    description:
      'Visualizing Instantaneous Axis of Rotation, frictional direction reversals in accelerated rolling, and eccentric collisions on a rigid rod.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: LECTURE_COVER_PATH,
    duration: '48:15',
    topicTag: 'Physics · Class 11 & Dropper',
    section: 'Physics One-Shots',
    classCohort: 'Class 11',
    mentorId: 'mentor_sumit_master',
    mentorName: 'Sumit Kumar',
    mentorEmail: 'Sumit586kumar@gmail.com',
    mentorRole: 'IIT Roorkee · Physics & Strategy',
    mentorAvatar: MENTOR_AVATAR_PATH,
    isNewRoadmap: false,
    createdAt: '2026-10-29T12:00:00Z',
  },
  {
    id: 'vid_electrochem_nernst',
    title: 'Electrochemistry & Molecular Genetics High-Yield Revision Sprint',
    description:
      'Master Nernst Equation, Kohlrausch Law, and NCERT Lac Operon regulation with Dr. Ananya Verma (AIIMS Delhi).',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: LECTURE_COVER_PATH,
    duration: '41:50',
    topicTag: 'Chemistry & Biology · Class 12',
    section: 'Chemistry & Biology Masterclass',
    classCohort: 'Class 12',
    mentorId: 'mentor_ananya',
    mentorName: 'Dr. Ananya Verma',
    mentorEmail: 'ananya.verma@prepskm.in',
    mentorRole: 'AIIMS Delhi · NEET & Chemistry Mentor',
    mentorAvatar: MENTOR_AVATAR_PATH,
    isNewRoadmap: false,
    createdAt: '2026-10-25T15:00:00Z',
  },
  {
    id: 'vid_calculus_king_rule',
    title: 'Definite Integration & Conic Sections Rank Booster: 15 Killer Archetypes',
    description:
      'Solve JEE Advanced Definite Integrals using King/Queen symmetries, Leibniz differentiation, and Focal Chord geometry.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: LECTURE_COVER_PATH,
    duration: '52:10',
    topicTag: 'Mathematics · JEE Advanced',
    section: 'Mathematics Rank Booster',
    classCohort: 'Dropper',
    mentorId: 'mentor_rohan',
    mentorName: 'Rohan Kulkarni',
    mentorEmail: 'rohan.iitd@prepskm.in',
    mentorRole: 'IIT Delhi · Mathematics Mentor',
    mentorAvatar: MENTOR_AVATAR_PATH,
    isNewRoadmap: false,
    createdAt: '2026-10-27T17:00:00Z',
  },
];

export const INITIAL_VIDEO_DOUBTS: VideoDoubtItem[] = [
  {
    id: 'doubt_01',
    videoId: 'vid_roadmap_2027',
    videoTitle: '90-Day High-Yield Block Strategy: Score 220+ in JEE Main & 680+ in NEET',
    studentId: 'local_aspirant_01',
    studentName: 'Aarav Sharma',
    timestampSeconds: 420,
    timestampSec: 420,
    timestampFormatted: '07:00',
    questionText:
      'Sir, at 07:00 in the Block 1 weightage table, should Class 12 students revise Rotational Motion before Electrostatics or in parallel?',
    doubtText:
      'Sir, at 07:00 in the Block 1 weightage table, should Class 12 students revise Rotational Motion before Electrostatics or in parallel?',
    mentorId: 'mentor_sumit_master',
    mentorReply:
      'Revise Electrostatics in your evening primary slot and dedicate 45 mins in the morning Backlog Killer slot to Rotational IAOR & Rolling PYQs.',
    mentorName: 'Sumit Kumar',
    createdAt: '2026-11-04T09:10:00Z',
  },
];

export const INITIAL_BROADCASTS: BroadcastMessageItem[] = [
  {
    id: 'bcast_01',
    title: 'All-India JEE & NEET Part-Syllabus CBT Mock Window Open!',
    message:
      'Attempt the new Auto-Balanced Mock Test or launch Infinite Practice with equal questions per selected chapter.',
    badge: 'LIVE BROADCAST',
    badgeType: 'ANNOUNCEMENT',
    targetCohort: 'ALL',
    actionLink: '/test.html',
    ctaLabel: 'Open CBT Engine',
    ctaHref: '/test.html',
    senderName: 'Sumit Kumar (Master Admin)',
    senderEmail: 'Sumit586kumar@gmail.com',
    createdAt: '2026-11-04T08:30:00Z',
  },
];

export const DEFAULT_SITE_THEME: SiteThemeSettings = {
  brandName: 'prepskm.in',
  brandTagline: 'JEE · NEET · Class 9–12 & Dropper',
  logoDataUrl: DEFAULT_BRAND_LOGO_SVG,
  primaryColor: '#4F46E5',
  secondaryColor: '#10B981',
  accentColor: '#F59E0B',
  surfaceTint: '#F8FAFC',
  surfaceBg: '#F8FAFC',
  presetName: 'Indigo Emerald Mix',
  updatedAt: '2026-11-04T08:00:00Z',
};

export const INITIAL_MENTORSHIP_SESSIONS: MentorshipSessionItem[] = [
  {
    id: 'ment_session_01',
    studentId: 'local_aspirant_01',
    studentName: 'Aarav Sharma',
    studentClass: 'Class 12 · JEE',
    mentorId: 'mentor_sumit',
    mentorName: 'Sumit Kumar',
    jitsiRoom: 'prepskm_mentor_sumit_live',
    requestType: 'CHAT',
    status: 'ACTIVE',
    messages: [
      {
        id: 'm1',
        senderName: 'Aarav Sharma',
        senderRole: 'student',
        text: 'Bhaiya, how should I balance Class 11 Rotational Mechanics backlog with ongoing Class 12 Electrostatics?',
        timestamp: '10:15 AM',
      },
      {
        id: 'm2',
        senderName: 'Sumit Kumar',
        senderRole: 'admin',
        text: 'Give 90 mins every morning solely to Rotational PYQs using the Backlog Killer quota, and keep evening slots 100% locked for Class 12 Electrostatics.',
        timestamp: '10:18 AM',
      },
    ],
    updatedAt: '2026-11-04T10:18:00Z',
  },
  {
    id: 'ment_session_02',
    studentId: 'local_aspirant_01',
    studentName: 'Aarav Sharma',
    studentClass: 'Class 12 · NEET/Chem',
    mentorId: 'mentor_ananya',
    mentorName: 'Dr. Ananya Verma',
    jitsiRoom: 'prepskm_mentor_ananya_live',
    requestType: 'VIDEO',
    status: 'ACTIVE',
    messages: [
      {
        id: 'm3',
        senderName: 'Aarav Sharma',
        senderRole: 'student',
        text: 'Ma’am, can we do a quick Jitsi video doubt session on Nernst Equation concentration cells?',
        timestamp: '11:05 AM',
      },
      {
        id: 'm4',
        senderName: 'Dr. Ananya Verma',
        senderRole: 'admin',
        text: 'Sure Aarav! Click "Join Live Jitsi Video Call" above whenever you are ready.',
        timestamp: '11:08 AM',
      },
    ],
    updatedAt: '2026-11-04T11:08:00Z',
  },
];

export const INITIAL_ADMIN_QUESTIONS: AdminQuestionItem[] = [];

const CHAPTER_ID_BY_QUESTION_ID: Record<string, string> = {
  phy_1: 'ch_rotational',
  phy_2: 'ch_electrostatics',
  phy_3: 'ch_current_elec',
  phy_4: 'ch_thermo_phy',
  phy_5: 'ch_rotational',
  chem_1: 'ch_goc',
  chem_2: 'ch_electrochem',
  chem_3: 'ch_carbonyls',
  chem_4: 'ch_goc',
  chem_5: 'ch_electrochem',
  math_1: 'ch_def_int',
  math_2: 'ch_conics',
  math_3: 'ch_conics',
  math_4: 'ch_def_int',
  math_5: 'ch_def_int',
  bio_1: 'ch_mol_genetics',
  bio_2: 'ch_human_phys',
  bio_3: 'ch_human_phys',
  bio_4: 'ch_mol_genetics',
  bio_5: 'ch_mol_genetics',
};

export const CBT_QUESTION_BANK: CBTQuestion[] = CBT_QUESTIONS.map((q) => ({
  ...q,
  chapterId: q.chapterId ?? CHAPTER_ID_BY_QUESTION_ID[q.id] ?? 'ch_rotational',
}));

export interface ClassCohortTheme {
  key: string;
  label: string;
  badgeText: string;
  headline: string;
  subheadline: string;
  gradientClass: string;
  accentBorderClass: string;
  pillBgClass: string;
  focusPills: string[];
  surfaceTint?: string;
  accentHex?: string;
}

export const CLASS_COHORT_THEMES: Record<string, ClassCohortTheme> = {
  'JEE|Class 12': {
    key: 'JEE|Class 12',
    label: 'JEE 2027 · Class 12',
    badgeText: 'IIT-JEE CLASS 12 BOARD + ADVANCED TRACK',
    headline: 'Class 12 JEE Advanced & Mains Mastery Hub',
    subheadline:
      'High-weightage Electrostatics, Calculus, Electrochemistry & 11th Revision Sprints tailored for Class 12 Board + JEE rankers.',
    gradientClass: 'from-indigo-600 via-violet-600 to-blue-600',
    accentBorderClass: 'border-indigo-200',
    pillBgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    focusPills: ['Electrostatics & Current', 'Definite Calculus', 'Aldol & Carbonyls', 'Board + JEE PYQs'],
  },
  'JEE|Class 11': {
    key: 'JEE|Class 11',
    label: 'JEE 2028 · Class 11',
    badgeText: 'IIT-JEE CLASS 11 CORE FOUNDATION TRACK',
    headline: 'Class 11 Mechanics, Conics & GOC Launchpad',
    subheadline:
      'Build rock-solid intuition in Rotational Dynamics, Thermodynamics, Coordinate Geometry & General Organic Chemistry from Day 1.',
    gradientClass: 'from-blue-600 via-indigo-600 to-cyan-600',
    accentBorderClass: 'border-blue-200',
    pillBgClass: 'bg-blue-50 text-blue-700 border-blue-200',
    focusPills: ['Rotational Mechanics', 'Conic Sections', 'GOC & Isomerism', 'Thermodynamics'],
  },
  'JEE|Dropper': {
    key: 'JEE|Dropper',
    label: 'JEE 2027 · Dropper / Repeater',
    badgeText: 'INTENSIVE DROPPER 99.9%ILE WARRIOR BATCH',
    headline: 'Dropper Intensive Rank Booster & Full-Syllabus Sprint',
    subheadline:
      'Zero-fluff high-yield PYQ drills, rapid Class 11+12 backlog elimination, and daily timed NTA CBT simulations.',
    gradientClass: 'from-violet-700 via-purple-600 to-fuchsia-600',
    accentBorderClass: 'border-violet-200',
    pillBgClass: 'bg-violet-50 text-violet-700 border-violet-200',
    focusPills: ['11th + 12th Combined', 'Daily NTA Full Mock', 'High-Weightage 40 Chapters', 'Speed & Accuracy'],
  },
  'NEET|Class 12': {
    key: 'NEET|Class 12',
    label: 'NEET 2027 · Class 12',
    badgeText: 'NEET-UG CLASS 12 MEDICAL + NCERT MASTERY',
    headline: 'Class 12 NEET Medical & NCERT Line-by-Line Hub',
    subheadline:
      'Master Molecular Genetics, Biotech, Modern Physics, and Organic Name Reactions with 100% NCERT statement accuracy.',
    gradientClass: 'from-emerald-600 via-teal-600 to-cyan-600',
    accentBorderClass: 'border-emerald-200',
    pillBgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    focusPills: ['Molecular Genetics', 'Reproduction & Ecology', 'Electrochemistry', 'Modern Physics'],
  },
  'NEET|Class 11': {
    key: 'NEET|Class 11',
    label: 'NEET 2028 · Class 11',
    badgeText: 'NEET-UG CLASS 11 MEDICAL FOUNDATION',
    headline: 'Class 11 Human & Plant Physiology + Mechanics Hub',
    subheadline:
      'Deep NCERT diagrams, Human Physiology cycles, Cell Biology, Chemical Bonding, and NLM problem-solving for Class 11.',
    gradientClass: 'from-teal-600 via-emerald-600 to-green-600',
    accentBorderClass: 'border-teal-200',
    pillBgClass: 'bg-teal-50 text-teal-700 border-teal-200',
    focusPills: ['Human Physiology', 'Plant Kingdom & Cell', 'Chemical Bonding', 'Kinematics & NLM'],
  },
  'NEET|Dropper': {
    key: 'NEET|Dropper',
    label: 'NEET 2027 · Dropper / Repeater',
    badgeText: 'NEET 700+ AIIMS INTENSIVE REPEATER TRACK',
    headline: 'NEET Dropper 700+ Score Accelerator & NCERT Drill',
    subheadline:
      'Complete 38-chapter Biology rapid revision, Assertion-Reason traps, and Physics/Chemistry numerical speed builders.',
    gradientClass: 'from-rose-600 via-pink-600 to-orange-500',
    accentBorderClass: 'border-rose-200',
    pillBgClass: 'bg-rose-50 text-rose-700 border-rose-200',
    focusPills: ['NCERT 38-Chapter Bio', 'Assertion-Reason Drills', '180-Q Speed Sprint', 'Error Log Revision'],
  },
  'JEE|Class 10': {
    key: 'JEE|Class 10',
    label: 'Class 10 · NTSE / Olympiad + JEE/NEET Early Start',
    badgeText: 'CLASS 10 BOARD + OLYMPIAD FOUNDATION',
    headline: 'Class 10 Board Excellence & Early JEE/NEET Bridge',
    subheadline:
      'Ace Class 10 Science & Mathematics while building early Olympiad concepts in Light, Electricity, Quadratic Equations, and Carbon.',
    gradientClass: 'from-amber-500 via-orange-500 to-rose-500',
    accentBorderClass: 'border-amber-200',
    pillBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    focusPills: ['Ray Optics & Electricity', 'Carbon & Compounds', 'Trigonometry & Quadratics', 'Life Processes'],
  },
  'JEE|Class 10 Foundation': {
    key: 'JEE|Class 10 Foundation',
    label: 'Class 10 Foundation · IJSO / NTSE / JEE-NEET Bridge',
    badgeText: 'CLASS 10 FOUNDATION OLYMPIAD ACCELERATOR',
    headline: 'Class 10 Foundation Bridge to Top 100 AIR',
    subheadline:
      'Dedicated Foundation curriculum bridging Class 10 Board Science/Math with JEE/NEET Vectors, Mole Concept, Quadratic Locus, and Cell Energetics.',
    gradientClass: 'from-orange-600 via-amber-600 to-yellow-500',
    accentBorderClass: 'border-orange-300',
    pillBgClass: 'bg-orange-50 text-orange-800 border-orange-200',
    focusPills: ['NTSE & IJSO Sprint', 'Early Mole & Atomic', 'Optics + Circuit Bridge', 'Olympiad Number Theory'],
  },
  'JEE|Class 11 Foundation': {
    key: 'JEE|Class 11 Foundation',
    label: 'Class 11 Foundation · Concept-First JEE & NEET Bridge',
    badgeText: 'CLASS 11 FOUNDATION ZERO-TO-ADVANCED TRACK',
    headline: 'Class 11 Foundation: Mathematical Tools, NLM & Atomic Structure',
    subheadline:
      'Step-by-step concept builder for students transitioning from Class 10 to 11 — master Basic Calculus, Vectors, Mole Stoichiometry, and NCERT Foundations without overwhelm.',
    gradientClass: 'from-cyan-600 via-sky-600 to-indigo-600',
    accentBorderClass: 'border-cyan-200',
    pillBgClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    focusPills: ['Calculus & Vector Tools', 'Units, Kinematics & NLM', 'Mole & Atomic Foundation', 'Daily Concept Drills'],
  },
  'NEET|Class 10 Foundation': {
    key: 'NEET|Class 10 Foundation',
    label: 'Class 10 Foundation · Medical & Biology Olympiad Track',
    badgeText: 'CLASS 10 MEDICAL + NSEB FOUNDATION',
    headline: 'Class 10 Medical Foundation & NCERT Science Booster',
    subheadline:
      'Early NEET UG & Biology Olympiad preparation covering Life Processes, Heredity, Chemical Reactions, and Ray Optics.',
    gradientClass: 'from-emerald-500 via-green-600 to-teal-600',
    accentBorderClass: 'border-emerald-200',
    pillBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    focusPills: ['Life Processes & Control', 'Heredity & Evolution', 'Acids, Bases & Carbon', 'Light & Current'],
  },
  'NEET|Class 11 Foundation': {
    key: 'NEET|Class 11 Foundation',
    label: 'Class 11 Foundation · NEET UG Concept Bridge',
    badgeText: 'CLASS 11 NEET FOUNDATION + NCERT BRIDGE',
    headline: 'Class 11 Medical Foundation: Cell, Biomolecules & Basic Physics',
    subheadline:
      'Build effortless speed in Basic Mathematics for Physics, Stoichiometry, Cell Biology, and Biomolecules from the ground up.',
    gradientClass: 'from-teal-500 via-cyan-600 to-emerald-600',
    accentBorderClass: 'border-teal-200',
    pillBgClass: 'bg-teal-50 text-teal-800 border-teal-200',
    focusPills: ['Basic Math for NEET Physics', 'Cell & Biomolecules', 'Mole & Redox Basics', 'NCERT Diagram Drills'],
  },
  'JEE|Class 9': {
    key: 'JEE|Class 9',
    label: 'Class 9 · Junior Science & Math Olympiad Track',
    badgeText: 'CLASS 9 JUNIOR OLYMPIAD & CONCEPT BUILDER',
    headline: 'Class 9 Concept Builder & Junior Olympiad Workspace',
    subheadline:
      'Visual interactive modules for Laws of Motion, Work & Energy, Atoms & Molecules, Number Systems, and Fundamental Unit of Life.',
    gradientClass: 'from-sky-500 via-blue-600 to-indigo-600',
    accentBorderClass: 'border-sky-200',
    pillBgClass: 'bg-sky-50 text-sky-800 border-sky-200',
    focusPills: ['Motion & Force', 'Atoms & Mole Concept', 'Polynomials & Geometry', 'Cell Biology'],
  },
};

export function getCohortTheme(targetExam: string, classYear: string): ClassCohortTheme {
  const exactKey = `${targetExam}|${classYear}`;
  if (CLASS_COHORT_THEMES[exactKey]) return CLASS_COHORT_THEMES[exactKey];
  if (classYear === 'Class 10 Foundation') return CLASS_COHORT_THEMES['JEE|Class 10 Foundation'];
  if (classYear === 'Class 11 Foundation') return CLASS_COHORT_THEMES['JEE|Class 11 Foundation'];
  if (classYear === 'Class 10') return CLASS_COHORT_THEMES['JEE|Class 10'];
  if (classYear === 'Class 9') return CLASS_COHORT_THEMES['JEE|Class 9'];
  return CLASS_COHORT_THEMES['JEE|Class 12'];
}

export const INITIAL_TEST_SUBMISSIONS: TestSubmission[] = [
  {
    testId: 'sub_mock_nta_01',
    uid: 'local_aspirant_01',
    title: 'All-India NTA Full Pattern Mock Test #1 (Class 12 · JEE)',
    classYear: 'Class 12',
    examType: 'JEE',
    mode: 'MOCK',
    totalQuestions: 6,
    score: 19,
    maxScore: 24,
    accuracyPercent: 83,
    correctCount: 5,
    wrongCount: 1,
    timeTaken: 1420,
    subjectBreakdown: {
      Physics: {
        subject: 'Physics',
        score: 8,
        maxScore: 8,
        correct: 2,
        wrong: 0,
        unattempted: 0,
        accuracyPercent: 100,
      },
      Chemistry: {
        subject: 'Chemistry',
        score: 3,
        maxScore: 8,
        correct: 1,
        wrong: 1,
        unattempted: 0,
        accuracyPercent: 50,
      },
      Math: {
        subject: 'Math',
        score: 8,
        maxScore: 8,
        correct: 2,
        wrong: 0,
        unattempted: 0,
        accuracyPercent: 100,
      },
    },
    chapterBreakdown: [
      {
        chapter: 'Rotational Dynamics',
        subject: 'Physics',
        correct: 2,
        total: 2,
        accuracyPercent: 100,
        status: 'Strong',
      },
      {
        chapter: 'Electrochemistry',
        subject: 'Chemistry',
        correct: 1,
        total: 2,
        accuracyPercent: 50,
        status: 'Moderate',
      },
      {
        chapter: 'Definite Integration',
        subject: 'Math',
        correct: 2,
        total: 2,
        accuracyPercent: 100,
        status: 'Strong',
      },
    ],
    questionRows: [
      {
        id: 'phy_1',
        number: 1,
        subject: 'Physics',
        topic: 'Rotational Dynamics',
        type: 'MCQ',
        prompt:
          'A solid uniform cylinder of mass M and radius R rolls without slipping down an inclined plane of inclination θ. The acceleration of its center of mass is:',
        userAnswer: '(2/3) g sin θ',
        correctAnswer: '(2/3) g sin θ',
        status: 'CORRECT',
        marks: 4,
        solution: 'For a solid cylinder, I_cm = ½MR². Using a = g sin θ / (1 + I/(MR²)) = (2/3) g sin θ.',
      },
      {
        id: 'phy_2',
        number: 2,
        subject: 'Physics',
        topic: 'Electrostatics',
        type: 'MCQ',
        prompt:
          'Two point charges +4q and +q are placed at a distance L apart. A third charge Q is placed on the line joining them so the system is in equilibrium:',
        userAnswer: 'Q = -4q/9 at 2L/3 from +4q',
        correctAnswer: 'Q = -4q/9 at 2L/3 from +4q',
        status: 'CORRECT',
        marks: 4,
        solution: 'Null point is at x = 2L/3 from +4q. Net force on +q = 0 gives Q = -4q/9.',
      },
      {
        id: 'chem_1',
        number: 3,
        subject: 'Chemistry',
        topic: 'General Organic Chemistry',
        type: 'MCQ',
        prompt: 'Which of the following carbocations is the MOST stable due to dancing resonance?',
        userAnswer: 'Triphenylmethyl cation',
        correctAnswer: 'Tricyclopropylmethyl carbocation',
        status: 'WRONG',
        marks: -1,
        solution:
          'Tricyclopropylmethyl carbocation exhibits bent banana-bond (2p-sp³) dancing resonance, making it extraordinarily stable.',
      },
      {
        id: 'chem_2',
        number: 4,
        subject: 'Chemistry',
        topic: 'Electrochemistry',
        type: 'MCQ',
        prompt: 'For the Daniell cell at 298 K, if [Zn²⁺] = 0.01 M and [Cu²⁺] = 1.0 M, E_cell is:',
        userAnswer: 'E° + 0.0591 V',
        correctAnswer: 'E° + 0.0591 V',
        status: 'CORRECT',
        marks: 4,
        solution: 'E = E° - (0.0591/2) log(0.01 / 1.0) = E° + 0.0591 V.',
      },
      {
        id: 'math_1',
        number: 5,
        subject: 'Math',
        topic: 'Definite Integration',
        type: 'MCQ',
        prompt: 'Evaluate the definite integral I = ∫₀^(π/2) [√(sin x) / (√(sin x) + √(cos x))] dx:',
        userAnswer: 'π / 4',
        correctAnswer: 'π / 4',
        status: 'CORRECT',
        marks: 4,
        solution: 'Applying King’s Property ∫₀ᵃ f(x)dx = ∫₀ᵃ f(a-x)dx gives 2I = π/2 ⇒ I = π/4.',
      },
      {
        id: 'math_4',
        number: 6,
        subject: 'Math',
        topic: 'Definite Integration',
        type: 'NAT',
        prompt: 'Find the value of ∫₀² |x - 1| dx:',
        userAnswer: '1',
        correctAnswer: '1',
        status: 'CORRECT',
        marks: 4,
        solution: 'Symmetric V-graph on [0,1] and [1,2]: area = ½(1)(1) + ½(1)(1) = 1.',
      },
    ],
    diagnosisBullets: [
      'Physics & Mathematics showed 100% accuracy (+16/16 marks).',
      'Revise GOC Carbocation Stability & Dancing Resonance in Chemistry.',
    ],
    timestamp: '2026-11-03T16:30:00Z',
  },
  {
    testId: 'sub_infinite_02',
    uid: 'local_aspirant_01',
    title: 'Infinite Practice Equal-Distribution Drill (3 Chapters · 6 Qs)',
    classYear: 'Class 12',
    examType: 'JEE',
    mode: 'INFINITE_PRACTICE',
    totalQuestions: 6,
    score: 15,
    maxScore: 24,
    accuracyPercent: 67,
    correctCount: 4,
    wrongCount: 1,
    timeTaken: 780,
    subjectBreakdown: {
      Physics: {
        subject: 'Physics',
        score: 8,
        maxScore: 8,
        correct: 2,
        wrong: 0,
        unattempted: 0,
        accuracyPercent: 100,
      },
      Chemistry: {
        subject: 'Chemistry',
        score: 4,
        maxScore: 8,
        correct: 1,
        wrong: 0,
        unattempted: 1,
        accuracyPercent: 100,
      },
      Math: {
        subject: 'Math',
        score: 3,
        maxScore: 8,
        correct: 1,
        wrong: 1,
        unattempted: 0,
        accuracyPercent: 50,
      },
    },
    questionRows: [
      {
        id: 'phy_4',
        number: 1,
        subject: 'Physics',
        topic: 'Thermodynamics',
        type: 'NAT',
        prompt: 'A Carnot engine operates between 600 K and 300 K. Find percentage efficiency:',
        userAnswer: '50',
        correctAnswer: '50',
        status: 'CORRECT',
        marks: 4,
        solution: 'η = (1 - 300/600) × 100 = 50%.',
      },
      {
        id: 'chem_4',
        number: 2,
        subject: 'Chemistry',
        topic: 'General Organic Chemistry',
        type: 'NAT',
        prompt: 'Find the total number of hyperconjugative α-hydrogen atoms in propene (CH₃-CH=CH₂):',
        userAnswer: '3',
        correctAnswer: '3',
        status: 'CORRECT',
        marks: 4,
        solution: 'The sp³ methyl carbon attached to the double bond carries 3 α-hydrogens.',
      },
      {
        id: 'math_2',
        number: 3,
        subject: 'Math',
        topic: 'Conic Sections',
        type: 'MCQ',
        prompt: 'The locus of the point of intersection of perpendicular tangents to x²/16 + y²/9 = 1 is:',
        userAnswer: 'x² + y² = 7',
        correctAnswer: 'x² + y² = 25',
        status: 'WRONG',
        marks: -1,
        solution: 'Director circle of x²/a² + y²/b² = 1 is x² + y² = a² + b² = 16 + 9 = 25.',
      },
    ],
    diagnosisBullets: [
      'Equal-distribution drill across 3 selected chapters completed in 13m 00s.',
      'Review Director Circle formula x² + y² = a² + b² in Coordinate Geometry.',
    ],
    timestamp: '2026-11-01T19:15:00Z',
  },
  {
    testId: 'sub_baseline_00',
    uid: 'local_aspirant_01',
    title: 'Foundation Diagnostic Part-Syllabus Test #0 (JEE)',
    classYear: 'Class 12',
    examType: 'JEE',
    mode: 'MOCK',
    totalQuestions: 6,
    score: 11,
    maxScore: 24,
    accuracyPercent: 60,
    correctCount: 3,
    wrongCount: 2,
    timeTaken: 1650,
    subjectBreakdown: {
      Physics: {
        subject: 'Physics',
        score: 3,
        maxScore: 8,
        correct: 1,
        wrong: 1,
        unattempted: 0,
        accuracyPercent: 50,
      },
      Chemistry: {
        subject: 'Chemistry',
        score: 4,
        maxScore: 8,
        correct: 1,
        wrong: 0,
        unattempted: 1,
        accuracyPercent: 100,
      },
      Math: {
        subject: 'Math',
        score: 4,
        maxScore: 8,
        correct: 1,
        wrong: 1,
        unattempted: 0,
        accuracyPercent: 50,
      },
    },
    questionRows: [
      {
        id: 'phy_3',
        number: 1,
        subject: 'Physics',
        topic: 'Modern Physics',
        type: 'MCQ',
        prompt: 'Ratio of de Broglie wavelengths of a proton and an alpha particle accelerated through potential V:',
        userAnswer: '2√2 : 1',
        correctAnswer: '2√2 : 1',
        status: 'CORRECT',
        marks: 4,
        solution: 'λ ∝ 1/√(mq), so λ_p/λ_α = √(4 × 2) = 2√2 : 1.',
      },
    ],
    diagnosisBullets: [
      'Baseline diagnostic completed at 60% accuracy.',
      'Subsequent attempts improved accuracy to 67% and 83%.',
    ],
    timestamp: '2026-10-27T17:00:00Z',
  },
];





