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
      const gConf = subject.gradeConfigs[grade];
      if (gConf.customWeek !== undefined && gConf.customWeek !== null && gConf.customWeek >= 0) {
        return gConf.customWeek;
      }
      const termConfig = currentTerm === 'I' ? gConf.term1 : gConf.term2;
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

  // 2. Count teacher loads for better sorting
  const teacherLoad: Record<string, number> = {};
  for (const l of lessons) {
    if (l.teacherId && l.teacherId !== 'none') {
      teacherLoad[l.teacherId] = (teacherLoad[l.teacherId] || 0) + (l.isDouble ? 2 : 1);
    }
  }

  // 3. Sort lessons: Exams first, then Main, then integrated, then sub. Busiest teachers first. Double lessons first.
  lessons.sort((a, b) => {
    if (a.isExam && !b.isExam) return -1;
    if (!a.isExam && b.isExam) return 1;

    const typeOrder = { main: 0, integrated: 1, sub: 2 };
    if (typeOrder[a.type as keyof typeof typeOrder] !== typeOrder[b.type as keyof typeof typeOrder]) {
      return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
    }
    
    const loadA = teacherLoad[a.teacherId] || 0;
    const loadB = teacherLoad[b.teacherId] || 0;
    if (loadA !== loadB) return loadB - loadA; // Descending order of load

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

  const checkSlotValidity = (lesson: LessonToSchedule, day: number, period: number, relaxConstraints: boolean = false): { valid: boolean, reason?: string } => {
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
        if (!relaxConstraints) return { valid: false, reason: 'Vượt định mức tiết/buổi của giáo viên' };
      }
    }

    // Subject daily limit
    if (classSubjectDays[lesson.classId][lesson.subjectId].has(day)) {
       if (!relaxConstraints) return { valid: false, reason: 'Môn học đã có trong ngày' };
    }

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

  // 4. Greedy placement
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    let placed = false;
    const failureReasons = new Set<string>();
    
    const tryPlace = (relaxConstraints: boolean) => {
      let bestSlot: { day: number, period: number } | null = null;
      let bestScore = Infinity;
      for (let day = 0; day < config.days; day++) {
        for (let period = 0; period < totalPeriods; period++) {
          if (lesson.isDouble && period === config.morningLessons - 1) continue;
          
          const result = checkSlotValidity(lesson, day, period, relaxConstraints);
          if (result.valid) {
            // Calculate score to prevent gaps and balance load
            const isMorning = period < config.morningLessons;
            const startP = isMorning ? 0 : config.morningLessons;
            const endP = isMorning ? config.morningLessons : totalPeriods;
            
            // 1. Gap Penalty: Heavily penalize leaving empty periods before this one
            let lowestEmpty = startP;
            while (lowestEmpty < endP && classSchedule[lesson.classId][day]?.[lowestEmpty]) {
              lowestEmpty++;
            }
            let gapPenalty = 0;
            if (period > lowestEmpty) {
              gapPenalty = (period - lowestEmpty) * 50000;
            }
            
            // 1.b. Teacher Gap Penalty
            let teacherLowestEmpty = startP;
            const tId = lesson.teacherId;
            if (tId && tId !== 'none' && teacherSchedule[tId]) {
              while (teacherLowestEmpty < endP && teacherSchedule[tId][day]?.[teacherLowestEmpty]) {
                teacherLowestEmpty++;
              }
              if (period > teacherLowestEmpty) {
                gapPenalty += (period - teacherLowestEmpty) * 40000;
              }
            }
            
            // 2. Balance Penalty: Strictly force even distribution
            let sessionCount = 0;
            for (let p = startP; p < endP; p++) {
              if (classSchedule[lesson.classId][day]?.[p]) sessionCount++;
            }
            const addedPeriods = lesson.isDouble ? 2 : 1;
            const futureSessionCount = sessionCount + addedPeriods;
            const balancePenalty = Math.pow(futureSessionCount, 3) * 200;
            
            // 3. Late Period Penalty: Strictly penalize going into the 5th period
            let latePenalty = 0;
            if (period >= startP + 4) {
               latePenalty += 100000;
            }
            if (lesson.isDouble && period >= startP + 3) {
               latePenalty += 100000;
            }

            // If relaxing constraints, add a penalty so it's only used as a last resort
            const relaxPenalty = relaxConstraints ? 200000 : 0;

            const dayPenalty = day * 2;
            const score = gapPenalty + balancePenalty + latePenalty + relaxPenalty + dayPenalty + Math.random();
            
            if (score < bestScore) {
              bestScore = score;
              bestSlot = { day, period };
            }
          } else if (!relaxConstraints && result.reason) {
            failureReasons.add(result.reason);
          }
        }
      }
      if (bestSlot) {
        placeLesson(lesson, bestSlot.day, bestSlot.period);
        return true;
      }
      return false;
    };

    placed = tryPlace(false);

    if (!placed && lesson.isDouble) {
      // Split the double lesson into two single lessons and push them to the end of the queue
      lessons.push({ ...lesson, isDouble: false });
      lessons.push({ ...lesson, isDouble: false });
      continue;
    }

    if (!placed && !lesson.isDouble) {
      // Retry with relaxed constraints (e.g., allow same subject twice in a day, or bypass strict limits)
      placed = tryPlace(true);
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
    }
  }

  // 4. Compaction (Gap closing)
  let madeChanges = true;
  let iterations = 0;
  while (madeChanges && iterations < 20) {
    madeChanges = false;
    iterations++;
    for (const cls of classes) {
      for (let day = 0; day < config.days; day++) {
        for (const isMorning of [true, false]) {
          const startP = isMorning ? 0 : config.morningLessons;
          const endP = isMorning ? config.morningLessons : totalPeriods;
          
          const getTeacherScore = (tId: string | null) => {
             if (!tId || tId === 'none' || !teacherSchedule[tId]) return 0;
             let first = -1; let last = -1; let count = 0;
             for (let p = startP; p < endP; p++) {
               if (teacherSchedule[tId][day][p]) {
                 if (first === -1) first = p;
                 last = p;
                 count++;
               }
             }
             if (first === -1) return 0;
             return ((last - first + 1) - count) * 40000 + (first - startP) * 10;
          };
          const getClassScore = () => {
             let first = -1; let last = -1; let count = 0;
             for (let p = startP; p < endP; p++) {
               if (classSchedule[cls.id][day][p]) {
                 if (first === -1) first = p;
                 last = p;
                 count++;
               }
             }
             if (first === -1) return 0;
             let latePenalty = 0;
             if (last - startP >= 4) latePenalty += 100000;
             return ((last - first + 1) - count) * 50000 + (first - startP) * 10 + latePenalty;
          };
          
          if (getClassScore() === 0) continue;
          
          for (let p1 = startP; p1 < endP; p1++) {
            for (let p2 = startP; p2 < endP; p2++) {
              if (p1 === p2) continue;
              
              const sub1 = classSchedule[cls.id][day][p1];
              const sub2 = classSchedule[cls.id][day][p2];
              if (!sub1 && !sub2) continue;
              
              const s1 = slots.find(s => s.classId === cls.id && s.day === day && s.period === p1);
              const s2 = slots.find(s => s.classId === cls.id && s.day === day && s.period === p2);
              if ((s1 && s1.isExam) || (s2 && s2.isExam)) continue;
              
              const isDouble1 = sub1 && ((p1 + 1 < endP && classSchedule[cls.id][day][p1+1] === sub1) || (p1 - 1 >= startP && classSchedule[cls.id][day][p1-1] === sub1));
              const isDouble2 = sub2 && ((p2 + 1 < endP && classSchedule[cls.id][day][p2+1] === sub2) || (p2 - 1 >= startP && classSchedule[cls.id][day][p2-1] === sub2));
              if (isDouble1 || isDouble2) continue;
              
              let canSwap = true;
              if (s1) {
                if (isTeacherOff(s1.teacherId, day, p2)) canSwap = false;
                if (teacherSchedule[s1.teacherId][day][p2] && teacherSchedule[s1.teacherId][day][p2] !== cls.id) canSwap = false;
                if (isSchoolOff(day, p2)) canSwap = false;
              }
              if (s2) {
                if (isTeacherOff(s2.teacherId, day, p1)) canSwap = false;
                if (teacherSchedule[s2.teacherId][day][p1] && teacherSchedule[s2.teacherId][day][p1] !== cls.id) canSwap = false;
                if (isSchoolOff(day, p1)) canSwap = false;
              }
              
              if (canSwap) {
                const t1Id = s1 ? s1.teacherId : null;
                const t2Id = s2 ? s2.teacherId : null;
                
                const getGlobalScore = () => getClassScore() + getTeacherScore(t1Id) + (t1Id !== t2Id ? getTeacherScore(t2Id) : 0);
                
                const oldScore = getGlobalScore();
                
                if (s1 && t1Id && teacherSchedule[t1Id]) { delete teacherSchedule[t1Id][day][p1]; }
                if (s1) { delete classSchedule[cls.id][day][p1]; }
                
                if (s2 && t2Id && teacherSchedule[t2Id]) { delete teacherSchedule[t2Id][day][p2]; }
                if (s2) { delete classSchedule[cls.id][day][p2]; }
                
                if (s1 && t1Id && teacherSchedule[t1Id]) { teacherSchedule[t1Id][day][p2] = cls.id; }
                if (s1) { classSchedule[cls.id][day][p2] = s1.subjectId; s1.period = p2; }
                
                if (s2 && t2Id && teacherSchedule[t2Id]) { teacherSchedule[t2Id][day][p1] = cls.id; }
                if (s2) { classSchedule[cls.id][day][p1] = s2.subjectId; s2.period = p1; }
                
                const newScore = getGlobalScore();
                if (newScore < oldScore) {
                  madeChanges = true;
                  break;
                } else {
                  if (s1 && t1Id && teacherSchedule[t1Id]) { delete teacherSchedule[t1Id][day][p2]; }
                  if (s1) { delete classSchedule[cls.id][day][p2]; }
                  
                  if (s2 && t2Id && teacherSchedule[t2Id]) { delete teacherSchedule[t2Id][day][p1]; }
                  if (s2) { delete classSchedule[cls.id][day][p1]; }
                  
                  if (s1 && t1Id && teacherSchedule[t1Id]) { teacherSchedule[t1Id][day][p1] = cls.id; }
                  if (s1) { classSchedule[cls.id][day][p1] = s1.subjectId; s1.period = p1; }
                  
                  if (s2 && t2Id && teacherSchedule[t2Id]) { teacherSchedule[t2Id][day][p2] = cls.id; }
                  if (s2) { classSchedule[cls.id][day][p2] = s2.subjectId; s2.period = p2; }
                }
              }
            }
            if (madeChanges) break;
          }
        }
      }
    }
  }

  return { slots, unassigned };
}
