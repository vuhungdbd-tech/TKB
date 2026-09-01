export interface Class {
  id: string;
  name: string;
  grade: number;
}

export type SubjectType = 'main' | 'sub' | 'integrated';
export type SessionType = 'all' | 'morning' | 'afternoon';

export interface Subject {
  id: string;
  name: string;
  lessonsPerWeek: number;
  gradeConfigs?: Record<number, { term1?: number, term2?: number }>;
  type: SubjectType;
  allowDouble: boolean;
  session: SessionType;
  hasExam?: boolean;
  examDuration?: number; // 1 or 2 periods
}

export interface TeacherAssignment {
  subjectId: string;
  classIds: string[];
}

export interface Teacher {
  id: string;
  name: string;
  specialization?: string;
  assignments: TeacherAssignment[];
  maxLessonsPerWeek: number;
  maxLessonsPerSession: number;
  maxConsecutive: number;
  timeOff?: { day: number, session: SessionType }[];
}

export interface ExamConfig {
  grade: number;
  midTerm1Subjects?: string[];
  finalTerm1Subjects?: string[];
  midTerm2Subjects?: string[];
  finalTerm2Subjects?: string[];
  preferredDay?: number; // 0-5 (Thứ 2 - Thứ 7)
  preferredPeriod?: number; // 0-9 (Tiết 1 - Tiết 10)
}

export interface Config {
  days: number; // e.g., 6 for Mon-Sat
  morningLessons: number;
  afternoonLessons: number;
  schoolName: string;
  appName: string;
  appSubtitle: string;
  schoolYear: string;
  currentTerm?: 'I' | 'II';
  executionDate: string;
  exams: ExamConfig[];
  currentExamTerm?: 'none' | 'midTerm1' | 'finalTerm1' | 'midTerm2' | 'finalTerm2';
  gradeCounts?: Record<number, number>;
  gradePrefixes?: Record<number, string>;
  timeOff?: { day: number, session: SessionType }[];
}

export interface TimetableSlot {
  classId: string;
  day: number; // 0 = Monday, 5 = Saturday
  period: number; // 0 to morningLessons + afternoonLessons - 1
  subjectId: string;
  teacherId: string;
  isExam?: boolean;
}

export interface AppState {
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  config: Config;
  timetable: TimetableSlot[];
  unassigned: any[];
}
