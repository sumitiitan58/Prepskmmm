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
  SyllabusTopicItem,
  TestSubmission,
  VideoDoubtItem,
  VideoRoadmapItem,
} from './types';

export const XP_PER_COMPLETED_TASK = 75;

export const MENTOR_AVATAR_PATH = '/src/assets/images/mentor_sumit_avatar_1793804168394.jpg';
export const LECTURE_COVER_PATH =
  '/src/assets/images/lecture_rotational_mechanics_cover_1793804167049.jpg';

export const DEFAULT_BRAND_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="16" fill="#4F46E5"/>
    <rect x="3" y="3" width="58" height="58" rx="13" stroke="#E0E7FF" stroke-width="2" stroke-opacity="0.7"/>
    <path d="M18 44V20h13.5c5.5 0 9.5 3.4 9.5 8.5s-4 8.5-9.5 8.5H24.5V44H18zm6.5-12.5h6.2c2.3 0 3.8-1.2 3.8-3s-1.5-3-3.8-3h-6.2v6z" fill="#FFFFFF"/>
    <circle cx="46" cy="42" r="5.5" fill="#FBBF24"/>
    <path d="M46 15l2.2 4.6L53 20.5l-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.9L46 15z" fill="#34D399"/>
  </svg>`
)}`;

export const DEFAULT_USER: AspirantUser = {
  uid: 'guest_aspirant',
  email: '',
  name: 'Guest Student',
  classYear: 'Class 12',
  targetExam: 'JEE',
  photoURL: MENTOR_AVATAR_PATH,
  isGuest: true,
  currentStreak: 0,
  dailyGoalTasks: 4,
  totalFocusMinutes: 0,
  subjectFocusMinutes: {
    Physics: 0,
    Chemistry: 0,
    Math: 0,
    Biology: 0,
  },
  xpPoints: 0,
  completedSyllabusTopics: [],
  lastActiveDate: '',
  createdAt: new Date().toISOString(),
};

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const SYLLABUS_TOPICS: SyllabusTopicItem[] = [
  // PHYSICS (JEE & NEET)
  {
    id: 'syl_phy_kinematics_nlm',
    subject: 'Physics',
    chapterName: 'Kinematics, NLM & Work-Energy-Power',
    weightageLabel: '8% Weightage',
    estimatedHours: 12,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_phy_rotational',
    subject: 'Physics',
    chapterName: 'System of Particles & Rotational Motion',
    weightageLabel: '9% Weightage',
    estimatedHours: 16,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_phy_thermo_ktg',
    subject: 'Physics',
    chapterName: 'Thermodynamics & Kinetic Theory of Gases',
    weightageLabel: '8% Weightage',
    estimatedHours: 10,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_phy_electrostatics',
    subject: 'Physics',
    chapterName: 'Electrostatics, Gauss Law & Capacitors',
    weightageLabel: '10% Weightage',
    estimatedHours: 15,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_phy_current_mag',
    subject: 'Physics',
    chapterName: 'Current Electricity, Moving Charges & Magnetism',
    weightageLabel: '11% Weightage',
    estimatedHours: 16,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_phy_optics_modern',
    subject: 'Physics',
    chapterName: 'Ray & Wave Optics + Dual Nature, Atoms & Nuclei',
    weightageLabel: '14% Weightage',
    estimatedHours: 18,
    examTypes: ['JEE', 'NEET'],
  },

  // CHEMISTRY (JEE & NEET)
  {
    id: 'syl_chem_bonding_periodic',
    subject: 'Chemistry',
    chapterName: 'Chemical Bonding, VSEPR & Molecular Orbital Theory',
    weightageLabel: '9% Weightage',
    estimatedHours: 12,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_chem_thermo_eq',
    subject: 'Chemistry',
    chapterName: 'Chemical & Ionic Equilibrium + Thermodynamics',
    weightageLabel: '9% Weightage',
    estimatedHours: 14,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_chem_electro_kinetics',
    subject: 'Chemistry',
    chapterName: 'Electrochemistry, Nernst Eq & Chemical Kinetics',
    weightageLabel: '10% Weightage',
    estimatedHours: 12,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_chem_goc_isomerism',
    subject: 'Chemistry',
    chapterName: 'General Organic Chemistry (GOC) & Stereoisomerism',
    weightageLabel: '10% Weightage',
    estimatedHours: 15,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_chem_carbonyls_amines',
    subject: 'Chemistry',
    chapterName: 'Aldehydes, Ketones, Carboxylic Acids & Amines',
    weightageLabel: '11% Weightage',
    estimatedHours: 15,
    examTypes: ['JEE', 'NEET'],
  },
  {
    id: 'syl_chem_coord_dfblock',
    subject: 'Chemistry',
    chapterName: 'Coordination Compounds & d/f-Block Elements',
    weightageLabel: '10% Weightage',
    estimatedHours: 12,
    examTypes: ['JEE', 'NEET'],
  },

  // MATHEMATICS (JEE)
  {
    id: 'syl_math_algebra_complex',
    subject: 'Math',
    chapterName: 'Quadratic Equations, Complex Numbers & Sequences',
    weightageLabel: '10% Weightage',
    estimatedHours: 14,
    examTypes: ['JEE'],
  },
  {
    id: 'syl_math_matrices_pnc',
    subject: 'Math',
    chapterName: 'Matrices, Determinants, P&C & Probability',
    weightageLabel: '12% Weightage',
    estimatedHours: 16,
    examTypes: ['JEE'],
  },
  {
    id: 'syl_math_conics_coord',
    subject: 'Math',
    chapterName: 'Straight Lines, Circles & Conic Sections',
    weightageLabel: '11% Weightage',
    estimatedHours: 18,
    examTypes: ['JEE'],
  },
  {
    id: 'syl_math_diff_calculus',
    subject: 'Math',
    chapterName: 'Limits, Continuity, Differentiability & AOD',
    weightageLabel: '12% Weightage',
    estimatedHours: 16,
    examTypes: ['JEE'],
  },
  {
    id: 'syl_math_int_calculus',
    subject: 'Math',
    chapterName: 'Definite Integration, Area & Differential Equations',
    weightageLabel: '13% Weightage',
    estimatedHours: 18,
    examTypes: ['JEE'],
  },
  {
    id: 'syl_math_vectors_3d',
    subject: 'Math',
    chapterName: 'Vector Algebra & 3D Coordinate Geometry',
    weightageLabel: '11% Weightage',
    estimatedHours: 14,
    examTypes: ['JEE'],
  },

  // BIOLOGY (NEET)
  {
    id: 'syl_bio_cell_biomolecules',
    subject: 'Biology',
    chapterName: 'Cell Structure, Cell Cycle & Biomolecules',
    weightageLabel: '9% Weightage',
    estimatedHours: 10,
    examTypes: ['NEET'],
  },
  {
    id: 'syl_bio_plant_phys',
    subject: 'Biology',
    chapterName: 'Plant Physiology: Photosynthesis, Respiration & Growth',
    weightageLabel: '8% Weightage',
    estimatedHours: 12,
    examTypes: ['NEET'],
  },
  {
    id: 'syl_bio_human_phys',
    subject: 'Biology',
    chapterName: 'Human Physiology: Breathing, Circulation, Excretion & Neural',
    weightageLabel: '16% Weightage',
    estimatedHours: 20,
    examTypes: ['NEET'],
  },
  {
    id: 'syl_bio_reproduction',
    subject: 'Biology',
    chapterName: ' Flowering Plants & Human Reproduction + Reproductive Health',
    weightageLabel: '9% Weightage',
    estimatedHours: 12,
    examTypes: ['NEET'],
  },
  {
    id: 'syl_bio_genetics_evolution',
    subject: 'Biology',
    chapterName: 'Principles of Inheritance, Molecular Genetics & Evolution',
    weightageLabel: '18% Weightage',
    estimatedHours: 22,
    examTypes: ['NEET'],
  },
  {
    id: 'syl_bio_biotech_ecology',
    subject: 'Biology',
    chapterName: 'Biotechnology Principles/Applications & Ecology',
    weightageLabel: '14% Weightage',
    estimatedHours: 15,
    examTypes: ['NEET'],
  },
];

