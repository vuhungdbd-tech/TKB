import React, { useState, useEffect, useCallback } from 'react';
import { initialClasses, initialSubjects, initialTeachers, initialConfig } from './data';
import { Class, Subject, Teacher, Config, TimetableSlot } from './types';
import { generateTimetable, LessonToSchedule } from './algorithm';
import ConfigTab from './components/ConfigTab';
import ResultTab from './components/ResultTab';
import LicenseManager from './components/LicenseManager';
import Login from './components/Login';
import { Layout, Settings, Calendar, Save, RotateCcw, Play, School, Cloud, CloudOff, Loader2, LogOut, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'result' | 'license'>('config');
  const [classes, setClasses] = useState<Class[]>(initialClasses);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [config, setConfig] = useState<Config>(initialConfig);
  
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [weeklyTimetables, setWeeklyTimetables] = useState<Record<number, { timetable: TimetableSlot[], unassigned: any[] }>>({});
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch((e) => {
      console.error('Failed to get session:', e);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [licenseInfo, setLicenseInfo] = useState<any>(null);

  useEffect(() => {
    if (!supabase || !session) return;

    const fetchLicense = async () => {
      try {
        const { data, error } = await supabase
          .from('licenses')
          .select('*')
          .eq('used_by_email', session.user.email)
          .single();
        
        if (!error && data) {
          setLicenseInfo(data);
        }
      } catch (e) {
        console.error('Failed to fetch license:', e);
      }
    };

    fetchLicense();
  }, [session]);

  const loadData = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    
    if (!supabase) {
      setSyncStatus('offline');
      const savedData = localStorage.getItem('timetableData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.classes) setClasses(parsed.classes);
          if (parsed.subjects) setSubjects(parsed.subjects);
          if (parsed.teachers) setTeachers(parsed.teachers);
          if (parsed.config) setConfig({ ...initialConfig, ...parsed.config });
          if (parsed.weeklyTimetables) {
            setWeeklyTimetables(parsed.weeklyTimetables);
          } else if (parsed.timetable) {
            setWeeklyTimetables({ 1: { timetable: parsed.timetable, unassigned: parsed.unassigned || [] } });
          }
          if (parsed.currentWeek) setCurrentWeek(parsed.currentWeek);
        } catch (e) {
          console.error('Failed to parse saved data', e);
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('data')
        .eq('id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found, use initial data
          setSyncStatus('synced');
        } else {
          console.error('Supabase load error:', error);
          setSyncStatus('error');
          // Fallback to localStorage
          const savedData = localStorage.getItem('timetableData');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.classes) setClasses(parsed.classes);
            if (parsed.subjects) setSubjects(parsed.subjects);
            if (parsed.teachers) setTeachers(parsed.teachers);
            if (parsed.config) setConfig({ ...initialConfig, ...parsed.config });
            if (parsed.weeklyTimetables) {
              setWeeklyTimetables(parsed.weeklyTimetables);
            } else if (parsed.timetable) {
              setWeeklyTimetables({ 1: { timetable: parsed.timetable, unassigned: parsed.unassigned || [] } });
            }
            if (parsed.currentWeek) setCurrentWeek(parsed.currentWeek);
          }
        }
      } else if (data?.data) {
        const parsed = data.data;
        if (parsed.classes) setClasses(parsed.classes);
        if (parsed.subjects) setSubjects(parsed.subjects);
        if (parsed.teachers) setTeachers(parsed.teachers);
        if (parsed.config) setConfig({ ...initialConfig, ...parsed.config });
        if (parsed.weeklyTimetables) {
          setWeeklyTimetables(parsed.weeklyTimetables);
        } else if (parsed.timetable) {
          setWeeklyTimetables({ 1: { timetable: parsed.timetable, unassigned: parsed.unassigned || [] } });
        }
        if (parsed.currentWeek) setCurrentWeek(parsed.currentWeek);
        setSyncStatus('synced');
      }
    } catch (e) {
      console.error('Failed to load data from Supabase', e);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [session, loadData]);

  const handleSave = async () => {
    const dataToSave = { classes, subjects, teachers, config, weeklyTimetables, currentWeek };
    
    // Save to localStorage as backup
    localStorage.setItem('timetableData', JSON.stringify(dataToSave));

    if (!supabase || !session) {
      setSyncStatus('offline');
      alert('Dữ liệu đã được lưu vào trình duyệt (Supabase chưa được cấu hình hoặc chưa đăng nhập).');
      return;
    }

    setSyncStatus('syncing');
    try {
      const { error } = await supabase
        .from('app_data')
        .upsert({ id: session.user.id, data: dataToSave });

      if (error) {
        console.error('Supabase save error:', error);
        setSyncStatus('error');
        alert('Lỗi khi lưu dữ liệu lên Supabase. Dữ liệu đã được lưu tạm vào trình duyệt.');
      } else {
        setSyncStatus('synced');
        alert('Dữ liệu đã được đồng bộ với Supabase!');
      }
    } catch (e) {
      console.error('Failed to save data to Supabase', e);
      setSyncStatus('error');
    }
  };

  const handleGenerate = () => {
    const { slots, unassigned } = generateTimetable(classes, subjects, teachers, config);
    setWeeklyTimetables(prev => ({
      ...prev,
      [currentWeek]: { timetable: slots, unassigned }
    }));
    setActiveTab('result');
  };

  const handleReset = async () => {
    if (window.confirm('Bạn có chắc chắn muốn reset toàn bộ dữ liệu về mặc định?')) {
      setClasses(initialClasses);
      setSubjects(initialSubjects);
      setTeachers(initialTeachers);
      setConfig(initialConfig);
      setWeeklyTimetables({});
      setCurrentWeek(1);
      localStorage.removeItem('timetableData');
      
      if (!supabase || !session) {
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('syncing');
      try {
        await supabase
          .from('app_data')
          .delete()
          .eq('id', session.user.id);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to reset Supabase data', e);
        setSyncStatus('error');
      }
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const isAdmin = session?.user?.email === 'vuhung@db.edu.vn';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold text-text-main">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-page-bg text-text-main font-sans selection:bg-brand-100 selection:text-brand-900">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-border-soft no-print">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="group flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('config')}>
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <School className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-text-main leading-none">{config.appName}</h1>
                {isAdmin ? (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-tighter">
                    Admin Tối Cao
                  </span>
                ) : licenseInfo && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${
                      licenseInfo.type === 'trial' 
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                        : 'bg-brand-100 text-brand-700 border-brand-200'
                    }`}>
                      {licenseInfo.type === 'trial' ? 'Dùng thử (1 tháng)' : 'Bản quyền (1 năm)'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Hết hạn: {new Date(new Date(licenseInfo.used_at).setMonth(new Date(licenseInfo.used_at).getMonth() + (licenseInfo.type === 'trial' ? 1 : 12))).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                )}
                <Settings className="w-5 h-5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm font-black text-text-muted uppercase tracking-[0.2em]">{config.appSubtitle}</p>
                <div className="w-1 h-1 bg-stone-300 rounded-full" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
                    Chào, {session.user.user_metadata?.full_name || session.user.email}
                  </span>
                  <div className="w-1 h-1 bg-stone-300 rounded-full" />
                  {syncStatus === 'synced' && <Cloud className="w-3.5 h-3.5 text-emerald-500" />}
                  {syncStatus === 'syncing' && <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />}
                  {syncStatus === 'error' && <CloudOff className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    syncStatus === 'synced' ? 'text-emerald-600' : 
                    syncStatus === 'syncing' ? 'text-brand-600' : 'text-rose-600'
                  }`}>
                    {syncStatus === 'synced' ? 'Đã đồng bộ' : 
                     syncStatus === 'syncing' ? 'Đang lưu...' : 'Lỗi đồng bộ'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 no-print">
              <span className="text-xs font-bold text-slate-500 pl-3">Tuần</span>
              <select 
                value={currentWeek}
                onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-brand-700 outline-none"
              >
                {Array.from({ length: 52 }).map((_, i) => (
                  <option key={i+1} value={i+1}>Tuần {i+1}</option>
                ))}
              </select>
            </div>
            <button onClick={handleSave} className="btn-secondary flex items-center gap-2 py-3 px-6">
              <Save className="w-6 h-6" />
              <span className="hidden sm:inline">Lưu & Đồng bộ</span>
            </button>
            <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 py-3 px-6 text-text-muted border-transparent hover:text-rose-600 hover:bg-rose-50">
              <LogOut className="w-6 h-6" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
            <div className="w-px h-10 bg-stone-200 mx-2" />
            <button onClick={handleGenerate} className="btn-primary flex items-center gap-2 py-3 px-8 shadow-brand-500/25">
              <Play className="w-6 h-6 fill-current" />
              <span>Tạo TKB</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-8 p-1 bg-slate-200/50 rounded-xl w-fit no-print">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'config' 
                ? 'bg-white text-brand-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Settings className={`w-4 h-4 ${activeTab === 'config' ? 'text-brand-600' : 'text-slate-400'}`} />
            Cấu hình hệ thống
          </button>
          <button
            onClick={() => setActiveTab('result')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'result' 
                ? 'bg-white text-brand-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Calendar className={`w-4 h-4 ${activeTab === 'result' ? 'text-brand-600' : 'text-slate-400'}`} />
            Kết quả xếp lịch
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('license')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'license' 
                  ? 'bg-white text-brand-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Key className={`w-4 h-4 ${activeTab === 'license' ? 'text-brand-600' : 'text-slate-400'}`} />
              Quản lý bản quyền
            </button>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeTab === 'config' ? (
              <ConfigTab 
                classes={classes} 
                setClasses={setClasses} 
                subjects={subjects} 
                setSubjects={setSubjects} 
                teachers={teachers} 
                setTeachers={setTeachers} 
                config={config} 
                setConfig={setConfig} 
              />
            ) : activeTab === 'result' ? (
              <ResultTab 
                timetable={weeklyTimetables[currentWeek]?.timetable || []} 
                unassigned={weeklyTimetables[currentWeek]?.unassigned || []} 
                classes={classes} 
                subjects={subjects} 
                teachers={teachers} 
                config={config} 
              />
            ) : (
              <LicenseManager />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-slate-200 text-center no-print">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
          © 2026 SmartSchedule Pro • Giải pháp xếp thời khóa biểu thông minh
        </p>
      </footer>
    </div>
  );
}
