"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Plus, Search, Archive, Edit2, UploadCloud, Link as LinkIcon, Trash } from "lucide-react";
import { useState, useRef } from "react";
import useSWR from "swr";
import { GradeSelector, GradeLevel } from "@/components/GradeSelector";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function CurriculumPage() {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<GradeLevel>("THIRD_SECONDARY");
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

  const { data: resources, error, isLoading, mutate } = useSWR(
    `/study-resources/admin?gradeLevel=${grade}`,
    fetcher
  );

  const { data: subjectsData } = useSWR(`/education/subjects?limit=100`, fetcher);
  const subjects = subjectsData?.data || [];

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
      // 1. Get presigned URL
      const { data: uploadInfo } = await api.post('/study-resources/admin/upload-url', {
        fileName: formData.file.name,
        mimeType: formData.file.type || 'application/octet-stream',
      });

      setUploadProgress(30);

      // 2. Upload file to R2
      await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: formData.file,
        headers: {
          'Content-Type': formData.file.type || 'application/octet-stream',
        },
      });

      setUploadProgress(70);

      // 3. Create record in backend
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
            <h1 className="text-3xl font-bold text-slate-900">المنهج والملفات</h1>
            <p className="text-slate-500 mt-2">
              إدارة كتب الوزارة والملازم والمراجعات ورفعها للتطبيق.
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

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            حدث خطأ أثناء تحميل الملفات.
          </div>
        ) : !resources || resources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">لا توجد ملفات حالياً.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">الملف</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">المادة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">التصنيف</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">الحجم</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">مرات التنزيل</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">الحالة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.map((res: any) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{res.title}</div>
                      <div className="text-sm text-slate-500">{res.fileName}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{res.subject?.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-sm">
                        {getCategoryLabel(res.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{(res.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                    <td className="px-6 py-4 text-slate-600">{res.downloadCount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${res.isPublished ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                        {res.isPublished ? 'منشور' : 'مسودة'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(res.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      </main>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">رفع ملف جديد</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المادة</label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">اختر المادة...</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CURRICULUM">المنهج الرسمي</option>
                  <option value="TEXTBOOK">الكتب</option>
                  <option value="NOTE">الملازم</option>
                  <option value="SUMMARY">الملخصات</option>
                  <option value="REVIEW">المراجعات</option>
                  <option value="MODEL">النماذج</option>
                  <option value="REFERENCE">المراجع</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">عنوان الملف</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: ملزمة الأحياء الفصل الأول"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الملف (PDF, DOCX)</label>
                <input
                  required
                  type="file"
                  onChange={handleFileChange}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4">
                  <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={uploadProgress > 0}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={uploadProgress > 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploadProgress > 0 ? 'جاري الرفع...' : 'رفع وحفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
