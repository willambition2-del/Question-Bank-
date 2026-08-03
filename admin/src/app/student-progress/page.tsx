"use client";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, TrendingUp } from "lucide-react";
import api from "@/lib/axios";

export default function StudentProgressPage() {
  const { data, error, isLoading } = useSWR('/admin/student-progress', (url) => api.get(url));
  const progressList = data?.data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">تقدم الطلاب</h1>
          <p className="text-slate-500 mt-2">متابعة الأداء وإنجاز المواد الدراسية.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">حدث خطأ أثناء جلب البيانات.</div>
        ) : progressList.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">لا يوجد سجلات تقدم.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-bold text-slate-700">الطالب</th>
                  <th className="p-4 font-bold text-slate-700">المادة</th>
                  <th className="p-4 font-bold text-slate-700">الإنجاز</th>
                  <th className="p-4 font-bold text-slate-700">آخر تحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {progressList.map((prog: any) => (
                  <tr key={prog.id} className="hover:bg-slate-50">
                    <td className="p-4">{prog.user?.name || 'غير معروف'}</td>
                    <td className="p-4">{prog.subject?.name || 'غير معروف'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, prog.completionPercentage || 0)}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500">{prog.completionPercentage || 0}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">{new Date(prog.updatedAt).toLocaleDateString('ar-SA')}</td>
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
