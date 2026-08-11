"use client";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";

export default function SubscriptionsPage() {
  const { data, error, isLoading } = useSWR('/admin/subscriptions', (url) => api.get(url));
  const subscriptions = data?.data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">الاشتراكات والمدفوعات</h1>
          <p className="text-slate-500 mt-2">سجل اشتراكات الطلاب الموثقة.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">حدث خطأ أثناء جلب البيانات.</div>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">لا توجد اشتراكات مسجلة.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-bold text-slate-700">الطالب</th>
                  <th className="p-4 font-bold text-slate-700">الخطة</th>
                  <th className="p-4 font-bold text-slate-700">الحالة</th>
                  <th className="p-4 font-bold text-slate-700">تاريخ الانتهاء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscriptions.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="p-4">{sub.user?.name || 'غير معروف'}</td>
                    <td className="p-4">{sub.planId}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">{sub.status}</span></td>
                    <td className="p-4 text-slate-500">{new Date(sub.endDate).toLocaleDateString('ar-SA')}</td>
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
