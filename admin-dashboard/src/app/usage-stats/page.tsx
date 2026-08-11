"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { BarChart3, TrendingUp, AlertTriangle, Loader2, DollarSign, Activity } from "lucide-react";
import api from "@/lib/axios";

export default function UsageStatsPage() {
  const { data: usageRes, error: usageError, isLoading: usageLoading } = useSWR('/admin/intelligent-services/usage', (url) => api.get(url));
  const { data: costRes, error: costError, isLoading: costLoading } = useSWR('/admin/intelligent-services/costs', (url) => api.get(url));
  
  const usage = usageRes?.data || { totalRequests: 0, successes: 0, failures: 0, totalTokens: 0 };
  const costs = costRes?.data || { totalEstimatedCost: 0, currency: "USD", providerBreakdown: {} };

  const isLoading = usageLoading || costLoading;
  const error = usageError || costError;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">الاستخدام والتكلفة</h1>
          <p className="text-gray-500 mt-2">نظرة عامة على حجم الاستخدام والتكاليف التقديرية للخدمات الذكية.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 mb-8">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل إحصائيات الاستخدام.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                  <h3 className="font-bold text-gray-700">إجمالي الطلبات</h3>
                </div>
                <p className="text-3xl font-black text-gray-900">{usage.totalRequests}</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                  <h3 className="font-bold text-gray-700">الطلبات الناجحة</h3>
                </div>
                <p className="text-3xl font-black text-gray-900">{usage.successes}</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                  <h3 className="font-bold text-gray-700">الطلبات الفاشلة</h3>
                </div>
                <p className="text-3xl font-black text-gray-900">{usage.failures}</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
                  <h3 className="font-bold text-gray-700">التكلفة التقديرية</h3>
                </div>
                <p className="text-3xl font-black text-gray-900" dir="ltr">
                  {costs.totalEstimatedCost !== undefined && costs.totalEstimatedCost !== null ? `$${costs.totalEstimatedCost.toFixed(4)}` : "UNKNOWN"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                  التكلفة حسب المزوّد
                </h3>
                {Object.keys(costs.providerBreakdown || {}).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">لا توجد بيانات متاحة</p>
                ) : (
                  <ul className="space-y-4">
                    {Object.entries(costs.providerBreakdown).map(([provider, cost]: [string, any]) => (
                      <li key={provider} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">{provider}</span>
                        <span className="font-mono text-gray-900">{cost !== undefined && cost !== null ? `$${cost.toFixed(4)}` : "UNKNOWN"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
