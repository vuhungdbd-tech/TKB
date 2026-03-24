import React, { useState } from 'react';
import { Class, Subject, Teacher, Config } from '../types';
import { 
  BookOpen, 
  Users, 
  UserCheck, 
  Clock, 
  FileText, 
  Settings,
  Plus, 
  Trash2, 
  Check, 
  X,
  RotateCcw,
  Info,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  ChevronRight
} from 'lucide-react';

interface Props {
  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export default function ConfigTab({ classes, setClasses, subjects, setSubjects, teachers, setTeachers, config, setConfig }: Props) {
  const [subTab, setSubTab] = useState<'classes' | 'subjects' | 'teachers' | 'time' | 'exams'>('classes');

  const tabs = [
    { id: 'classes', label: 'Lớp học', icon: Users },
    { id: 'subjects', label: 'Môn học', icon: BookOpen },
    { id: 'teachers', label: 'Giáo viên', icon: UserCheck },
    { id: 'time', label: 'Thời gian', icon: Clock },
    { id: 'exams', label: 'Kiểm tra', icon: FileText },
  ] as const;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="lg:w-64 flex-shrink-0 no-print">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center justify-between px-5 py-4 rounded-xl text-base font-bold transition-all whitespace-nowrap group ${
                subTab === tab.id
                  ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200'
                  : 'text-text-muted hover:bg-stone-100 hover:text-text-main'
              }`}
            >
              <div className="flex items-center gap-4">
                <tab.icon className={`w-6 h-6 ${subTab === tab.id ? 'text-brand-600' : 'text-stone-400 group-hover:text-text-muted'}`} />
                {tab.label}
              </div>
              {subTab === tab.id && <ChevronRight className="w-5 h-5 hidden lg:block" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow">
        <div className="glass-card p-6 min-h-[600px] shadow-xl shadow-stone-200/50">
          {subTab === 'classes' && <ClassConfig classes={classes} setClasses={setClasses} config={config} setConfig={setConfig} />}
          {subTab === 'subjects' && <SubjectConfig subjects={subjects} setSubjects={setSubjects} />}
          {subTab === 'teachers' && <TeacherConfig teachers={teachers} setTeachers={setTeachers} subjects={subjects} classes={classes} />}
          {subTab === 'time' && <TimeConfig config={config} setConfig={setConfig} />}
          {subTab === 'exams' && <ExamConfigUI config={config} setConfig={setConfig} subjects={subjects} />}
        </div>
      </div>
    </div>
  );
}

function SubjectConfig({ subjects, setSubjects }: { subjects: Subject[], setSubjects: any }) {
  const handleAddSubject = () => {
    const newId = `s${Date.now()}`;
    setSubjects([...subjects, {
      id: newId,
      name: 'Môn mới',
      lessonsPerWeek: 1,
      type: 'sub',
      allowDouble: false,
      session: 'all',
      hasExam: false
    }]);
  };

  const handleDeleteSubject = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa môn học này?')) {
      setSubjects(subjects.filter((s: Subject) => s.id !== id));
    }
  };

  const updateSubject = (idx: number, field: keyof Subject, value: any) => {
    const newSubs = [...subjects];
    (newSubs[idx] as any)[field] = value;
    setSubjects(newSubs);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-main">Danh mục môn học</h2>
          <p className="text-base text-text-muted mt-1.5">Quản lý danh sách môn học và định mức tiết dạy</p>
        </div>
        <button onClick={handleAddSubject} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm môn học
        </button>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên môn</th>
              <th>Số tiết/tuần</th>
              <th>Loại môn</th>
              <th>Tiết đôi</th>
              <th>Buổi học</th>
              <th>Kiểm tra</th>
              <th>Số tiết KT</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, idx) => (
              <tr key={sub.id}>
                <td>
                  <input 
                    value={sub.name || ''} 
                    onChange={(e) => updateSubject(idx, 'name', e.target.value)} 
                    className="bg-transparent font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded px-1 -ml-1 w-full" 
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    min="1" 
                    value={sub.lessonsPerWeek || 0} 
                    onChange={(e) => updateSubject(idx, 'lessonsPerWeek', parseInt(e.target.value) || 1)} 
                    className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono" 
                  />
                </td>
                <td>
                  <select 
                    value={sub.type || 'sub'} 
                    onChange={(e) => updateSubject(idx, 'type', e.target.value)} 
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold"
                  >
                    <option value="main">Môn chính</option>
                    <option value="integrated">Tích hợp</option>
                    <option value="sub">Môn phụ</option>
                  </select>
                </td>
                <td>
                  <input 
                    type="checkbox" 
                    checked={sub.allowDouble || false} 
                    onChange={(e) => updateSubject(idx, 'allowDouble', e.target.checked)} 
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" 
                  />
                </td>
                <td>
                  <select 
                    value={sub.session || 'all'} 
                    onChange={(e) => updateSubject(idx, 'session', e.target.value)} 
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                  >
                    <option value="all">Cả ngày</option>
                    <option value="morning">Sáng</option>
                    <option value="afternoon">Chiều</option>
                  </select>
                </td>
                <td>
                  <input 
                    type="checkbox" 
                    checked={sub.hasExam || false} 
                    onChange={(e) => {
                      const newSubs = [...subjects];
                      newSubs[idx].hasExam = e.target.checked;
                      if (e.target.checked) newSubs[idx].examDuration = newSubs[idx].examDuration || 1;
                      setSubjects(newSubs);
                    }} 
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" 
                  />
                </td>
                <td>
                  <select 
                    value={sub.examDuration || 1} 
                    disabled={!sub.hasExam}
                    onChange={(e) => updateSubject(idx, 'examDuration', parseInt(e.target.value))} 
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs disabled:opacity-30"
                  >
                    <option value={1}>1 tiết</option>
                    <option value={2}>2 tiết</option>
                  </select>
                </td>
                <td className="text-right">
                  <button onClick={() => handleDeleteSubject(sub.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeacherConfig({ teachers, setTeachers, subjects, classes }: { teachers: Teacher[], setTeachers: any, subjects: Subject[], classes: Class[] }) {
  const handleAddTeacher = () => {
    const newId = `t${Date.now()}`;
    setTeachers([...teachers, {
      id: newId,
      name: 'Giáo viên mới',
      specialization: '',
      assignments: [{ subjectId: subjects[0] ? subjects[0].id : '', classIds: [] }],
      maxLessonsPerWeek: 20,
      maxLessonsPerSession: 4,
      maxConsecutive: 3
    }]);
  };

  const handleDeleteTeacher = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa giáo viên này?')) {
      setTeachers(teachers.filter((t: Teacher) => t.id !== id));
    }
  };

  const updateTeacher = (idx: number, field: keyof Teacher, value: any) => {
    const newT = [...teachers];
    (newT[idx] as any)[field] = value;
    setTeachers(newT);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-main">Đội ngũ giáo viên</h2>
          <p className="text-base text-text-muted mt-1.5">Quản lý định mức và phân công giảng dạy</p>
        </div>
        <button onClick={handleAddTeacher} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm giáo viên
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {teachers.map((t, idx) => (
          <div key={t.id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-300 transition-all group">
            <div className="flex flex-col xl:flex-row gap-6">
              {/* Basic Info */}
              <div className="xl:w-1/4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                      {t.name.split(' ').pop()?.charAt(0)}
                    </div>
                    <div className="flex-grow">
                      <input 
                        value={t.name || ''} 
                        onChange={(e) => updateTeacher(idx, 'name', e.target.value)} 
                        className="block w-full font-bold text-slate-900 bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded px-1 -ml-1" 
                      />
                      <input 
                        value={t.specialization || ''} 
                        onChange={(e) => updateTeacher(idx, 'specialization', e.target.value)} 
                        placeholder="Chuyên môn..." 
                        className="block w-full text-xs font-bold text-slate-400 uppercase tracking-widest bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded px-1 -ml-1 mt-1" 
                      />
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTeacher(t.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max tiết/tuần</label>
                    <input 
                      type="number" 
                      value={t.maxLessonsPerWeek} 
                      onChange={(e) => updateTeacher(idx, 'maxLessonsPerWeek', parseInt(e.target.value) || 0)} 
                      className="w-full bg-transparent font-mono font-bold text-slate-700 focus:outline-none" 
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max tiết/buổi</label>
                    <input 
                      type="number" 
                      value={t.maxLessonsPerSession} 
                      onChange={(e) => updateTeacher(idx, 'maxLessonsPerSession', parseInt(e.target.value) || 0)} 
                      className="w-full bg-transparent font-mono font-bold text-slate-700 focus:outline-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Assignments */}
              <div className="xl:flex-grow">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-brand-500" />
                    Phân công giảng dạy
                  </h4>
                  <button 
                    onClick={() => {
                      const newT = [...teachers];
                      newT[idx].assignments.push({ subjectId: subjects[0]?.id || '', classIds: [] });
                      setTeachers(newT);
                    }}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Thêm môn
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {t.assignments.map((assignment, aIdx) => (
                    <div key={aIdx} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl relative group/item">
                      <button 
                        onClick={() => {
                          const newT = [...teachers];
                          newT[idx].assignments.splice(aIdx, 1);
                          setTeachers(newT);
                        }}
                        className="absolute top-2 right-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover/item:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      <div className="mb-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Môn học</label>
                        <select 
                          value={assignment.subjectId || ''}
                          onChange={(e) => {
                            const newT = [...teachers];
                            newT[idx].assignments[aIdx].subjectId = e.target.value;
                            setTeachers(newT);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/20 outline-none"
                        >
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lớp phụ trách</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {classes.map(c => {
                            const isSelected = assignment.classIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                onClick={() => {
                                  const newT = [...teachers];
                                  if (isSelected) {
                                    newT[idx].assignments[aIdx].classIds = newT[idx].assignments[aIdx].classIds.filter(id => id !== c.id);
                                  } else {
                                    newT[idx].assignments[aIdx].classIds.push(c.id);
                                  }
                                  setTeachers(newT);
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-brand-600 border-brand-600 text-white shadow-sm' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600'
                                }`}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassConfig({ classes, setClasses, config, setConfig }: { classes: Class[], setClasses: any, config: Config, setConfig: any }) {
  const gradeCounts = config.gradeCounts || { 6: 2, 7: 2, 8: 2, 9: 2 };
  const gradePrefixes = config.gradePrefixes || { 6: 'A', 7: 'B', 8: 'C', 9: 'D' };

  const generateClasses = () => {
    const newClasses: Class[] = [];
    let idCounter = 1;
    [6, 7, 8, 9].forEach(grade => {
      const count = gradeCounts[grade as keyof typeof gradeCounts] || 0;
      const letter = gradePrefixes[grade as keyof typeof gradePrefixes] || '';
      for (let i = 1; i <= count; i++) {
        newClasses.push({ id: `c${idCounter++}`, name: `${grade}${letter}${i}`, grade });
      }
    });
    setClasses(newClasses);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-main">Cấu trúc lớp học</h2>
          <p className="text-base text-text-muted mt-1.5">Thiết lập số lượng lớp và quy tắc đặt tên</p>
        </div>
        <button onClick={generateClasses} className="btn-primary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Sinh danh sách lớp
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[6, 7, 8, 9].map(grade => (
          <div key={grade} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center font-bold text-xl">
                {grade}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khối lớp</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tiền tố tên lớp</label>
                <input
                  type="text"
                  className="input-field font-bold text-center"
                  value={gradePrefixes[grade as keyof typeof gradePrefixes] || ''}
                  onChange={(e) => setConfig({...config, gradePrefixes: {...gradePrefixes, [grade]: e.target.value}})}
                  placeholder="VD: A, B..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số lượng lớp</label>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                  <button 
                    onClick={() => setConfig({...config, gradeCounts: {...gradeCounts, [grade]: Math.max(0, (gradeCounts[grade as keyof typeof gradeCounts] || 0) - 1)}})}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-rose-600 transition-colors shadow-sm"
                  >-</button>
                  <span className="text-lg font-bold text-slate-700">{gradeCounts[grade as keyof typeof gradeCounts] || 0}</span>
                  <button 
                    onClick={() => setConfig({...config, gradeCounts: {...gradeCounts, [grade]: (gradeCounts[grade as keyof typeof gradeCounts] || 0) + 1}})}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-brand-600 transition-colors shadow-sm"
                  >+</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-600" />
          Danh sách lớp hiện tại ({classes.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {classes.map((cls, idx) => (
            <div key={cls.id} className="relative group">
              <input
                value={cls.name || ''}
                onChange={(e) => {
                  const newClasses = [...classes];
                  newClasses[idx].name = e.target.value;
                  setClasses(newClasses);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 text-center text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-400 text-white text-[8px] font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeConfig({ config, setConfig }: { config: Config, setConfig: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-main">Cấu hình thời gian</h2>
        <p className="text-base text-text-muted mt-1.5">Thiết lập khung giờ học và thông tin hiển thị</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-600" />
              Cấu hình ứng dụng
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên ứng dụng (Header)</label>
                <input 
                  type="text" 
                  value={config.appName || ''} 
                  onChange={(e) => setConfig({...config, appName: e.target.value})} 
                  className="input-field font-bold" 
                  placeholder="VD: SmartSchedule"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mô tả ứng dụng (Header)</label>
                <input 
                  type="text" 
                  value={config.appSubtitle || ''} 
                  onChange={(e) => setConfig({...config, appSubtitle: e.target.value})} 
                  className="input-field" 
                  placeholder="VD: HỆ THỐNG XẾP TKB THCS"
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <School className="w-5 h-5 text-brand-600" />
              Thông tin trường học
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên trường</label>
                <input 
                  type="text" 
                  value={config.schoolName || ''} 
                  onChange={(e) => setConfig({...config, schoolName: e.target.value})} 
                  className="input-field" 
                  placeholder="VD: Trường THCS Suối Lư"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Năm học</label>
                  <input 
                    type="text" 
                    value={config.schoolYear || ''} 
                    onChange={(e) => setConfig({...config, schoolYear: e.target.value})} 
                    className="input-field" 
                    placeholder="VD: 2025 - 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ngày thực hiện</label>
                  <input 
                    type="text" 
                    value={config.executionDate || ''} 
                    onChange={(e) => setConfig({...config, executionDate: e.target.value})} 
                    className="input-field" 
                    placeholder="VD: 23/03/2026"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-600" />
              Cấu hình tiết học
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số ngày học trong tuần</label>
                <div className="flex gap-2">
                  {[5, 6].map(d => (
                    <button
                      key={d}
                      onClick={() => setConfig({...config, days: d})}
                      className={`flex-grow py-2 rounded-xl text-sm font-bold transition-all border ${
                        config.days === d 
                          ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {d} ngày (Thứ 2 - Thứ {d + 1})
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số tiết sáng (Max 6)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="6" 
                    value={config.morningLessons || 0} 
                    onChange={(e) => setConfig({...config, morningLessons: parseInt(e.target.value) || 5})} 
                    className="input-field font-mono font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số tiết chiều (Max 6)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="6" 
                    value={config.afternoonLessons || 0} 
                    onChange={(e) => setConfig({...config, afternoonLessons: parseInt(e.target.value) || 0})} 
                    className="input-field font-mono font-bold" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-brand-950 rounded-3xl text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-brand-800 rounded-2xl flex items-center justify-center mb-6">
              <Info className="w-6 h-6 text-brand-300" />
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight">Hướng dẫn cấu hình</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-brand-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border border-brand-700">1</div>
                <p className="text-sm text-brand-200 leading-relaxed">Đảm bảo tổng số tiết của các môn học không vượt quá tổng số tiết trống trong tuần.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-brand-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border border-brand-700">2</div>
                <p className="text-sm text-brand-200 leading-relaxed">Môn học "Chỉ sáng" hoặc "Chỉ chiều" sẽ được hệ thống ưu tiên xếp đúng buổi.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-brand-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border border-brand-700">3</div>
                <p className="text-sm text-brand-200 leading-relaxed">Cấu hình "Tiết đôi" giúp các môn học quan trọng có thời gian giảng dạy liên tục.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 p-4 bg-brand-900/50 rounded-2xl border border-brand-800/50 relative z-10">
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em] mb-1">Trạng thái hệ thống</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-brand-100">Sẵn sàng tạo thời khóa biểu</span>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-800/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}

function ExamConfigUI({ config, setConfig, subjects }: { config: Config, setConfig: any, subjects: Subject[] }) {
  const updateExam = (grade: number, field: string, value: any) => {
    const newExams = (config.exams || []).map(e => {
      if (e.grade === grade) {
        return { ...e, [field]: value };
      }
      return e;
    });
    setConfig({ ...config, exams: newExams });
  };

  const examSubjects = subjects.filter(s => s.hasExam);

  const renderSubjectSelector = (grade: number, exam: any, term: string) => {
    const field = `${term}Subjects`;
    const selectedIds = (exam[field] as string[]) || [];
    const totalPeriods = subjects
      .filter(s => selectedIds.includes(s.id))
      .reduce((acc, s) => acc + (s.examDuration || 1), 0);

    return (
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {term === 'midTerm1' ? 'Giữa kì I' : term === 'finalTerm1' ? 'Cuối kì I' : term === 'midTerm2' ? 'Giữa kì II' : 'Cuối kì II'}
          </span>
          <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-bold">
            {totalPeriods} tiết
          </span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {examSubjects.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[10px] text-slate-400 italic">Chưa cấu hình môn KT</p>
            </div>
          ) : (
            examSubjects.map(sub => {
              const isSelected = selectedIds.includes(sub.id);
              return (
                <button 
                  key={sub.id}
                  onClick={() => {
                    const next = isSelected 
                      ? selectedIds.filter(id => id !== sub.id) 
                      : [...selectedIds, sub.id];
                    updateExam(grade, field, next);
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all ${
                    isSelected 
                      ? 'bg-brand-50 text-brand-700' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                    isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="truncate">{sub.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-text-main">Kiểm tra tập trung</h2>
          <p className="text-base text-text-muted mt-1.5">Cấu hình lịch thi đồng loạt cho toàn khối</p>
        </div>
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex items-center gap-4 min-w-[320px]">
          <div className="w-10 h-10 bg-brand-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="flex-grow">
            <label className="block text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Kỳ kiểm tra hiện tại</label>
            <select 
              value={config.currentExamTerm || 'none'} 
              onChange={(e) => setConfig({...config, currentExamTerm: e.target.value as any})}
              className="w-full bg-transparent font-bold text-slate-900 focus:outline-none text-sm"
            >
              <option value="none">Không có kiểm tra</option>
              <option value="midTerm1">Giữa học kỳ I</option>
              <option value="finalTerm1">Cuối học kỳ I</option>
              <option value="midTerm2">Giữa học kỳ II</option>
              <option value="finalTerm2">Cuối học kỳ II</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {[6, 7, 8, 9].map(grade => {
          const exam = (config.exams || []).find(e => e.grade === grade) || { grade };
          return (
            <div key={grade} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                  {grade}
                </div>
                <h3 className="text-lg font-bold text-slate-900">Khối lớp {grade}</h3>
                <div className="h-px bg-slate-200 flex-grow"></div>
                
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thứ:</span>
                    <select 
                      value={exam.preferredDay ?? ''} 
                      onChange={(e) => updateExam(grade, 'preferredDay', e.target.value === '' ? undefined : parseInt(e.target.value))}
                      className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="">Tự động</option>
                      {Array.from({ length: config.days || 6 }).map((_, i) => (
                        <option key={i} value={i}>Thứ {i + 2}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiết:</span>
                    <select 
                      value={exam.preferredPeriod ?? ''} 
                      onChange={(e) => updateExam(grade, 'preferredPeriod', e.target.value === '' ? undefined : parseInt(e.target.value))}
                      className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="">Tự động</option>
                      {Array.from({ length: (config.morningLessons || 5) + (config.afternoonLessons || 0) }).map((_, i) => (
                        <option key={i} value={i}>Tiết {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {renderSubjectSelector(grade, exam, 'midTerm1')}
                {renderSubjectSelector(grade, exam, 'finalTerm1')}
                {renderSubjectSelector(grade, exam, 'midTerm2')}
                {renderSubjectSelector(grade, exam, 'finalTerm2')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const School = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3 10 4.5V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.5L12 3Z"/><path d="M12 7v14"/><path d="M8 21v-8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8"/></svg>
);
