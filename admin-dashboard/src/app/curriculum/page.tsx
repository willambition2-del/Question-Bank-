"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { 
  Plus, 
  Search, 
  Archive, 
  Edit2, 
  UploadCloud, 
  Link as LinkIcon, 
  Trash, 
  Image as ImageIcon,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { useState, useRef } from "react";
import useSWR from "swr";
import { GradeSelector, GradeLevel } from "@/components/GradeSelector";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function CurriculumPage() {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<GradeLevel>("THIRD_SECONDARY");
  const [activeTab, setActiveTab] = useState<"files" | "covers">("files");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    subjectId: "",
    title: "",
    description: "",
    category: "TEXTBOOK",
    file: null as File | null,
    isPublished: true,
  });

  // Cover Image Upload State
  const [uploadingSubjectId, setUploadingSubjectId] = useState<string | null>(null);
  const [imageToast, setImageToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetSubjectForUpload, setTargetSubjectForUpload] = useState<any>(null);

  const { data: resources, error, isLoading, mutate } = useSWR(
    `/study-resources/admin?gradeLevel=${grade}`,
    fetcher
  );

  const { data: subjectsData, mutate: mutateSubjects, isLoading: subjectsLoading } = useSWR(
    `/admin/subjects?limit=100`,
    fetcher
  );
  const allSubjects = subjectsData?.data || [];
  
  // Filter subjects by selected grade
  const subjects = allSubjects.filter((s: any) => {
    if (!s.grade) return true;
    return s.grade.code === grade;
  });

  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formData.file) {
      alert("الرجاء اختيار ملف");
      return;
    }
    
    try {
      setUploadProgress(10);
      const { data: uploadInfo } = await api.post('/study-resources/admin/upload-url', {
        fileName: formData.file.name,
        mimeType: formData.file.type || 'application/octet-stream',
      });

      setUploadProgress(30);

      await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: formData.file,
        headers: {
          'Content-Type': formData.file.type || 'application/octet-stream',
        },
      });

      setUploadProgress(70);

      await api.post('/study-resources/admin', {
        subjectId: formData.subjectId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        fileKey: uploadInfo.fileKey,
        fileName: formData.file.name,
        mimeType: formData.file.type || 'application/octet-stream',
        fileSize: formData.file.size,
        isPublished: formData.isPublished,
      });

      setUploadProgress(100);
      setTimeout(() => {
        setIsModalOpen(false);
        setFormData({ ...formData, file: null, title: "", description: "" });
        setUploadProgress(0);
        mutate();
      }, 1000);
    } catch (err: any) {
      alert("حدث خطأ أثناء الرفع: " + (err.response?.data?.message || err.message));
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
    try {
      await api.delete(`/study-resources/admin/${id}`);
      mutate();
    } catch (err: any) {
      alert("حدث خطأ: " + (err.response?.data?.message || err.message));
    }
  };

  const handleSubjectCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetSubjectForUpload) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageToast({ type: "error", message: "حجم الصورة يجب ألا يتجاوز 5 ميغابايت." });
      return;
    }

    setUploadingSubjectId(targetSubjectForUpload.id);
    setImageToast(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      await api.post(`/admin/subjects/${targetSubjectForUpload.id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await mutateSubjects();
      setImageToast({ type: "success", message: `تم تحديث صورة غلاف (${targetSubjectForUpload.name}) بنجاح!` });
      setTimeout(() => setImageToast(null), 4000);
    } catch (err: any) {
      setImageToast({ type: "error", message: err?.response?.data?.message || "فشل رفع الصورة." });
    } finally {
      setUploadingSubjectId(null);
      setTargetSubjectForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSubjectCover = async (subject: any) => {
    if (!confirm(`هل أنت متأكد من حذف صورة غلاف (${subject.name})؟`)) return;
    setUploadingSubjectId(subject.id);
    try {
      await api.delete(`/admin/subjects/${subject.id}/image`);
      await mutateSubjects();
      setImageToast({ type: "success", message: `تم حذف صورة (${subject.name}) بنجاح.` });
      setTimeout(() => setImageToast(null), 3000);
    } catch (err: any) {
      setImageToast({ type: "error", message: "فشل حذف الصورة." });
    } finally {
      setUploadingSubjectId(null);
    }
  };

  const getCategoryLabel = (cat: string) => {
    const categories: Record<string, string> = {
      CURRICULUM: "المنهج الرسمي",
      TEXTBOOK: "الكتب",
      NOTE: "الملازم",
      SUMMARY: "الملخصات",
      REVIEW: "المراجعات",
      MODEL: "النماذج",
      REFERENCE: "المراجع",
      OTHER: "أخرى",
    };
    return categories[cat] || cat;
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">المنهج وصور المواد</h1>
            <p className="text-slate-500 mt-2">
              إدارة كتب الوزارة والملازم والمراجعات وصور أغلفة المواد في تطبيق الطلاب.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GradeSelector selectedGrade={grade} onGradeChange={setGrade} />
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              إضافة ملف جديد
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {imageToast && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 text-sm font-bold border ${
            imageToast.type === "success" 
              ? "bg-green-50 text-green-800 border-green-200" 
              : "bg-red-50 text-red-800 border-red-200"
          }`}>
            {imageToast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{imageToast.message}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("files")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
              activeTab === "files"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            الملفات والملازم المرفوعة
          </button>
          <button
            onClick={() => setActiveTab("covers")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
              activeTab === "covers"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            صور أغلفة المواد ({grade === "NINTH" ? "الصف التاسع" : "الثالث الثانوي"})
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleSubjectCoverSelected} 
          accept="image/jpeg,image/png,image/webp" 
          className="hidden" 
        />

        {activeTab === "covers" ? (
          /* Subject Covers Management Grid */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    أغلفة المواد المعتمدة ({grade === "NINTH" ? "الصف التاسع" : "الثالث الثانوي"})
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    يتم عرض هذه الصور مباشرة للطلاب في واجهة المنهج وبطاقات المواد في التطبيق.
                  </p>
                </div>
              </div>

              {subjectsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-sm">لا توجد مواد مسجلة لهذا الصف الدراسي.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subjects.map((subject: any) => {
                    const isUploading = uploadingSubjectId === subject.id;
                    return (
                      <div 
                        key={subject.id} 
                        className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:border-indigo-300 transition"
                      >
                        {/* Cover Image Header */}
                        <div className="h-40 bg-slate-200 relative group flex items-center justify-center overflow-hidden">
                          {subject.coverImageUrl ? (
                            <img 
                              src={subject.coverImageUrl} 
                              alt={subject.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-gray-400 p-4">
                              <ImageIcon className="w-10 h-10 mx-auto text-gray-300 mb-1" />
                              <span className="text-xs font-medium">الغلاف الافتراضي</span>
                            </div>
                          )}

                          {subject.coverImageUrl && (
                            <a 
                              href={subject.coverImageUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="absolute top-2 left-2 p-1.5 bg-white/90 text-gray-700 rounded-lg hover:bg-white shadow opacity-0 group-hover:opacity-100 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="p-4 space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-base">{subject.name}</h3>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              {grade === "NINTH" ? "تاسع" : "ثالث ثانوي"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setTargetSubjectForUpload(subject);
                                fileInputRef.current?.click();
                              }}
                              disabled={isUploading}
                              className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                              {isUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              {subject.coverImageUrl ? "تغيير الغلاف" : "رفع غلاف"}
                            </button>

                            {subject.coverImageUrl && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSubjectCover(subject)}
                                disabled={isUploading}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition disabled:opacity-50"
                                title="حذف الغلاف"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Files Management Table */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="البحث في الملفات والملازم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-500">جاري تحميل الملفات...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">حدث خطأ في تحميل البيانات</div>
            ) : !resources || resources.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                لا توجد ملفات مرفوعة لهذا الصف حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="p-4 font-semibold">عنوان الملف</th>
                      <th className="p-4 font-semibold">المادة</th>
                      <th className="p-4 font-semibold">النوع</th>
                      <th className="p-4 font-semibold">الحجم</th>
                      <th className="p-4 font-semibold">التحميلات</th>
                      <th className="p-4 font-semibold">الحالة</th>
                      <th className="p-4 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resources
                      .filter((r: any) =>
                        r.title.toLowerCase().includes(search.toLowerCase()) ||
                        r.subject?.name?.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((res: any) => (
                        <tr key={res.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 font-medium text-slate-900">{res.title}</td>
                          <td className="p-4 text-slate-600">{res.subject?.name || "-"}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                              {getCategoryLabel(res.category)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 text-xs">
                            {(res.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </td>
                          <td className="p-4 text-slate-600">{res.downloadCount}</td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                res.isPublished
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {res.isPublished ? "منشور" : "مسودة"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(res.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="حذف"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add New File */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4">إضافة ملف جديد</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة</label>
                  <select
                    required
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">اختر المادة</option>
                    {subjects.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    عنوان الملف
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: كتاب الفيزياء الجزء الأول"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    نوع المورد
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CURRICULUM">المنهج الرسمي</option>
                    <option value="TEXTBOOK">الكتب المدرسية</option>
                    <option value="NOTE">الملازم والشروحات</option>
                    <option value="SUMMARY">الملخصات</option>
                    <option value="REVIEW">المراجعات الامتحانية</option>
                    <option value="MODEL">النماذج والحلول</option>
                    <option value="REFERENCE">المراجع الإثرائية</option>
                    <option value="OTHER">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    الملف (PDF, Word, etc.)
                  </label>
                  <input
                    type="file"
                    required
                    onChange={handleFileChange}
                    className="w-full border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>جاري الرفع...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={uploadProgress > 0}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {uploadProgress > 0 ? "جاري الرفع..." : "حفظ المورد"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
