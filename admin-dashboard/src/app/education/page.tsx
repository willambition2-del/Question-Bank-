"use client";

import { useState, useRef } from "react";
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
  EyeOff,
  Image as ImageIcon,
  Upload,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/axios";

export default function EducationPage() {
  const [selectedGrade, setSelectedGrade] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  // Subject Image Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSuccess, setImageSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      return;
    }

    setIsUploadingImage(true);
    setImageError(null);
    setImageSuccess(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await api.post(`/admin/subjects/${selectedSubject.id}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newUrl = res.data?.data?.coverImageUrl;
      setSelectedSubject({ ...selectedSubject, coverImageUrl: newUrl });
      await mutateSubjects();
      setImageSuccess("تم رفع وتحديث صورة المادة بنجاح!");
      setTimeout(() => setImageSuccess(null), 4000);
    } catch (err: any) {
      setImageError(err?.response?.data?.message || "فشل رفع الصورة. تأكد من أن نوع الملف مدعوم (JPG, PNG, WEBP).");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSubjectImage = async () => {
    if (!selectedSubject || !confirm("هل أنت متأكد من حذف صورة هذه المادة؟")) return;
    setIsUploadingImage(true);
    setImageError(null);
    try {
      await api.delete(`/admin/subjects/${selectedSubject.id}/image`);
      setSelectedSubject({ ...selectedSubject, coverImageUrl: null });
      await mutateSubjects();
      setImageSuccess("تم حذف صورة المادة بنجاح.");
      setTimeout(() => setImageSuccess(null), 3000);
    } catch (err: any) {
      setImageError(err?.response?.data?.message || "فشل حذف الصورة.");
    } finally {
      setIsUploadingImage(false);
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
                    {item.coverImageUrl && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
                        <ImageIcon className="w-2.5 h-2.5" /> صورة
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
      <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto h-screen custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">الهيكل التعليمي وإدارة المواد</h1>
            <p className="text-gray-500 text-xs mt-0.5">إدارة الصفوف، المواد الدراسية، الصور، الوحدات، والدروس.</p>
          </div>
        </div>

        {/* 4 Column Explorer */}
        <div className="flex gap-4 overflow-x-auto items-start min-h-[420px]">
          {renderColumn(
            "الصفوف", Layers, grades, false, selectedGrade, 
            (g) => { setSelectedGrade(g); setSelectedSubject(null); setSelectedUnit(null); }, 
            "/admin/grades", mutateGrades, () => { setSelectedGrade(null); setSelectedSubject(null); setSelectedUnit(null); },
            "لا توجد صفوف"
          )}

          {selectedGrade && renderColumn(
            `المواد (${selectedGrade.name})`, Book, subjects, isLoadingSubjects, selectedSubject, 
            (s) => { setSelectedSubject(s); setSelectedUnit(null); }, 
            "/admin/subjects", mutateSubjects, () => { setSelectedSubject(null); setSelectedUnit(null); },
            "اختر صفاً لعرض المواد"
          )}

          {selectedSubject && renderColumn(
            `الوحدات (${selectedSubject.name})`, FolderOpen, units, isLoadingUnits, selectedUnit, 
            (u) => { setSelectedUnit(u); }, 
            "/admin/units", mutateUnits, () => { setSelectedUnit(null); },
            "اختر مادة لعرض الوحدات"
          )}

          {selectedUnit && renderColumn(
            `الدروس (${selectedUnit.name})`, FileText, lessons, isLoadingLessons, null, 
            () => {}, 
            "/admin/lessons", mutateLessons, () => {},
            "اختر وحدة لعرض الدروس"
          )}
        </div>

        {/* Subject Cover Image Management Card */}
        {selectedSubject && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    إدارة صورة غلاف المادة: <span className="text-indigo-600">{selectedSubject.name}</span>
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    الصف: <span className="font-bold text-gray-700">{selectedGrade?.name || "الصف المحدد"}</span> • تُعرض هذه الصورة في واجهة المنهج وبطاقات المواد في التطبيق.
                  </p>
                </div>
              </div>

              {/* Status Alert */}
              {imageSuccess && (
                <div className="text-xs bg-green-50 text-green-800 border border-green-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  {imageSuccess}
                </div>
              )}
              {imageError && (
                <div className="text-xs bg-red-50 text-red-800 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
                  <XCircle className="w-4 h-4 text-red-600" />
                  {imageError}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Image Preview Box */}
              <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 min-h-[160px]">
                {selectedSubject.coverImageUrl ? (
                  <div className="relative group w-full h-36 rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img 
                      src={selectedSubject.coverImageUrl} 
                      alt={selectedSubject.name} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a 
                        href={selectedSubject.coverImageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 shadow"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 space-y-2 py-4">
                    <ImageIcon className="w-12 h-12 mx-auto text-gray-300" />
                    <p className="text-xs font-medium">لا توجد صورة مخصصة (يتم استخدام مظهر الغلاف الافتراضي)</p>
                  </div>
                )}
              </div>

              {/* Upload Actions */}
              <div className="md:col-span-2 space-y-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageFileSelected} 
                  accept="image/jpeg,image/png,image/webp" 
                  className="hidden" 
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {selectedSubject.coverImageUrl ? "تغيير صورة الغلاف" : "رفع صورة الغلاف"}
                  </button>

                  {selectedSubject.coverImageUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteSubjectImage}
                      disabled={isUploadingImage}
                      className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الصورة
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  الصيغ المدعومة: <strong>JPG, PNG, WEBP</strong> • الحد الأقصى للحجم: <strong>5 ميغابايت</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
