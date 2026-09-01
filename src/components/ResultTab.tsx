import React, { useState } from 'react';
import { Class, Subject, Teacher, Config, TimetableSlot } from '../types';
import { LessonToSchedule } from '../algorithm';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  Download, 
  Printer, 
  AlertTriangle, 
  LayoutGrid, 
  User, 
  Users, 
  Sun, 
  Moon,
  ChevronDown,
  Search,
  FileSpreadsheet
} from 'lucide-react';

interface Props {
  timetable: TimetableSlot[];
  unassigned: LessonToSchedule[];
  classes: Class[];
  subjects: Subject[];
  teachers: Teacher[];
  config: Config;
}

export default function ResultTab({ timetable, unassigned, classes, subjects, teachers, config }: Props) {
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'master_morning' | 'master_afternoon'>('master_morning');
  const [selectedId, setSelectedId] = useState<string>(classes[0]?.id || '');

  const totalPeriods = config.morningLessons + config.afternoonLessons;
  const days = Array.from({ length: config.days }, (_, i) => i);
  const periods = Array.from({ length: totalPeriods }, (_, i) => i);

  const getSlot = (day: number, period: number) => {
    if (viewMode === 'class') {
      return timetable.find(s => s.classId === selectedId && s.day === day && s.period === period);
    } else {
      return timetable.find(s => s.teacherId === selectedId && s.day === day && s.period === period);
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const fontName = 'Times New Roman';
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    const createMasterSheet = (isMorning: boolean) => {
      const sheetName = isMorning ? "TKB Sáng" : "TKB Chiều";
      const worksheet = workbook.addWorksheet(sheetName);
      const periodsCount = isMorning ? config.morningLessons : config.afternoonLessons;
      const startPeriod = isMorning ? 0 : config.morningLessons;
      
      worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
        horizontalCentered: true,
        verticalCentered: true
      };

      const titleRow = worksheet.addRow([`THỜI KHÓA BIỂU TOÀN TRƯỜNG - BUỔI ${isMorning ? 'SÁNG' : 'CHIỀU'}`]);
      titleRow.font = { name: fontName, size: 22, bold: true };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 45;
      worksheet.mergeCells(1, 1, 1, classes.length + 2);

      const schoolRow = worksheet.addRow([config.schoolName]);
      schoolRow.font = { name: fontName, size: 14, bold: true };
      
      const yearRow = worksheet.addRow([`Năm học: ${config.schoolYear}`]);
      yearRow.font = { name: fontName, size: 14, italic: true };
      
      const dateRow = worksheet.addRow([`Ngày thực hiện: ${config.executionDate}`]);
      dateRow.font = { name: fontName, size: 12 };
      
      worksheet.addRow([]);

      const headerRow = worksheet.addRow(['Thứ', 'Tiết', ...classes.map(c => c.name)]);
      headerRow.height = 35;
      headerRow.eachCell((cell) => {
        cell.font = { name: fontName, size: 13, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      });

      days.forEach((dayIndex) => {
        const startRow = worksheet.rowCount + 1;
        for (let p = 0; p < periodsCount; p++) {
          const actualPeriod = startPeriod + p;
          const rowData = [
            p === 0 ? `Thứ ${dayIndex + 2}` : '',
            p + 1,
            ...classes.map(c => {
              const slot = timetable.find(s => s.classId === c.id && s.day === dayIndex && s.period === actualPeriod);
              if (!slot) return '';
              const sub = subjects.find(s => s.id === slot.subjectId)?.name;
              const tea = teachers.find(t => t.id === slot.teacherId)?.name;
              return {
                text: slot.isExam ? `[KT] ${sub}\n(${tea})` : `${sub}\n(${tea})`,
                isExam: slot.isExam
              };
            })
          ];
          const row = worksheet.addRow(rowData.map(d => typeof d === 'object' ? d.text : d));
          row.height = 55; // Increased height for better legibility
          row.eachCell((cell, colNumber) => {
            cell.font = { name: fontName, size: 12 }; // Increased font size
            if (colNumber > 2) {
              const cellData = rowData[colNumber - 1];
              if (typeof cellData === 'object' && cellData.isExam) {
                cell.font = { name: fontName, size: 12, bold: true, color: { argb: 'FFFF0000' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
              }
            }
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = borderStyle;
          });
        }
        worksheet.mergeCells(startRow, 1, startRow + periodsCount - 1, 1);
      });

      worksheet.getColumn(1).width = 10;
      worksheet.getColumn(2).width = 6;
      // Calculate dynamic width to fill the page better
      const classColWidth = Math.max(18, Math.floor(200 / (classes.length || 1)));
      for (let i = 0; i < classes.length; i++) {
        worksheet.getColumn(i + 3).width = classColWidth;
      }
    };

    createMasterSheet(true);
    createMasterSheet(false);

    const rawSheet = workbook.addWorksheet('Dữ liệu chi tiết');
    rawSheet.columns = [
      { header: 'Lớp', key: 'class', width: 10 },
      { header: 'Thứ', key: 'day', width: 10 },
      { header: 'Tiết', key: 'period', width: 10 },
      { header: 'Buổi', key: 'session', width: 10 },
      { header: 'Môn học', key: 'subject', width: 20 },
      { header: 'Giáo viên', key: 'teacher', width: 20 },
    ];

    timetable.forEach(slot => {
      rawSheet.addRow({
        class: classes.find(c => c.id === slot.classId)?.name,
        day: `Thứ ${slot.day + 2}`,
        period: slot.period + 1,
        session: slot.period < config.morningLessons ? 'Sáng' : 'Chiều',
        subject: subjects.find(s => s.id === slot.subjectId)?.name,
        teacher: teachers.find(t => t.id === slot.teacherId)?.name || ''
      }).eachCell(cell => {
        cell.font = { name: fontName };
        cell.border = borderStyle;
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `TKB_${config.schoolName.replace(/\s+/g, '_')}.xlsx`);
  };

  const renderMasterTable = (isMorning: boolean) => {
    const periodsCount = isMorning ? config.morningLessons : config.afternoonLessons;
    const startPeriod = isMorning ? 0 : config.morningLessons;
    
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <div className="flex justify-between items-start mb-10 no-print">
          <div className="space-y-2">
            <h3 className="font-black text-text-main text-xl">{config.schoolName}</h3>
            <p className="text-base text-text-muted font-black uppercase tracking-[0.2em]">Năm học: {config.schoolYear}</p>
          </div>
          <div className="text-right">
            <p className="text-base text-stone-400 font-black uppercase tracking-widest">Ngày thực hiện: {config.executionDate}</p>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-text-main uppercase tracking-tight">
            Thời khoá biểu toàn trường
            <span className="block text-base font-bold text-brand-600 mt-3 tracking-[0.3em]">
              Buổi {isMorning ? 'Sáng' : 'Chiều'}
            </span>
          </h2>
        </div>

        <table className="w-full border-collapse border-2 border-stone-900">
          <thead>
            <tr className="bg-stone-900 text-white">
              <th className="border border-stone-700 px-3 py-5 w-16 text-sm font-black uppercase tracking-widest">Thứ</th>
              <th className="border border-stone-700 px-3 py-5 w-12 text-sm font-black uppercase tracking-widest">Tiết</th>
              {classes.map(c => (
                <th key={c.id} className="border border-stone-700 px-4 py-5 text-sm font-black uppercase tracking-widest min-w-[140px]">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(dayIndex => (
              <React.Fragment key={dayIndex}>
                {Array.from({ length: periodsCount }).map((_, pIndex) => {
                  const actualPeriod = startPeriod + pIndex;
                  return (
                    <tr key={`${dayIndex}-${pIndex}`} className="group hover:bg-stone-50 transition-colors">
                      {pIndex === 0 && (
                        <td 
                          rowSpan={periodsCount} 
                          className="border-2 border-stone-900 px-3 py-4 text-center font-black text-3xl text-text-main bg-stone-50/50"
                        >
                          {dayIndex + 2}
                        </td>
                      )}
                      <td className="border border-border-soft px-3 py-4 text-center font-mono font-bold text-text-muted/60 text-base">
                        {pIndex + 1}
                      </td>
                      {classes.map(c => {
                        const slot = timetable.find(s => s.classId === c.id && s.day === dayIndex && s.period === actualPeriod);
                        const sub = slot ? subjects.find(s => s.id === slot.subjectId) : null;
                        const teacher = slot ? teachers.find(t => t.id === slot.teacherId) : null;
                        
                        const isSchoolOff = config.timeOff?.some(off => off.day === dayIndex && (off.session === 'all' || off.session === (isMorning ? 'morning' : 'afternoon')));

                        let cellStyle = "bg-white";
                        if (isSchoolOff) cellStyle = "bg-stone-100/50";
                        else if (slot?.isExam) cellStyle = "bg-amber-50 border-amber-200";
                        else if (sub?.type === 'main') cellStyle = "bg-brand-50/30";

                        return (
                          <td key={c.id} className={`border border-border-soft px-3 py-3 text-center h-24 transition-all ${cellStyle}`}>
                            {slot ? (
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <span className={`text-[15px] font-bold leading-tight ${slot.isExam ? 'text-rose-600' : 'text-text-main'}`}>
                                  {slot.isExam ? `[KT] ${sub?.name}` : sub?.name}
                                </span>
                                <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
                                  {teacher?.name.split(' ').pop()}
                                </span>
                              </div>
                            ) : isSchoolOff ? (
                               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Nghỉ</span>
                            ) : (
                              <div className="w-1.5 h-1.5 bg-stone-200 rounded-full mx-auto"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Controls Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <select 
              value={viewMode} 
              onChange={(e) => {
                setViewMode(e.target.value as any);
                if (e.target.value === 'class') setSelectedId(classes[0]?.id || '');
                if (e.target.value === 'teacher') setSelectedId(teachers[0]?.id || '');
              }}
              className="input-field pl-10 pr-10 appearance-none font-semibold text-slate-700 min-w-[220px]"
            >
              <option value="master_morning">Toàn trường (Sáng)</option>
              <option value="master_afternoon">Toàn trường (Chiều)</option>
              <option value="class">Xem theo lớp</option>
              <option value="teacher">Xem theo giáo viên</option>
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {viewMode.startsWith('master') ? <LayoutGrid className="w-4 h-4" /> : viewMode === 'class' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          
          {(viewMode === 'class' || viewMode === 'teacher') && (
            <div className="relative flex-grow md:flex-grow-0">
              <select 
                value={selectedId} 
                onChange={(e) => setSelectedId(e.target.value)}
                className="input-field pl-10 pr-10 appearance-none font-semibold text-slate-700 min-w-[200px]"
              >
                {viewMode === 'class' 
                  ? classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                  : teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                }
              </select>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={() => window.print()} className="btn-secondary flex-grow md:flex-grow-0 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" />
            In TKB
          </button>
          <button onClick={exportToExcel} className="btn-primary flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20">
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Warnings */}
      {unassigned.length > 0 && (
        <div className="space-y-4 no-print">
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-rose-900">Cảnh báo xếp lịch</h4>
              <p className="text-sm text-rose-700 mt-1">Hệ thống chưa thể xếp lịch cho {unassigned.length} tiết học do các ràng buộc quá chặt chẽ. Vui lòng kiểm tra lại phân công giáo viên hoặc nới lỏng cấu hình thời gian.</p>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-text-main flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Danh sách tiết chưa xếp được
              </h3>
              <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                {unassigned.length} tiết
              </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-stone-50 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200">Lớp</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200">Môn học</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200">Giáo viên</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-200">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {unassigned.map((item, idx) => {
                    const cls = classes.find(c => c.id === item.classId);
                    const sub = subjects.find(s => s.id === item.subjectId);
                    const teacher = teachers.find(t => t.id === item.teacherId);
                    return (
                      <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-bold text-text-main">{cls?.name}</td>
                        <td className="px-6 py-3 text-sm text-text-muted">{sub?.name}</td>
                        <td className="px-6 py-3 text-sm text-text-muted">{teacher?.name || 'Chưa phân công'}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-md uppercase border border-rose-100">
                            {item.reason || 'Không rõ nguyên nhân'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Content */}
      <div className="print:m-0">
        {viewMode === 'master_morning' && renderMasterTable(true)}
        {viewMode === 'master_afternoon' && renderMasterTable(false)}

        {(viewMode === 'class' || viewMode === 'teacher') && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-border-soft overflow-x-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-black text-text-main uppercase tracking-tight">
                Thời khoá biểu cá nhân
                <span className="block text-base font-bold text-brand-600 mt-3 tracking-[0.3em]">
                  {viewMode === 'class' ? `Lớp: ${classes.find(c => c.id === selectedId)?.name}` : `Giáo viên: ${teachers.find(t => t.id === selectedId)?.name}`}
                </span>
              </h2>
            </div>

            <table className="w-full border-collapse border-2 border-stone-900">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="border border-stone-700 px-4 py-5 w-36 text-sm font-black uppercase tracking-widest">Tiết \ Thứ</th>
                  {days.map(d => (
                    <th key={d} className="border border-stone-700 px-4 py-5 text-sm font-black uppercase tracking-widest">Thứ {d + 2}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(p => {
                  const isMorning = p < config.morningLessons;
                  const periodInSession = isMorning ? p + 1 : p - config.morningLessons + 1;
                  
                  return (
                    <tr key={p} className={`group ${p === config.morningLessons ? "border-t-4 border-stone-900" : ""}`}>
                      <td className="border border-border-soft px-4 py-5 bg-stone-50/50">
                        <div className="flex items-center gap-2">
                          {isMorning ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                          <span className="text-sm font-black text-text-main uppercase tracking-wider">Tiết {periodInSession}</span>
                        </div>
                      </td>
                      {days.map(d => {
                        const slot = getSlot(d, p);
                        const sub = slot ? subjects.find(s => s.id === slot.subjectId) : null;
                        const teacher = slot ? teachers.find(t => t.id === slot.teacherId) : null;
                        const cls = slot ? classes.find(c => c.id === slot.classId) : null;
                        
                        let cellStyle = "bg-white";
                        if (slot?.isExam) cellStyle = "bg-amber-50 border-amber-200";
                        else if (sub?.type === 'main') cellStyle = "bg-brand-50/30";

                        return (
                          <td key={d} className={`border border-border-soft px-4 py-5 text-center h-28 transition-all group-hover:bg-stone-50/30 ${cellStyle}`}>
                            {slot ? (
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span className={`text-base font-bold leading-tight ${slot.isExam ? 'text-rose-600 underline decoration-2 underline-offset-4' : 'text-text-main'}`}>
                                  {slot.isExam ? `[KT] ${sub?.name}` : sub?.name}
                                </span>
                                <span className="px-3 py-1 bg-stone-100 text-text-muted rounded-md text-[12px] font-black uppercase tracking-widest">
                                  {viewMode === 'class' ? teacher?.name : cls?.name}
                                </span>
                              </div>
                            ) : (
                              <div className="w-2 h-2 bg-stone-100 rounded-full mx-auto"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
