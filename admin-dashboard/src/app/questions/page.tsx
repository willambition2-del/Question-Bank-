"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { 
  CheckCircle2, 
  Loader2, 
  Pencil, 
  Plus, 
  Search, 
  ShieldAlert, 
  FileText,
  Clock,
  Archive,
  UploadCloud,
  DownloadCloud
} from "lucide-react";

type Question = {
  id: string;
  questionText: string;
  type: string;
  reviewStatus: string;
  isPublished: boolean;
  isTrusted: boolean;
};

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function QuestionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Question | null>(null);
  const [draft, setDraft] = useState("");

  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "50", page: page.toString() });
    if (search) params.append("search", search);
    if (status) params.append("reviewStatus", status);
    return params.toString();
  }, [search, status, page]);

  const { data, error, isLoading, mutate } = useSWR(`/admin/questions?${query}`, fetcher);
  const items: Question[] = data?.data || [];
  const meta = data?.meta || { total: 0 };

  async function save() {
    if (!editing || !draft.trim()) return;
    if (editing.isTrusted) {
      alert("لا يمكن تعديل الأسئلة الموثوقة من الواجهة.");
      return;
    }
    try {
      await api.patch(`/admin/questions/${editing.id}`, { questionText: draft });
      setEditing(null);
      await mutate();
    } catch (err) {
      alert("حدث خطأ أثناء الحفظ");
    }
  }

  async function handleArchive(id: string, isTrusted: boolean) {
    if (!confirm("هل أنت متأكد من أرشفة هذا السؤال؟")) return;
    try {
      await api.post(`/admin/questions/${id}/archive`, { note: "أرشفة يدوية من لوحة التحكم" });
      mutate();
    } catch (err) {
      alert("حدث خطأ أثناء الأرشفة");
    }
  }

  const getStatusIcon = (status: string, isPublished: boolean) => {
    if (isPublished) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    switch (status) {
      case 'READY': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'DRAFT': return <FileText className="w-4 h-4 text-gray-500" />;
      case 'REVIEW_REQUIRED': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'ARCHIVED': return <Archive className="w-4 h-4 text-red-500" />;
      default: return <ShieldAlert className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: string, isPublished: boolean) => {
    if (isPublished) return 'منشور';
    switch (status) {
      case 'READY': return 'جاهز للنشر';
      case 'DRAFT': return 'مسودة';
      case 'REVIEW_REQUIRED': return 'قيد المراجعة';
      case 'ARCHIVED': return 'مؤرشف';
      default: return status;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              بنك الأسئلة
            </h1>
            <p className="text-gray-500 mt-2">
              إدارة، إضافة، ومراجعة الأسئلة لجميع المواد الدراسية. الإجمالي: {meta.total} سؤال.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/questions/import" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
              <UploadCloud className="w-4 h-4" /> استيراد
            </Link>
            <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
              <DownloadCloud className="w-4 h-4" /> تصدير
            </button>
            <Link href="/questions/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm">
              <Plus className="w-5 h-5" /> إضافة سؤال
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            ["إجمالي الأسئلة المعروضة", items.length],
            ["أسئلة قيد المراجعة", items.filter(x => x.reviewStatus === "REVIEW_REQUIRED").length],
            ["الأسئلة المنشورة", items.filter(x => x.isPublished).length]
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ابحث في نص السؤال..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative w-48">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">جميع الحالات</option>
                <option value="READY">جاهز (READY)</option>
                <option value="DRAFT">مسودة (DRAFT)</option>
                <option value="REVIEW_REQUIRED">قيد المراجعة</option>
                <option value="ARCHIVED">مؤرشف</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">تعذر تحميل بيانات الأسئلة.</div>
            ) : (
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                  <tr>
                    <th className="py-3 px-6 font-medium">نص السؤال</th>
                    <th className="py-3 px-6 font-medium">النوع</th>
                    <th className="py-3 px-6 font-medium">الحالة</th>
                    <th className="py-3 px-6 font-medium">النشر</th>
                    <th className="py-3 px-6 font-medium text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        لا يوجد أسئلة تطابق بحثك
                      </td>
                    </tr>
                  )}
                  {items.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6 max-w-xl">
                        <div className="font-medium text-gray-900 truncate flex items-center gap-2" title={q.questionText}>
                          {q.questionText}
                          {q.isTrusted && (
                            <span title="سؤال موثوق (لا يمكن تعديله)" className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              موثوق
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-1" dir="ltr">{q.id}</div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600 font-mono">
                        {q.type}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {getStatusIcon(q.reviewStatus, q.isPublished)}
                          {getStatusLabel(q.reviewStatus, q.isPublished)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {q.isPublished ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 inline" />
                        ) : (
                          <ShieldAlert className="w-5 h-5 text-gray-300 inline" />
                        )}
                      </td>
                      <td className="py-4 px-6 text-center space-x-2 space-x-reverse">
                        {!q.isTrusted && (
                          <button 
                            onClick={() => { setEditing(q); setDraft(q.questionText); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل سريع"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleArchive(q.id, q.isTrusted)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="أرشفة السؤال"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && meta.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
              >
                السابق
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                صفحة {page} من {meta.totalPages}
              </span>
              <button 
                disabled={page === meta.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          )}
        </div>

        {/* Quick Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg text-gray-900">تعديل سريع للسؤال</h3>
                <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">نص السؤال</label>
                <textarea 
                  rows={8} 
                  value={draft} 
                  onChange={(e) => setDraft(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="اكتب نص السؤال هنا..."
                />
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800 text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <p>الحفظ سيؤدي إلى إعادة حالة السؤال إلى مسودة (DRAFT) وسيلغي نشره إذا كان منشوراً.</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">إلغاء</button>
                <button onClick={save} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                  حفظ التعديلات
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}