
import { AppState, Subject, User, Question, UserRole, QuestionType, ExamAttempt, EnrollmentType } from '../types';
import { QUESTIONS_SUBJ1 } from './data/subj1';
import { QUESTIONS_SUBJ2 } from './data/subj2';
import { QUESTIONS_SUBJ3 } from './data/subj3';
import { QUESTIONS_SUBJ4 } from './data/subj4';
import { QUESTIONS_SUBJ5 } from './data/subj5';
import { QUESTIONS_SUBJ6 } from './data/subj6';
import { QUESTIONS_SUBJ7 } from './data/subj7';

const DB_KEY = 'examSystemDB';
const DB_VERSION = 57; // FINAL FULL VERSION

const INITIAL_SUBJECTS: Subject[] = [
  { id: 'subj1', name: 'المدخل لدراسة الفقه الإسلامي' },
  { id: 'subj2', name: 'علم الإجرام والعقاب' },
  { id: 'subj3', name: 'اللغة الإنجليزية' }, // Questions removed to save space
  { id: 'subj4', name: 'حقوق الإنسان' },
  { id: 'subj5', name: 'العلوم السياسية' },
  { id: 'subj6', name: 'تاريخ النظم الاجتماعية' },
  { id: 'subj7', name: 'مدخل العلوم القانونية' },
];

const INITIAL_USERS: User[] = [
  { 
    id: 'admin01', 
    username: 'admin', 
    email: 'admin@law.edu',
    passwordHash: 'zizo2070', 
    role: UserRole.ADMIN, 
    fullName: 'مدير النظام',
    enrollmentType: EnrollmentType.INTIZAM,
    failedLoginAttempts: 0,
    isLocked: false
  },
];

// Combine all split question arrays
const INITIAL_QUESTIONS: Question[] = [
    ...QUESTIONS_SUBJ7,
    ...QUESTIONS_SUBJ6,
    ...QUESTIONS_SUBJ5,
    ...QUESTIONS_SUBJ4,
    ...QUESTIONS_SUBJ2,
    ...QUESTIONS_SUBJ1,
    ...QUESTIONS_SUBJ3,
];

const getInitialExamSettings = () => {
    const settings: { [subjectId: string]: { 
        isOpen: boolean; 
        section?: string; 
        questionCount: number; 
        durationMinutes: number; 
        allowRetakes: boolean; 
    } } = {};
    INITIAL_SUBJECTS.forEach(subject => {
        settings[subject.id] = { 
            isOpen: true,
            questionCount: 20, 
            durationMinutes: 30,
            allowRetakes: true, 
        };
    });
    return settings;
};

export const initializeDB = (): AppState => {
  const dbString = localStorage.getItem(DB_KEY);
  
  if (dbString) {
    try {
      const parsedDb = JSON.parse(dbString) as AppState;
      
      if (parsedDb.version < DB_VERSION) {
          // Reset to enforce new question set completely
          const initialState: AppState = {
            version: DB_VERSION,
            users: INITIAL_USERS,
            questions: INITIAL_QUESTIONS,
            subjects: INITIAL_SUBJECTS,
            examAttempts: [],
            examSettings: getInitialExamSettings(),
          };
          localStorage.setItem(DB_KEY, JSON.stringify(initialState));
          return initialState;
      }
      
      return parsedDb;
    } catch (e) {
      console.error("Failed to parse DB", e);
      const initialState: AppState = {
        version: DB_VERSION,
        users: INITIAL_USERS,
        questions: INITIAL_QUESTIONS,
        subjects: INITIAL_SUBJECTS,
        examAttempts: [],
        examSettings: getInitialExamSettings(),
      };
      localStorage.setItem(DB_KEY, JSON.stringify(initialState));
      return initialState;
    }
  } else {
    // Fresh start
    const initialState: AppState = {
        version: DB_VERSION,
        users: INITIAL_USERS,
        questions: INITIAL_QUESTIONS,
        subjects: INITIAL_SUBJECTS,
        examAttempts: [],
        examSettings: getInitialExamSettings(),
    };
    localStorage.setItem(DB_KEY, JSON.stringify(initialState));
    return initialState;
  }
};

export const getDB = (): AppState => {
  const db = localStorage.getItem(DB_KEY);
  if (!db) return initializeDB();
  return JSON.parse(db);
};

export const saveDB = (state: AppState) => {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
};
