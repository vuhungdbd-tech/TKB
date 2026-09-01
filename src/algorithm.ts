import { Class, Subject, Teacher, Config, TimetableSlot } from './types';

export interface LessonToSchedule {
  classId: string;
  subjectId: string;
  teacherId: string;
  type: string;
  isDouble: boolean;
  session: string;
  isExam?: boolean;
  reason?: string;
}

export function generateTimetable(
  classes: Class[],
  subjects: Subject[],
  teachers: Teacher[],
  config: Config
): { slots: TimetableSlot[], unassigned: LessonToSchedule[] } {
  const slots: TimetableSlot[] = [];
  const unassigned: LessonToSchedule[] = [];
  const totalPeriods = config.morningLessons + config.afternoonLessons;

  // Helper to get exam subjects for a grade based on config
  const getExamSubjectsForGrade = (grade: number): Subject[] => {
    const gradeExamConfig = (config.exams || []).find(e => e.grade === grade);
    const examTerm = config.currentExamTerm || 'none';
    if (examTerm === 'none' || !gradeExamConfig) return [];
    
    const subjectsKey = `${examTerm}Subjects` as keyof typeof gradeExamConfig;
    const selectedIds = gradeExamConfig[subjectsKey] as string[] | undefined;

    if (selectedIds && selectedIds.length > 0) {
      return subjects.filter(s => selectedIds.includes(s.id));
    }

    // Fallback to old logic for backward compatibility (if any old data exists)
    const examCount = (gradeExamConfig[examTerm as keyof typeof gradeExamConfig] as number) || 0;
    if (examCount <= 0) return [];

    const availableExamSubjects = subjects
      .filter(s => s.hasExam)
      .sort((a, b) => {
        const typeOrder = { main: 0, integrated: 1, sub: 2 };
        if (a.type !== b.type) {
          return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
        }
        return a.name.localeCompare(b.name);
      });

    let currentExamPeriods = 0;
    const examSubjects: Subject[] = [];
    for (const s of availableExamSubjects) {
      const duration = s.examDuration || 1;
      if (currentExamPeriods + duration <= examCount) {
        examSubjects.push(s);
        currentExamPeriods += duration;
      }
    }
    return examSubjects;
  };

  // 1. Generate all required lessons
  let lessons: LessonToSchedule[] = [];
  
  const currentTerm = config.currentTerm || 'I';

  const getSubjectLessons = (subject: Subject, grade: number): number => {
    if (subject.gradeConfigs && subject.gradeConfigs[grade]) {
      const termConfig = currentTerm === 'I' ? subject.gradeConfigs[grade].term1 : subject.gradeConfigs[grade].term2;
      if (termConfig !== undefined) return termConfig;
    }
    if (subject.type === 'integrated' || subject.type === 'sub') {
      return 0;
    }
    return subject.lessonsPerWeek;
  };

  for (const cls of classes) {
    const examSubjects = getExamSubjectsForGrade(cls.grade);
    
    for (const sub of subjects) {
      const clsLessonsPerWeek = getSubjectLessons(sub, cls.grade);
      
      if (clsLessonsPerWeek <= 0) continue;

      // Find teacher for this class and subject
      const teacher = teachers.find(t => 
        t.assignments.some(a => a.subjectId === sub.id && a.classIds.includes(cls.id))
      );
      if (!teacher) {
        // No teacher found, add to unassigned
        for (let i = 0; i < clsLessonsPerWeek; i++) {
          unassigned.push({
            classId: cls.id,
            subjectId: sub.id,
            teacherId: 'none',
            type: sub.type,
            isDouble: false,
            session: sub.session
          });
        }
        continue;
      }

      let remaining = clsLessonsPerWeek;
      let isFirstLesson = true;
      const isSubjectExam = examSubjects.some(es => es.id === sub.id);

      // If double allowed, try to group them
      while (remaining > 0) {
        let isExam = false;
        let isExamDouble = false;
        if (isSubjectExam && isFirstLesson) {
          isExam = true;
          isFirstLesson = false;
          if ((sub.examDuration || 1) === 2 && remaining >= 2) {
            isExamDouble = true;
          }
        }

        if (isExamDouble) {
          lessons.push({ classId: cls.id, subjectId: sub.id, teacherId: teacher.id, type: sub.type, isDouble: true, session: sub.session, isExam: true });
          remaining -= 2;
        } else if (sub.allowDouble && remaining >= 2 && !isExam) {
          lessons.push({ classId: cls.id, subjectId: sub.id, teacherId: teacher.id, type: sub.type, isDouble: true, session: sub.session, isExam: false });
          remaining -= 2;
        } else {
          lessons.push({ classId: cls.id, subjectId: sub.id, teacherId: teacher.id, type: sub.type, isDouble: false, session: sub.session, isExam });
          remaining -= 1;
        }
      }
    }
  }

  // 2. Sort lessons: Exams first, then Main, then integrated, then sub. Double lessons first.
  lessons.sort((a, b) => {
    if (a.isExam && !b.isExam) return -1;
    if (!a.isExam && b.isExam) return 1;

    const typeOrder = { main: 0, integrated: 1, sub: 2 };
    if (typeOrder[a.type as keyof typeof typeOrder] !== typeOrder[b.type as keyof typeof typeOrder]) {
      return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
    }
    if (a.isDouble && !b.isDouble) return -1;
    if (!a.isDouble && b.isDouble) return 1;
    return 0;
  });

  // Helper structures for constraints
  const classSchedule: Record<string, Record<number, Record<number, string>>> = {}; // classId -> day -> period -> subjectId
  const teacherSchedule: Record<string, Record<number, Record<number, string>>> = {}; // teacherId -> day -> period -> classId
  const classSubjectDays: Record<string, Record<string, Set<number>>> = {}; // classId -> subjectId -> Set of days
  const teacherDailyCount: Record<string, Record<number, number>> = {}; // teacherId -> day -> count
  const gradeSubjectExamSlot: Record<number, Record<string, { day: number, period: number }>> = {}; // grade -> subjectId -> {day, period}

  // Initialize helpers
  for (const cls of classes) {
    classSchedule[cls.id] = {};
    classSubjectDays[cls.id] = {};
    for (let d = 0; d < config.days; d++) classSchedule[cls.id][d] = {};
    for (const sub of subjects) classSubjectDays[cls.id][sub.id] = new Set();
  }
  for (const t of teachers) {
    teacherSchedule[t.id] = {};
    teacherDailyCount[t.id] = {};
    for (let d = 0; d < config.days; d++) {
      teacherSchedule[t.id][d] = {};
      teacherDailyCount[t.id][d] = 0;
    }
  }

  const teacherSubjects: Record<string, Set<string>> = {};
  for (const t of teachers) {
    teacherSubjects[t.id] = new Set(t.assignments.map(a => a.subjectId));
  }

  const isSchoolOff = (day: number, period: number): boolean => {
    if (!config.timeOff) return false;
    const session = period < config.morningLessons ? 'morning' : 'afternoon';
    return config.timeOff.some(off => off.day === day && (off.session === 'all' || off.session === session));
  };

  const isTeacherOff = (teacherId: string, day: number, period: number): boolean => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher || !teacher.timeOff) return false;
    const session = period < config.morningLessons ? 'morning' : 'afternoon';
    return teacher.timeOff.some(off => off.day === day && (off.session === 'all' || off.session === session));
  };

  const findExamTeacher = (lesson: LessonToSchedule, day: number, period: number, excludeTeacherId?: string): string | null => {
    const sub = subjects.find(s => s.id === lesson.subjectId);
    if (!sub || !lesson.isExam) return lesson.teacherId;

    // A teacher cannot proctor their own subject (either by assignment or specialization)
    const isTeacherQualified = (teacherId: string) => {
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher) return false;
      
      // Check if teacher is assigned to this subject
      const isTeachingSubject = teacherSubjects[teacherId].has(lesson.subjectId);
      if (isTeachingSubject) return false;

      // Check if teacher specialization matches subject name
      if (teacher.specialization && sub.name) {
        const spec = teacher.specialization.toLowerCase();
        const subName = sub.name.toLowerCase();
        if (spec.includes(subName) || subName.includes(spec)) return false;
      }

      return true;
    };

    // Find any free teacher who doesn't teach this subject
    for (const t of teachers) {
      if (t.id === excludeTeacherId) continue;
      if (!isTeacherQualified(t.id)) continue;
      if (isTeacherOff(t.id, day, period)) continue;
      if (teacherSchedule[t.id][day][period]) continue;
      if (teacherDailyCount[t.id][day] + 1 > t.maxLessonsPerSession) continue;
      return t.id;
    }

    return null;
  };

  const checkSlotValidity = (lesson: LessonToSchedule, day: number, period: number): { valid: boolean, reason?: string } => {
    // Exam synchronization constraint for grade
    const cls = classes.find(c => c.id === lesson.classId);
    if (lesson.isExam && cls) {
      const gradeSlot = gradeSubjectExamSlot[cls.grade]?.[lesson.subjectId];
      if (gradeSlot) {
        if (gradeSlot.day !== day || gradeSlot.period !== period) return { valid: false, reason: 'Lịch thi đồng bộ khối' };
      } else {
        const gradeExamConfig = (config.exams || []).find(e => e.grade === cls.grade);
        if (gradeExamConfig && gradeExamConfig.preferredDay !== undefined) {
          if (day !== gradeExamConfig.preferredDay) return { valid: false, reason: 'Ngày thi ưu tiên' };
          const gradeExamSubjects = getExamSubjectsForGrade(cls.grade);
          const isFirstExamSubject = gradeExamSubjects[0]?.id === lesson.subjectId;
          if (isFirstExamSubject && gradeExamConfig.preferredPeriod !== undefined && period !== gradeExamConfig.preferredPeriod) {
            return { valid: false, reason: 'Tiết thi ưu tiên' };
          }
        }
      }
    }

    // Session check
    if (lesson.session === 'morning' && period >= config.morningLessons) return { valid: false, reason: 'Sai buổi học' };
    if (lesson.session === 'afternoon' && period < config.morningLessons) return { valid: false, reason: 'Sai buổi học' };

    // School off check
    if (isSchoolOff(day, period)) return { valid: false, reason: 'Trường nghỉ' };
    if (lesson.isDouble && isSchoolOff(day, period + 1)) return { valid: false, reason: 'Trường nghỉ (Tiết đôi)' };

    // Class available?
    if (classSchedule[lesson.classId][day][period]) return { valid: false, reason: 'Lớp bận' };
    if (lesson.isDouble && (period + 1 >= totalPeriods || classSchedule[lesson.classId][day][period + 1])) return { valid: false, reason: 'Không đủ tiết đôi cho lớp' };
    
    // Teacher available?
    if (lesson.isExam) {
      if (lesson.isDouble) {
        const t1 = findExamTeacher(lesson, day, period);
        if (!t1) return { valid: false, reason: 'Thiếu giám thị (Tiết 1)' };
        const t2 = findExamTeacher(lesson, day, period + 1, t1);
        if (!t2) return { valid: false, reason: 'Thiếu giám thị (Tiết 2)' };
      } else {
        const primary = findExamTeacher(lesson, day, period);
        if (!primary) return { valid: false, reason: 'Thiếu giám thị' };
      }
    } else {
      // CRITICAL: Prevent teacher from being in two classes at once
      if (isTeacherOff(lesson.teacherId, day, period)) {
        return { valid: false, reason: 'Giáo viên xin nghỉ' };
      }
      if (lesson.isDouble && isTeacherOff(lesson.teacherId, day, period + 1)) {
        return { valid: false, reason: 'Giáo viên xin nghỉ (Tiết đôi)' };
      }
      if (teacherSchedule[lesson.teacherId][day][period]) {
        return { valid: false, reason: 'Giáo viên bận ở lớp khác' };
      }
      if (lesson.isDouble && teacherSchedule[lesson.teacherId][day][period + 1]) {
        return { valid: false, reason: 'Giáo viên bận ở lớp khác (Tiết đôi)' };
      }

      // Teacher daily limit
      const addedCount = lesson.isDouble ? 2 : 1;
      const teacher = teachers.find(t => t.id === lesson.teacherId);
      if (teacher && teacherDailyCount[lesson.teacherId][day] + addedCount > teacher.maxLessonsPerSession) {
        return { valid: false, reason: 'Vượt định mức tiết/buổi của giáo viên' };
      }
    }

    // Subject daily limit
    if (classSubjectDays[lesson.classId][lesson.subjectId].has(day)) return { valid: false, reason: 'Môn học đã có trong ngày' };

    return { valid: true };
  };

  const placeLesson = (lesson: LessonToSchedule, day: number, period: number) => {
    const cls = classes.find(c => c.id === lesson.classId);
    if (lesson.isExam && cls) {
      if (!gradeSubjectExamSlot[cls.grade]) gradeSubjectExamSlot[cls.grade] = {};
      if (!gradeSubjectExamSlot[cls.grade][lesson.subjectId]) {
        gradeSubjectExamSlot[cls.grade][lesson.subjectId] = { day, period };
      }
    }

    if (lesson.isExam && lesson.isDouble) {
      const t1 = findExamTeacher(lesson, day, period);
      const t2 = findExamTeacher(lesson, day, period + 1, t1);
      
      if (t1 && t2) {
        classSchedule[lesson.classId][day][period] = lesson.subjectId;
        teacherSchedule[t1][day][period] = lesson.classId;
        teacherDailyCount[t1][day]++;
        slots.push({ classId: lesson.classId, day, period, subjectId: lesson.subjectId, teacherId: t1, isExam: true });

        classSchedule[lesson.classId][day][period + 1] = lesson.subjectId;
        teacherSchedule[t2][day][period + 1] = lesson.classId;
        teacherDailyCount[t2][day]++;
        slots.push({ classId: lesson.classId, day, period: period + 1, subjectId: lesson.subjectId, teacherId: t2, isExam: true });
        
        classSubjectDays[lesson.classId][lesson.subjectId].add(day);
      }
    } else {
      const primaryTeacherId = findExamTeacher(lesson, day, period) || lesson.teacherId;

      classSchedule[lesson.classId][day][period] = lesson.subjectId;
      teacherSchedule[primaryTeacherId][day][period] = lesson.classId;
      teacherDailyCount[primaryTeacherId][day]++;

      classSubjectDays[lesson.classId][lesson.subjectId].add(day);
      slots.push({ 
        classId: lesson.classId, 
        day, 
        period, 
        subjectId: lesson.subjectId, 
        teacherId: primaryTeacherId, 
        isExam: lesson.isExam 
      });

      if (lesson.isDouble) {
        classSchedule[lesson.classId][day][period + 1] = lesson.subjectId;
        teacherSchedule[primaryTeacherId][day][period + 1] = lesson.classId;
        teacherDailyCount[primaryTeacherId][day]++;
        slots.push({ 
          classId: lesson.classId, 
          day, 
          period: period + 1, 
          subjectId: lesson.subjectId, 
          teacherId: primaryTeacherId, 
          isExam: lesson.isExam 
        });
      }
    }
  };

  // 3. Greedy placement
  for (const lesson of lessons) {
    let placed = false;
    const days = Array.from({ length: config.days }, (_, i) => i).sort(() => Math.random() - 0.5);
    const failureReasons = new Set<string>();
    
    for (const day of days) {
      if (placed) break;
      for (let period = 0; period < totalPeriods; period++) {
        if (lesson.isDouble && period === config.morningLessons - 1) continue;

        const result = checkSlotValidity(lesson, day, period);
        if (result.valid) {
          placeLesson(lesson, day, period);
          placed = true;
          break;
        } else if (result.reason) {
          failureReasons.add(result.reason);
        }
      }
    }

    if (!placed) {
      let reason = 'Không tìm thấy tiết trống phù hợp';
      if (failureReasons.has('Trường nghỉ') || failureReasons.has('Trường nghỉ (Tiết đôi)')) {
        reason = 'Trường nghỉ, không đủ thời gian';
      } else if (failureReasons.has('Giáo viên xin nghỉ') || failureReasons.has('Giáo viên xin nghỉ (Tiết đôi)')) {
        reason = 'Giáo viên xin nghỉ';
      } else if (failureReasons.has('Giáo viên bận ở lớp khác') || failureReasons.has('Giáo viên bận ở lớp khác (Tiết đôi)')) {
        reason = 'Giáo viên bận ở lớp khác';
      } else if (failureReasons.has('Vượt định mức tiết/buổi của giáo viên')) {
        reason = 'Vượt định mức tiết/buổi của giáo viên';
      } else if (failureReasons.has('Thiếu giám thị')) {
        reason = 'Thiếu giám thị coi thi';
      }
      
      unassigned.push({ ...lesson, reason });
      if (lesson.isDouble) unassigned.push({...lesson, isDouble: false, reason});
    }
  }

  return { slots, unassigned };
}
