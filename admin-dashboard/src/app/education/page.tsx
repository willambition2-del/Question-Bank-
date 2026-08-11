"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { 
  Plus, 
  Trash2, 
  Layers, 
  Book,
  FolderOpen,
  FileText,
  ChevronLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from "lucide-react";
import api from "@/lib/axios";

export default function EducationPage() {
  const [selectedGrade, setSelectedGrade] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  const { data: gradesData, mutate: mutateGrades } = useSWR('/admin/grades?limit=50', url => api.get(url));
  const grades = gradesData?.data?.data || [];

  const { data: subjectsData, isLoading: isLoadingSubjects, mutate: mutateSubjects } = useSWR(
    selectedGrade ? `/admin/subjects?gradeId=${selectedGrade.id}&limit=50` : null, 
    url => api.get(url)
  );
  const subjects = subjectsData?.data?.data || [];

  const { data: unitsData, isLoading: isLoadingUnits, mutate: mutateUnits } = useSWR(
    selectedSubject ? `/admin/units?subjectId=${selectedSubject.id}&limit=50` : null, 
    url => api.get(url)
  );
  const units = unitsData?.data?.data || [];

  const { data: lessonsData, isLoading: isLoadingLessons, mutate: mutateLessons } = useSWR(
    selectedUnit ? `/admin/lessons?unitId=${selectedUnit.id}&limit=50` : null, 
    url => api.get(url)
  );
  const lessons = lessonsData?.data?.data || [];

  const handleDelete = async (endpoint: string, id: string, mutateFn: any, clearSelection?: () => void) => {
    if (!confirm("هل أنت متأكد من حذف هذا العنصر؟ لا يمكن حذفه إذا كان مرتبطاً ببيانات أخرى.")) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      if (clearSelection) clearSelection();
      mutateFn();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ أثناء الحذف");
    }
  };

  const toggleStatus = async (endpoint: string, id: string, currentStatus: boolean, mutateFn: any) => {
    const action = currentStatus ? "unpublish" : "publish";
    try {
      await api.post(`${endpoint}/${id}/${action}`);
      mutateFn();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ أثناء تغيير الحالة");
    }
  };

  const renderColumn = (
    title: string, 
    icon: any, 
    items: any[], 
    isLoading: boolean, 
    selectedItem: any, 
    onSelect: (item: any) => void, 
    endpoint: string, 
    mutateFn: any,
    clearSelection: () => void,
    placeholder: string
  ) => {
    const Icon = icon;
    return (
      <div className="flex-1 min-w-[250px] max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Icon className="w-5 h-5 text-indigo-600" />
            {title}
          </h2>
          <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">{placeholder}</p>
          ) : (
            items.map(item => (
              <div 
                key={item.id}
                onClick={() => onSelect(item)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-colors ${
                  selectedItem?.id === item.id 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900' 
                    : 'border-transparent hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex-1 truncate">
                  <div className="font-medium truncate pr-2">{item.name || item.title}</div>
                  <div className="flex gap-2 mt-1">
                    {item.isActive !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.isActive ? 'منشور' : 'مسودة'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.isActive !== undefined && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleStatus(endpoint, item.id, item.isActive, mutateFn); }}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(endpoint, item.id, mutateFn, selectedItem?.id === item.id ? clearSelection : undefined); }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronLeft className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 flex gap-4 overflow-x-auto h-screen items-start custom-scrollbar">
        
        {renderColumn(
          "الصفوف", Layers, grades, false, selectedGrade, 
          (g) => { setSelectedGrade(g); setSelectedSubject(null); setSelectedUnit(null); }, 
          "/admin/grades", mutateGrades, () => { setSelectedGrade(null); setSelectedSubject(null); setSelectedUnit(null); },
          "لا توجد صفوف"
        )}

        {selectedGrade && renderColumn(
          "المواد", Book, subjects, isLoadingSubjects, selectedSubject, 
          (s) => { setSelectedSubject(s); setSelectedUnit(null); }, 
          "/admin/subjects", mutateSubjects, () => { setSelectedSubject(null); setSelectedUnit(null); },
          "اختر صفاً لعرض المواد"
        )}

        {selectedSubject && renderColumn(
          "الوحدات", FolderOpen, units, isLoadingUnits, selectedUnit, 
          (u) => { setSelectedUnit(u); }, 
          "/admin/units", mutateUnits, () => { setSelectedUnit(null); },
          "اختر مادة لعرض الوحدات"
        )}

        {selectedUnit && renderColumn(
          "الدروس", FileText, lessons, isLoadingLessons, null, 
          () => {}, 
          "/admin/lessons", mutateLessons, () => {},
          "اختر وحدة لعرض الدروس"
        )}

      </main>
    </div>
  );
}
