"use client";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";

export default function SupportTicketsPage() {
  const { data, error, isLoading } = useSWR('/admin/support-tickets', (url) => api.get(url));
  const tickets = data?.data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">تذاكر الدعم</h1>
          <p className="text-slate-500 mt-2">إدارة شكاوى واستفسارات المستخدمين.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">حدث خطأ أثناء جلب البيانات.</div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">لا توجد تذاكر حالياً.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-bold text-slate-700">المستخدم</th>
                  <th className="p-4 font-bold text-slate-700">الموضوع</th>
                  <th className="p-4 font-bold text-slate-700">الحالة</th>
                  <th className="p-4 font-bold text-slate-700">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tickets.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-slate-50">
                    <td className="p-4">{ticket.user?.name || 'غير معروف'}</td>
                    <td className="p-4">{ticket.subject}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{ticket.status}</span></td>
                    <td className="p-4">{new Date(ticket.createdAt).toLocaleDateString('ar-SA')}</td>
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
