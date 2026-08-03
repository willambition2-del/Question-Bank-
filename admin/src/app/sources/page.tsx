"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Plus, Search, Archive, Edit2, Bookmark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function SourcesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR(
    `/admin/sources?page=${page}&limit=${limit}&search=${search}`,
    fetcher
  );

  const sources = data?.data || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف أو أرشفة هذا المصدر؟ قد يؤثر ذلك على الأسئلة المرتبطة به.")) return;
    try {
      await api.delete(`/admin/sources/${id}`);
      mutate();
    } catch (err: any) {
      alert("حدث خطأ: " + (err.response?.data?.message || err.message));
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      MINISTRY_EXAM: "اختبار وزاري",
      MINISTRY_MODEL: "نموذج وزاري",
      TEXTBOOK: "كتاب مدرسي",
      TEACHER: "معلم",
      IMPORT: "استيراد",
      GENERATED: "توليد ذكاء اصطناعي",
      OTHER: "أخرى"
    };
    return types[type] || type;
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">المصادر والمراجع</h1>
            <p className="text-slate-500 mt-2">
              إدارة مصادر الأسئلة مثل الاختبارات الوزارية والكتب.
            </p>
          </div>
          <Link
            href="/sources/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            إضافة مصدر جديد
          </Link>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن مصدر..."
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
            حدث خطأ أثناء تحميل المصادر. تأكد من أن الرابط الصحيح هو /admin/sources.
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">لا توجد مصادر مطابقة للبحث.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">الاسم</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">النوع</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">السنة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">المحافظة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">أسئلة مرتبطة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                        {getTypeLabel(s.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">{s.year || "-"}</td>
                    <td className="px-6 py-4">{s.governorate || "-"}</td>
                    <td className="px-6 py-4">{s._count?.questions || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/sources/${s.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
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
                إجمالي: {meta.total} مصدر
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
