"use client";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, FileText } from "lucide-react";
import api from "@/lib/axios";

export default function QuizAttemptsPage() {
  const { data, error, isLoading } = useSWR('/admin/quiz-attempts', (url) => api.get(url));
  const attempts = data?.data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">محاولات الاختبارات</h1>
          <p className="text-slate-500 mt-2">سجل اختبارات الطلاب في المنصة.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">حدث خطأ أثناء جلب البيانات.</div>
        ) : attempts.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">لا توجد محاولات مسجلة بعد.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-bold text-slate-700">الطالب</th>
                  <th className="p-4 font-bold text-slate-700">المادة</th>
                  <th className="p-4 font-bold text-slate-700">النتيجة</th>
                  <th className="p-4 font-bold text-slate-700">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attempts.map((attempt: any) => (
                  <tr key={attempt.id} className="hover:bg-slate-50">
                    <td className="p-4">{attempt.user?.name || 'غير معروف'}</td>
                    <td className="p-4">{attempt.subject?.name || 'عام'}</td>
                    <td className="p-4 font-mono">{attempt.score || 0}</td>
                    <td className="p-4">{new Date(attempt.createdAt).toLocaleDateString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
