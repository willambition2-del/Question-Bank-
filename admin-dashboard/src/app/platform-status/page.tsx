"use client";

import useSWR from "swr";
import { Activity, Database, HardDrive, RefreshCw, Server } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";

type Readiness = {
  status: string;
  blockers: string[];
  providers: { enabled: number; credentialed: number; healthy: number };
  models: { enabled: number };
  routes: { enabled: number };
  knowledgeBases: { enabled: number };
  vector: {
    enabled: boolean;
    extensionInstalled: boolean;
    storageReady: boolean;
    dimensions: number;
  };
  queue: {
    configured: boolean;
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
  };
  checkedAt: string;
};

export default function PlatformStatusPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/admin/intelligent-services/readiness",
    (url) => api.get(url),
    { refreshInterval: 30000 },
  );
  const value = data?.data as Readiness | undefined;
  const cards = value
    ? [
        [
          "المزوّدون",
          `${value.providers.healthy}/${value.providers.enabled} مفعل`,
          Server,
        ],
        [
          "النماذج والموجهات",
          `${value.models.enabled} / ${value.routes.enabled}`,
          Activity,
        ],
        [
          "pgvector",
          value.vector.storageReady
            ? `جاهز (${value.vector.dimensions})`
            : "غير جاهز",
          Database,
        ],
        [
          "طابور المستندات",
          `${value.queue.waiting} في الانتظار ${value.queue.active} نشط`,
          HardDrive,
        ],
      ]
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">حالة المنصة</h1>
            <p className="mt-2 text-slate-600">
              تحقق من جاهزية المكونات، pgvector، و BullMQ.
            </p>
          </div>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2"
          >
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
        </header>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            حدث خطأ أثناء جلب البيانات.
          </div>
        )}
        {isLoading && <div className="text-slate-500">جاري التحميل</div>}
        {value && (
          <>
            <div
              className={`mb-6 rounded-2xl border p-6 ${
                value.status === "READY" ? "border-green-200 bg-green-50 text-green-800" :
                value.status === "DEGRADED" ? "border-amber-200 bg-amber-50 text-amber-800" :
                value.status === "NOT_CONFIGURED" ? "border-blue-200 bg-blue-50 text-blue-800" :
                value.status === "UNAVAILABLE" ? "border-red-200 bg-red-50 text-red-800" :
                "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              <p className="text-2xl font-bold">{value.status}</p>
              <p className="mt-1 text-sm opacity-80">
                آخر فحص: {new Date(value.checkedAt).toLocaleString("ar-SA")}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map(([label, detail, Icon]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <Icon className="mb-4 h-6 w-6 text-blue-700" />
                  <p className="text-sm text-slate-500">{String(label)}</p>
                  <p className="mt-1 font-bold">{String(detail)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border bg-white p-6">
              <h2 className="font-bold">معوقات التشغيل</h2>
              {value.blockers.length ? (
                <ul className="mt-3 list-inside list-disc text-red-700">
                  {value.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-green-700">لا توجد أي مشاكل تعيق التشغيل.</p>
              )}
              <p className="mt-4 text-sm text-slate-500">
                المهام الفاشلة: {value.queue.failed}، المؤجلة: {value.queue.delayed}،
                المهام المكتملة: {value.queue.completed}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
