
export enum UserRole {
  ADMIN = 'admin',
  STUDENT = 'student',
}

export enum EnrollmentType {
  INTIZAM = 'intizam', // انتظام
  INTISAB = 'intisab', // انتساب
}

export interface User {
  id: string;
  username: string; // Will be used for display or internal ID logic
  email: string;    // Added for login
  passwordHash: string;
  role: UserRole;
  fullName: string;
  enrollmentType?: EnrollmentType; // Optional because admins might not need it
  failedLoginAttempts: number; // New: Track wrong password attempts
  isLocked: boolean; // New: Lock account after 2 wrong attempts
}

export interface Subject {
  id: string;
  name: string;
}

export enum QuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
}

export interface Question {
  id: string;
  subjectId: string;
  type: QuestionType;
  text: string;
  options?: string[]; // For MCQ
  correctAnswer: string; // For MCQ, the index '0'-'3', for T/F 'true' or 'false'
  explanation?: string;
  section?: string; // e.g., 'أ. علم الإجرام', 'ب. علم العقاب'
}

export type ExamType = 'trial' | 'final';

export interface ExamAttempt {
  id: string;
  userId: string;
  subjectId: string;
  examType: ExamType; // 'trial' or 'final'
  startTime: number;
  endTime: number;
  answers: { [questionId: string]: string };
  questionIds?: string[]; // New: Stores the specific list of questions presented in this attempt
  score: number;
  totalQuestions: number;
  status: 'completed' | 'in-progress';
}

export interface AppState {
    version: number;
    users: User[];
    questions: Question[];
    subjects: Subject[];
    examAttempts: ExamAttempt[];
    examSettings: { [subjectId: string]: { 
        isOpen: boolean;
        section?: string;
        questionCount: number;
        durationMinutes: number;
        allowRetakes: boolean; // Kept for backward compatibility, but specific logic overrides
    } };
}
