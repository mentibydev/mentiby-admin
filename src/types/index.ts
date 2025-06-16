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

export interface CohortDistribution {
  cohortType: string;
  cohortNumber: string;
  count: number;
}

export interface FilterOptions {
  cohortType: string;
  cohortNumber: string;
} 