export const INITIAL_TASKS: StudyTask[] = [];

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

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [];

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
  'Google Classroom',
];

export const DEFAULT_VIDEO_SECTIONS = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Biology',
  'Master Roadmaps',
];

export const INITIAL_MATERIALS: StudyMaterialItem[] = [];

export const INITIAL_MENTORS: MentorProfileItem[] = [
  {
    id: 'mentor_sumit_master',
    email: 'sumit586kumar@gmail.com',
    name: 'Sumit Kumar',
    roleTitle: 'Founder & Lead Mentor (IIT Roorkee)',
    role: 'Master Admin',
    qualification: 'IIT Roorkee · Founder & Mentor',
    subjectSpecialty: 'All Subjects',
    avatarUrl: MENTOR_AVATAR_PATH,
    jitsiRoomSlug: 'prepskm_mentor_sumit_live',
    jitsiRoomPrefix: 'prepskm_mentor_sumit_live',
    isOnline: true,
    isMasterAdmin: true,
    createdAt: '2026-10-01T09:00:00Z',
  },
];

export const DEFAULT_PW_LECTURE_FALLBACK: VideoRoadmapItem = {
  id: 'vid_batch_orientation',
  title: 'Batch Orientation & High-Yield Syllabus Strategy',
  description:
    'Select any Subject & Chapter from your Batch Classroom to watch structured video lectures, download class notes, and practice DPPs.',
  videoUrl: '',
  thumbnailUrl: LECTURE_COVER_PATH,
  duration: '40:00',
  topicTag: 'Physics · Chapter 1',
  section: 'Physics',
  classCohort: 'Class 12',
  mentorId: 'mentor_sumit_master',
  mentorName: 'Sumit Kumar',
  mentorEmail: 'sumit586kumar@gmail.com',
  mentorRole: 'IIT Roorkee · Founder & Lead Mentor',
  mentorAvatar: MENTOR_AVATAR_PATH,
  isNewRoadmap: false,
  createdAt: new Date().toISOString(),
};

