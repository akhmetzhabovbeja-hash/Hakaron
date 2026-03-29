export type UserRole = "candidate" | "manager" | "hr";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface Vacancy {
  id: number;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface QuestionnaireAnswer {
  questionId: number;
  answer: string;
}

export interface CandidateAnalysis {
  id: number;
  candidateId: number;
  vacancyId: number;
  totalScore: number;
  vacancyMatch: number;
  growthPotential: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: "pending" | "analyzed" | "approved" | "rejected";
  createdAt: string;
}

export interface CandidateListItem {
  id: number;
  name: string;
  vacancy: string;
  score: number;
  status: string;
  source: "platform" | "hh_parsed";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
