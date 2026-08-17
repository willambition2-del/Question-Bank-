"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Plus, Search, Archive, Edit2, FileText, FileSpreadsheet, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { GradeSelector, GradeLevel } from "@/components/GradeSelector";
import { ExcelImportModal } from "@/components/ExcelImportModal";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ExamModelsPage() {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<GradeLevel>("THIRD_SECONDARY");
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR(
    `/admin/exam-models?page=${page}&limit=${limit}&search=${search}`,
    fetcher
  );

  const models = data?.data || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من أرشفة/حذف هذا النموذج؟")) return;
    try {
      await api.delete(`/admin/exam-models/${id}`);
      mutate();
    } catch (err: any) {
      alert("حدث خطأ: " + (err.response?.data?.message || err.message));
    }
  };

  const downloadExamTemplate = async () => {
    setDownloading(true);
    try {
      const res = await api.get("/admin/question-imports/templates/exam-models", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "قالب_استيراد_النماذج_الامتحانية.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert("حدث خطأ أثناء تحميل القالب");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">النماذج والاختبارات الامتحانية</h1>
            <p className="text-slate-500 mt-2">
              إدارة نماذج الاختبارات والمسابقات الجاهزة (Quizzes & Exam Models).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GradeSelector selectedGrade={grade} onGradeChange={setGrade} />
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              استيراد اختبارات / نماذج من Excel
            </button>
            <button
              onClick={downloadExamTemplate}
              disabled={downloading}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold shadow-sm transition-all"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              تحميل قالب النماذج (.xlsx)
            </button>
            <Link
              href="/exam-models/new"
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="w-5 h-5" />
              إضافة نموذج جديد
            </Link>
          </div>
        </header>

        <ExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={() => mutate()}
          initialGrade={grade}
        />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن نموذج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500">جاري تحميل البيانات...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            حدث خطأ أثناء تحميل النماذج. تأكد من أن الرابط الصحيح هو /admin/exam-models.
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">لا توجد نماذج امتحانية مطابقة للبحث.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">العنوان</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">المادة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">المدة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">أسئلة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {models.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{m.title}</div>
                      <div className="text-sm text-slate-500">{m.slug}</div>
                    </td>
                    <td className="px-6 py-4">{m.subject?.name || "-"}</td>
                    <td className="px-6 py-4">{m.durationMinutes} دقيقة</td>
                    <td className="px-6 py-4">{m._count?.questions || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/exam-models/${m.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(m.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="p-4 border-t flex justify-between items-center">
              <span className="text-sm text-slate-500">
                إجمالي: {meta.total} نموذج
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  السابق
                </button>
                <span className="px-3 py-1">{page} / {meta.pages || 1}</span>
                <button
                  disabled={page === (meta.pages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
