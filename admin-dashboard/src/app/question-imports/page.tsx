"use client";

import { FormEvent, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";

const APPROVAL = "OWNER_APPROVED_FULL_IMPORT";
const CANONICAL_CHECKSUM =
  "400e5ebd6f6ab34c4a6a03f53c7550d3bf57a0897397f4c1905dfee463914bf8";
const fetcher = (url: string) => api.get(url);

type ImportJob = {
  id: string;
  fileName: string;
  checksum?: string;
  status: string;
  totalRows: number;
  invalidRows: number;
  duplicateRows: number;
  reviewRows?: number;
};

export default function Page() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [trustedJob, setTrustedJob] = useState<ImportJob | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const { data, mutate, isLoading } = useSWR(
    "/admin/question-imports?limit=50",
    fetcher,
  );
  const jobs: ImportJob[] = data?.data ?? [];

  async function upload(event: FormEvent) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await api.post("/admin/question-imports/upload", body);
      if (input.current) input.current.value = "";
      await mutate();
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "فشل رفع الملف");
    } finally {
      setBusy(false);
    }
  }
  async function show(id: string) {
    const response: any = await api.get(`/admin/question-imports/${id}/report`);
    setReport(response.data);
  }
  async function controlImport(job: ImportJob, action: "pause" | "cancel") {
    setBusy(true);
    try {
      await api.post(`/admin/question-imports/${job.id}/${action}`);
      await mutate();
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "فشل تحديث حالة الاستيراد");
    } finally {
      setBusy(false);
    }
  }
  async function executeTrustedImport() {
    if (!trustedJob || confirmation !== APPROVAL) return;
    setBusy(true);
    try {
      const response: any = await api.post(
        `/admin/question-imports/${trustedJob.id}/${trustedJob.status === "PAUSED" ? "owner-approved-resume" : "owner-approved-import"}`,
        { confirmation: APPROVAL },
      );
      setReport(response.data);
      setTrustedJob(null);
      setConfirmation("");
      await mutate();
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "فشل الاستيراد الموثوق");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <header className="mb-7">
          <h1 className="text-3xl font-bold">استيراد الأسئلة</h1>
          <p className="text-slate-500 mt-2">
            الاستيراد العام يمر عبر Dry Run، والاستيراد الموثوق يتطلب اعتمادًا
            صريحًا من SUPER_ADMIN.
          </p>
        </header>
        <div className="grid lg:grid-cols-3 gap-5 mb-6">
          <form
            onSubmit={upload}
            className="lg:col-span-2 bg-white border rounded-xl p-6"
          >
            <h2 className="font-bold flex gap-2 mb-4">
              <UploadCloud />
              رفع ملف للتحليل
            </h2>
            <input
              ref={input}
              required
              type="file"
              accept=".xlsx,.csv,.json,.zip"
              className="w-full border border-dashed rounded-lg p-5"
            />
            <button
              disabled={busy}
              className="mt-4 bg-blue-600 text-white rounded-lg px-5 py-2 flex gap-2"
            >
              {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}رفع
            </button>
          </form>
          <a
            href="/question-import-template.xlsx"
            download
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 grid place-items-center text-center"
          >
            <FileSpreadsheet className="w-12 h-12 text-emerald-700" />
            <strong>تنزيل قالب Excel الرسمي</strong>
            <Download />
          </a>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-5 flex gap-3 text-amber-900">
          <AlertTriangle />
          <p>
            وضع المالك الموثوق يتجاوز تحذيرات جودة المحتوى فقط. أخطاء البنية،
            البصمة غير المطابقة، أو غياب حساب SUPER_ADMIN نشط تمنع التنفيذ.
          </p>
        </div>
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex justify-between">
            <b>سجل عمليات الاستيراد</b>
            <button aria-label="تحديث" onClick={() => mutate()}>
              <RefreshCw className="w-4" />
            </button>
          </div>
          {isLoading ? (
            <Loader2 className="animate-spin m-8" />
          ) : (
            <table className="w-full text-right">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">الملف</th>
                  <th>الحالة</th>
                  <th>الصفوف</th>
                  <th>غير صالح</th>
                  <th>مكرر</th>
                  <th>مراجعة</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="p-3">
                      <p>{job.fileName}</p>
                      <small className="font-mono text-slate-400">
                        {job.id}
                      </small>
                    </td>
                    <td>{job.status}</td>
                    <td>{job.totalRows}</td>
                    <td>{job.invalidRows}</td>
                    <td>{job.duplicateRows}</td>
                    <td>{job.reviewRows ?? "—"}</td>
                    <td className="space-x-2 space-x-reverse">
                      <button
                        onClick={() => show(job.id)}
                        className="text-blue-700"
                      >
                        التقرير
                      </button>
                      {job.checksum === CANONICAL_CHECKSUM &&
                        job.status !== "IMPORTING" && (
                          <button
                            onClick={() => setTrustedJob(job)}
                            className="text-red-700 font-semibold"
                          >
                            {job.status === "PAUSED"
                              ? "استئناف موثوق"
                              : "استيراد موثوق"}
                          </button>
                        )}
                      {job.status === "IMPORTING" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => controlImport(job, "pause")}
                            className="text-amber-700"
                          >
                            إيقاف مؤقت
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => controlImport(job, "cancel")}
                            className="text-red-700"
                          >
                            إلغاء العملية
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {trustedJob && (
          <div className="fixed inset-0 bg-black/50 grid place-items-center p-5">
            <div
              className="bg-white rounded-xl p-6 max-w-2xl w-full"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex gap-3 text-red-800">
                <ShieldAlert className="shrink-0" />
                <div>
                  <h2 className="font-bold text-xl">
                    اعتماد استيراد قاعدة المالك كاملة
                  </h2>
                  <p className="mt-2">
                    سيُعتمد ملف SQLite ذو البصمة المحددة كمصدر موثوق، وتُستورد
                    الأسئلة والتكرارات الداخلية كما هي. تحذيرات جودة المحتوى لن
                    تمنع النشر، بينما تبقى الصفوف غير القابلة للتمثيل خاملة.
                  </p>
                </div>
              </div>
              <label className="block mt-5 text-sm font-semibold">
                اكتب عبارة التأكيد التالية: <code dir="ltr">{APPROVAL}</code>
              </label>
              <input
                dir="ltr"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full border rounded p-3 mt-2 font-mono"
                autoFocus
              />
              <div className="flex gap-3 mt-5">
                <button
                  disabled={busy || confirmation !== APPROVAL}
                  onClick={executeTrustedImport}
                  className="bg-red-700 disabled:bg-slate-300 text-white rounded px-5 py-2"
                >
                  {busy ? "جارٍ التنفيذ…" : "اعتماد وتنفيذ"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setTrustedJob(null);
                    setConfirmation("");
                  }}
                  className="border rounded px-5 py-2"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
        {report && (
          <div className="fixed inset-0 bg-black/40 grid place-items-center p-5">
            <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-auto">
              <h2 className="font-bold text-xl">تقرير الاستيراد</h2>
              <div className="grid grid-cols-3 gap-3 my-4">
                {[
                  "totalRows",
                  "validRows",
                  "invalidRows",
                  "duplicateRows",
                  "reviewRows",
                  "importedRows",
                ].map((key) => (
                  <div key={key} className="bg-slate-50 rounded p-3">
                    <small>{key}</small>
                    <p className="text-xl font-bold">
                      {String(report[key] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
              <pre
                dir="ltr"
                className="text-xs bg-slate-950 text-white p-4 rounded overflow-auto"
              >
                {JSON.stringify(report, null, 2)}
              </pre>
              <button
                onClick={() => setReport(null)}
                className="border rounded px-4 py-2 mt-4"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
