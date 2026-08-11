"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Download, Loader2, FileCheck, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function QualityPage() {
  const { data, isLoading, error } = useSWR("/admin/questions/quality", fetcher);
  const q = data?.data;

  async function download(format: "xlsx" | "csv" | "json") {
    try {
      const blob: any = await api.post(`/admin/questions/export?format=${format}`, {}, { responseType: "blob" });
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `questions-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("حدث خطأ أثناء التصدير");
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileCheck className="w-8 h-8 text-blue-600" />
              جودة بيانات الأسئلة
            </h1>
            <p className="text-slate-500 mt-2">
              لوحة مراقبة لمحتوى بنك الأسئلة (لا يوجد تعديل آلي لتجنب إفساد البيانات).
            </p>
          </div>
          <div className="flex gap-2">
            {(["xlsx", "csv", "json"] as const).map(x => (
              <button 
                key={x} 
                onClick={() => download(x)} 
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 flex items-center gap-2 font-medium text-sm transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> 
                {x.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl">
            تعذر تحميل بيانات الجودة من الخادم.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                ["الإجمالي", q.total, "text-blue-600"],
                ["جاهز للنشر (READY)", q.ready, "text-green-600"],
                ["يحتاج مراجعة", q.requiresReview, "text-amber-600"],
                ["مجموعات مكررة (محتمل)", q.probableDuplicateGroups, "text-purple-600"],
              ].map(([k, v, colorClass]) => (
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5" key={String(k)}>
                  <p className="text-sm font-medium text-slate-500">{k}</p>
                  <p className={`text-3xl font-bold mt-2 ${colorClass}`}>{String(v)}</p>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> النواقص والأخطاء المحتملة
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["بلا إجابة صحيحة", q.missingAnswer],
                  ["بلا شرح", q.missingExplanation],
                  ["بلا تلميح", q.missingHint],
                  ["غير مربوط بدرس", q.missingLesson],
                ].map(([k, v]) => (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-5" key={String(k)}>
                    <p className="text-sm font-medium text-red-800">{k}</p>
                    <p className="text-3xl font-bold mt-2 text-red-600">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mt-8">
              <Panel title="توزيع حسب النوع" value={q.byType} />
              <Panel title="توزيع حسب الصعوبة" value={q.byDifficulty} />
              <Panel 
                title="أكثر المواد أسئلة" 
                value={Object.fromEntries(q.bySubject.map((x: any) => [x.name, x.count]))} 
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Panel({ title, value }: { title: string; value: Record<string, number> }) {
  return (
    <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
      <h2 className="font-bold text-slate-900 mb-4 pb-2 border-b">{title}</h2>
      <div className="space-y-1">
        {Object.entries(value ?? {}).map(([k, v]) => (
          <div key={k} className="flex justify-between items-center py-2 hover:bg-slate-50 px-2 rounded transition-colors">
            <span className="text-slate-600 text-sm font-medium">{k}</span>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{v}</span>
          </div>
        ))}
        {Object.keys(value ?? {}).length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
        )}
      </div>
    </section>
  );
}