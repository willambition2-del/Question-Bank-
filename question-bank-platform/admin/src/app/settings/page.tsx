"use client";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";

export default function SettingsPage() {
  const { data, error, isLoading } = useSWR('/admin/settings', (url) => api.get(url));
  const settings = data?.data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">إعدادات النظام</h1>
          <p className="text-slate-500 mt-2">الثوابت العامة والتكوين.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">حدث خطأ أثناء جلب البيانات.</div>
        ) : settings.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">المنصة تستخدم الإعدادات الافتراضية، لا يوجد إعدادات مخصصة.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-bold text-slate-700">المفتاح</th>
                  <th className="p-4 font-bold text-slate-700">القيمة</th>
                  <th className="p-4 font-bold text-slate-700">الوصف</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {settings.map((setting: any) => (
                  <tr key={setting.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono text-slate-700">{setting.key}</td>
                    <td className="p-4 font-mono bg-slate-50 text-slate-900">{setting.value}</td>
                    <td className="p-4 text-slate-500">{setting.description || '-'}</td>
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
