export interface OnboardingData {
  EnrollmentID: string;
  'Full Name': string;
  Email: string;
  'Phone Number': string;
  LinkedIn: string;
  GitHub: string;
  Hackerrank: string;
  College: string;
  'College State': string;
  'College Year': string;
  Branch: string;
  'Graduation Year': number;
  Understanding: string;
  'Familiar Skills': string;
  'Built Projects': string;
  Goal: string;
  'Cohort Type': 'Basic' | 'Placement' | 'MERN' | 'Full Stack';
  'Cohort Number': string;
}

export interface StuData {
  enrollment_id: string;
  name: string;
  cohort_type: string;
  cohort_number: string;
  total_classes: number;
  present_classes: number;
  overall_attendance: number;
  created_at?: string;
  updated_at?: string;
}

export interface CohortDistribution {
  cohortType: string;
  cohortNumber: string;
  count: number;
}

export interface FilterOptions {
  cohortType: string;
  cohortNumber: string;
}

// New XP related interfaces
export interface XPData {
  id?: string;
  enrollment_id: string;
  email: string;
  full_name: string;
  cohort_type: string;
  cohort_number: string;
  xp: number;
  last_updated: string;
  created_at?: string;
}

export interface CodedamnXPResponse {
  output: {
    status: 'ok' | 'error';
    data?: {
      cumulativeXpAllTime: number;
    };
    errorMessage?: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  enrollment_id: string;
  full_name: string;
  email: string;
  cohort_type: string;
  cohort_number: string;
  xp: number;
  last_updated: string;
} 