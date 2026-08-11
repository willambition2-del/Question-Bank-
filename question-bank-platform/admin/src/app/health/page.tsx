"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { ServerCrash, AlertTriangle, CheckCircle2, RefreshCw, Loader2, HeartPulse } from "lucide-react";
import api from "@/lib/axios";

export default function HealthPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/health', (url) => api.get(url));
  const healthData = response?.data || { status: 'UNKNOWN', components: {} };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">صحة النظام (System Health)</h1>
            <p className="text-gray-500 mt-2">مراقبة حالة المزوّدين، قواطع الدائرة (Circuit Breakers) وسجل الأخطاء.</p>
          </div>
          <button onClick={() => mutate()} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> تحديث الحالة
          </button>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 mb-8">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل بيانات الصحة.
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${healthData.status === 'HEALTHY' ? 'bg-green-50 border-green-200' : healthData.status === 'DEGRADED' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${healthData.status === 'HEALTHY' ? 'bg-green-100 text-green-600' : healthData.status === 'DEGRADED' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                  {healthData.status === 'HEALTHY' ? <CheckCircle2 className="w-8 h-8" /> : healthData.status === 'DEGRADED' ? <AlertTriangle className="w-8 h-8" /> : <ServerCrash className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${healthData.status === 'HEALTHY' ? 'text-green-900' : healthData.status === 'DEGRADED' ? 'text-yellow-900' : 'text-red-900'}`}>
                    {healthData.status === 'HEALTHY' ? 'النظام مستقر' : healthData.status === 'DEGRADED' ? 'أداء منخفض (Degraded)' : 'حالة حرجة'}
                  </h2>
                  <p className={healthData.status === 'HEALTHY' ? 'text-green-700' : healthData.status === 'DEGRADED' ? 'text-yellow-700' : 'text-red-700'}>
                    تم آخر فحص في: {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-8">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-bold text-gray-700">قواطع الدائرة (Circuit Breakers) وحالة المزوّدين</h3>
              </div>
              
              {Object.keys(healthData.components || {}).length === 0 ? (
                <div className="p-8 text-center text-gray-500">لا تتوفر تفاصيل إضافية للمكونات</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {Object.entries(healthData.components).map(([name, status]: [string, any]) => (
                    <li key={name} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <HeartPulse className={`w-5 h-5 ${status === 'UP' ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="font-medium text-gray-900">{name}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'UP' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status === 'UP' ? 'متاح (CLOSED)' : 'متعطل (OPEN)'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