export const INITIAL_VIDEOS: VideoRoadmapItem[] = [];

export const INITIAL_VIDEO_DOUBTS: VideoDoubtItem[] = [];

export const INITIAL_BROADCASTS: BroadcastMessageItem[] = [];

export const DEFAULT_SITE_THEME: SiteThemeSettings = {
  brandName: 'prepskm.in',
  brandTagline: 'JEE · NEET · Class 9–12 & Dropper',
  logoDataUrl: DEFAULT_BRAND_LOGO_SVG,
  primaryColor: '#4F46E5',
  secondaryColor: '#059669',
  accentColor: '#F59E0B',
  surfaceTint: '#F8FAFC',
  surfaceBg: '#F8FAFC',
  presetName: 'Daylight Prism Atelier',
  updatedAt: '2026-11-05T08:00:00Z',
};

export const INITIAL_MENTORSHIP_SESSIONS: MentorshipSessionItem[] = [];

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
    gradientClass: 'from-white via-indigo-50/70 to-sky-50/70',
    accentBorderClass: 'border-indigo-200',
    pillBgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    focusPills: ['Electrostatics & Current', 'Definite Calculus', 'Aldol & Carbonyls', 'Board + JEE PYQs'],
    surfaceTint: '#F8FAFC',
    accentHex: '#4F46E5',
  },
  'JEE|Class 11': {
    key: 'JEE|Class 11',
    label: 'JEE 2028 · Class 11',
    badgeText: 'IIT-JEE CLASS 11 CORE FOUNDATION TRACK',
    headline: 'Class 11 Mechanics, Conics & GOC Launchpad',
    subheadline:
      'Build rock-solid intuition in Rotational Dynamics, Thermodynamics, Coordinate Geometry & General Organic Chemistry from Day 1.',
    gradientClass: 'from-white via-emerald-50/70 to-teal-50/70',
    accentBorderClass: 'border-emerald-200',
    pillBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    focusPills: ['Rotational Mechanics', 'Conic Sections', 'GOC & Isomerism', 'Thermodynamics'],
    surfaceTint: '#F8FAFC',
    accentHex: '#059669',
  },
  'JEE|Dropper': {
    key: 'JEE|Dropper',
    label: 'JEE 2027 · Dropper / Repeater',
    badgeText: 'INTENSIVE DROPPER 99.9%ILE WARRIOR BATCH',
    headline: 'Dropper Intensive Rank Booster & Full-Syllabus Sprint',
    subheadline:
      'Zero-fluff high-yield PYQ drills, rapid Class 11+12 backlog elimination, and daily timed NTA CBT simulations.',
    gradientClass: 'from-white via-amber-50/70 to-orange-50/70',
    accentBorderClass: 'border-amber-200',
    pillBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    focusPills: ['11th + 12th Combined', 'Daily NTA Full Mock', 'High-Weightage 40 Chapters', 'Speed & Accuracy'],
    surfaceTint: '#F8FAFC',
    accentHex: '#D97706',
  },
  'NEET|Class 12': {
    key: 'NEET|Class 12',
    label: 'NEET 2027 · Class 12',
    badgeText: 'NEET-UG CLASS 12 MEDICAL + NCERT MASTERY',
    headline: 'Class 12 NEET Medical & NCERT Line-by-Line Hub',
    subheadline:
      'Master Molecular Genetics, Biotech, Modern Physics, and Organic Name Reactions with 100% NCERT statement accuracy.',
    gradientClass: 'from-white via-emerald-50/70 to-teal-50/70',
    accentBorderClass: 'border-emerald-200',
    pillBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    focusPills: ['Molecular Genetics', 'Reproduction & Ecology', 'Electrochemistry', 'Modern Physics'],
    surfaceTint: '#F8FAFC',
    accentHex: '#059669',
  },
  'NEET|Class 11': {
    key: 'NEET|Class 11',
    label: 'NEET 2028 · Class 11',
    badgeText: 'NEET-UG CLASS 11 MEDICAL FOUNDATION',
    headline: 'Class 11 Human & Plant Physiology + Mechanics Hub',
    subheadline:
      'Deep NCERT diagrams, Human Physiology cycles, Cell Biology, Chemical Bonding, and NLM problem-solving for Class 11.',
    gradientClass: 'from-white via-teal-50/70 to-cyan-50/70',
    accentBorderClass: 'border-teal-200',
    pillBgClass: 'bg-teal-50 text-teal-800 border-teal-200',
    focusPills: ['Human Physiology', 'Plant Kingdom & Cell', 'Chemical Bonding', 'Kinematics & NLM'],
    surfaceTint: '#F8FAFC',
    accentHex: '#0D9488',
  },
  'NEET|Dropper': {
    key: 'NEET|Dropper',
    label: 'NEET 2027 · Dropper / Repeater',
    badgeText: 'NEET 700+ AIIMS INTENSIVE REPEATER TRACK',
    headline: 'NEET Dropper 700+ Score Accelerator & NCERT Drill',
    subheadline:
      'Complete 38-chapter Biology rapid revision, Assertion-Reason traps, and Physics/Chemistry numerical speed builders.',
    gradientClass: 'from-white via-orange-50/70 to-amber-50/70',
    accentBorderClass: 'border-orange-200',
    pillBgClass: 'bg-orange-50 text-orange-800 border-orange-200',
    focusPills: ['NCERT 38-Chapter Bio', 'Assertion-Reason Drills', '180-Q Speed Sprint', 'Error Log Revision'],
    surfaceTint: '#F8FAFC',
    accentHex: '#EA580C',
  },
  'JEE|Class 10': {
    key: 'JEE|Class 10',
    label: 'Class 10 · NTSE / Olympiad + JEE/NEET Early Start',
    badgeText: 'CLASS 10 BOARD + OLYMPIAD FOUNDATION',
    headline: 'Class 10 Board Excellence & Early JEE/NEET Bridge',
    subheadline:
      'Ace Class 10 Science & Mathematics while building early Olympiad concepts in Light, Electricity, Quadratic Equations, and Carbon.',
    gradientClass: 'from-white via-amber-50/70 to-yellow-50/70',
    accentBorderClass: 'border-amber-200',
    pillBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    focusPills: ['Ray Optics & Electricity', 'Carbon & Compounds', 'Trigonometry & Quadratics', 'Life Processes'],
    surfaceTint: '#F8FAFC',
    accentHex: '#D97706',
  },
  'JEE|Class 10 Foundation': {
    key: 'JEE|Class 10 Foundation',
    label: 'Class 10 Foundation · IJSO / NTSE / JEE-NEET Bridge',
    badgeText: 'CLASS 10 FOUNDATION OLYMPIAD ACCELERATOR',
    headline: 'Class 10 Foundation Bridge to Top 100 AIR',
    subheadline:
      'Dedicated Foundation curriculum bridging Class 10 Board Science/Math with JEE/NEET Vectors, Mole Concept, Quadratic Locus, and Cell Energetics.',
    gradientClass: 'from-white via-indigo-50/70 to-purple-50/70',
    accentBorderClass: 'border-indigo-200',
    pillBgClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    focusPills: ['NTSE & IJSO Sprint', 'Early Mole & Atomic', 'Optics + Circuit Bridge', 'Olympiad Number Theory'],
    surfaceTint: '#F8FAFC',
    accentHex: '#4F46E5',
  },
  'JEE|Class 11 Foundation': {
    key: 'JEE|Class 11 Foundation',
    label: 'Class 11 Foundation · Concept-First JEE & NEET Bridge',
    badgeText: 'CLASS 11 FOUNDATION ZERO-TO-ADVANCED TRACK',
    headline: 'Class 11 Foundation: Mathematical Tools, NLM & Atomic Structure',
    subheadline:
      'Step-by-step concept builder for students transitioning from Class 10 to 11 — master Basic Calculus, Vectors, Mole Stoichiometry, and NCERT Foundations without overwhelm.',
    gradientClass: 'from-white via-sky-50/70 to-indigo-50/70',
    accentBorderClass: 'border-sky-200',
    pillBgClass: 'bg-sky-50 text-sky-800 border-sky-200',
    focusPills: ['Calculus & Vector Tools', 'Units, Kinematics & NLM', 'Mole & Atomic Foundation', 'Daily Concept Drills'],
    surfaceTint: '#F8FAFC',
    accentHex: '#0284C7',
  },
  'NEET|Class 10 Foundation': {
    key: 'NEET|Class 10 Foundation',
    label: 'Class 10 Foundation · Medical & Biology Olympiad Track',
    badgeText: 'CLASS 10 MEDICAL + NSEB FOUNDATION',
    headline: 'Class 10 Medical Foundation & NCERT Science Booster',
    subheadline:
      'Early NEET UG & Biology Olympiad preparation covering Life Processes, Heredity, Chemical Reactions, and Ray Optics.',
    gradientClass: 'from-white via-emerald-50/70 to-green-50/70',
    accentBorderClass: 'border-emerald-200',
    pillBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    focusPills: ['Life Processes & Control', 'Heredity & Evolution', 'Acids, Bases & Carbon', 'Light & Current'],
    surfaceTint: '#F8FAFC',
    accentHex: '#059669',
  },
  'NEET|Class 11 Foundation': {
    key: 'NEET|Class 11 Foundation',
    label: 'Class 11 Foundation · NEET UG Concept Bridge',
    badgeText: 'CLASS 11 NEET FOUNDATION + NCERT BRIDGE',
    headline: 'Class 11 Medical Foundation: Cell, Biomolecules & Basic Physics',
    subheadline:
      'Build effortless speed in Basic Mathematics for Physics, Stoichiometry, Cell Biology, and Biomolecules from the ground up.',
    gradientClass: 'from-white via-teal-50/70 to-emerald-50/70',
    accentBorderClass: 'border-teal-200',
    pillBgClass: 'bg-teal-50 text-teal-800 border-teal-200',
    focusPills: ['Basic Math for NEET Physics', 'Cell & Biomolecules', 'Mole & Redox Basics', 'NCERT Diagram Drills'],
    surfaceTint: '#F8FAFC',
    accentHex: '#0D9488',
  },
  'JEE|Class 9': {
    key: 'JEE|Class 9',
    label: 'Class 9 · Junior Science & Math Olympiad Track',
    badgeText: 'CLASS 9 JUNIOR OLYMPIAD & CONCEPT BUILDER',
    headline: 'Class 9 Concept Builder & Junior Olympiad Workspace',
    subheadline:
      'Visual interactive modules for Laws of Motion, Work & Energy, Atoms & Molecules, Number Systems, and Fundamental Unit of Life.',
    gradientClass: 'from-white via-indigo-50/70 to-amber-50/70',
    accentBorderClass: 'border-indigo-200',
    pillBgClass: 'bg-amber-50 text-amber-800 border-amber-200',
    focusPills: ['Motion & Force', 'Atoms & Mole Concept', 'Polynomials & Geometry', 'Cell Biology'],
    surfaceTint: '#F8FAFC',
    accentHex: '#4F46E5',
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

export const INITIAL_TEST_SUBMISSIONS: TestSubmission[] = [];






