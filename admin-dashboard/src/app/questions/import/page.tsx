"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { 
  ArrowRight, 
  UploadCloud, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Play,
  Clock,
  AlertTriangle
} from "lucide-react";

type ImportJob = {
  id: string;
  originalFilename: string;
  status: string;
  totalQuestions: number;
  importedQuestions: number;
  failedQuestions: number;
  createdAt: string;
};

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ImportQuestionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: errorsData } = useSWR(
    selectedJobId ? `/admin/question-imports/${selectedJobId}/errors` : null, 
    fetcher
  );

  const { data, mutate } = useSWR('/admin/question-imports?limit=10', fetcher, { refreshInterval: 5000 });
  const importJobs: ImportJob[] = data?.data || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await api.post("/admin/question-imports/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        }
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      alert("تم رفع الملف بنجاح وبدأت عملية الفحص.");
      mutate();
    } catch (err: any) {
      alert("فشل رفع الملف: " + (err.response?.data?.message || "خطأ غير معروف"));
    } finally {
      setIsUploading(false);
    }
  };

  const executeJobAction = async (jobId: string, action: 'validate' | 'confirm' | 'cancel') => {
    try {
      await api.post(`/admin/question-imports/${jobId}/${action}`);
      mutate();
    } catch (err: any) {
      alert(`حدث خطأ أثناء إجراء ${action}: ` + (err.response?.data?.message || ""));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> مكتمل</span>;
      case 'FAILED': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs flex items-center gap-1"><XCircle className="w-3 h-3"/> فشل</span>;
      case 'PROCESSING': 
      case 'VALIDATING': 
      case 'IMPORTING': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> جاري المعالجة</span>;
      case 'PENDING': 
      case 'VALIDATED': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> بانتظار التأكيد</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">{status}</span>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <Link href="/questions" className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm mb-2 w-fit transition-colors">
            <ArrowRight className="w-4 h-4" /> العودة لبنك الأسئلة
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UploadCloud className="w-8 h-8 text-blue-600" />
            استيراد الأسئلة دفعة واحدة
          </h1>
          <p className="text-gray-500 mt-2">
            يمكنك رفع ملفات Excel (.xlsx) أو CSV لرفع آلاف الأسئلة دفعة واحدة. 
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Upload Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">رفع ملف جديد</h2>
            </div>
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-10 h-10" />
              </div>
              <p className="text-gray-700 font-medium mb-1">اختر ملفاً من جهازك</p>
              <p className="text-sm text-gray-500 mb-6">الصيغ المدعومة: .xlsx, .csv, .json, .zip (الحد الأقصى 2MB)</p>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.csv,.json,.zip"
                className="hidden" 
              />
              
              {!file ? (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-6 py-2.5 rounded-lg transition-colors border border-gray-300"
                >
                  استعراض الملفات...
                </button>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-medium w-full flex justify-between items-center">
                    <span className="truncate" dir="ltr">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-700 ml-2">&times;</button>
                  </div>
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-lg transition-colors shadow-sm w-full flex justify-center items-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    بدء الرفع
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">تعليمات الاستيراد</h2>
            </div>
            <div className="p-6 bg-amber-50/50 flex-1">
              <div className="flex gap-3 text-amber-800 mb-4 font-medium">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>تأكد من مطابقة ملفك للصيغة المعتمدة لتجنب الأخطاء أثناء الاستيراد.</p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>يجب أن يحتوي الملف على عمود <code>content</code> لنص السؤال.</li>
                <li>لتحديد نوع السؤال استخدم عمود <code>type</code> (مثال: <code>MULTIPLE_CHOICE</code>).</li>
                <li>يجب توفير الخيارات في أعمدة منفصلة (<code>option_a</code>, <code>option_b</code>, الخ).</li>
                <li>تحديد الإجابة الصحيحة في عمود <code>correct_option</code> (مثال: <code>A</code> أو <code>B</code>).</li>
                <li>مستوى الصعوبة في عمود <code>difficulty</code> برقم من 1 إلى 5.</li>
              </ul>
            </div>
          </div>

        </div>

        {/* History Section */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">سجل عمليات الاستيراد</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-3 px-6 font-medium">اسم الملف</th>
                  <th className="py-3 px-6 font-medium">تاريخ الرفع</th>
                  <th className="py-3 px-6 font-medium">الحالة</th>
                  <th className="py-3 px-6 font-medium text-center">إجمالي الأسئلة</th>
                  <th className="py-3 px-6 font-medium text-center">الناجحة</th>
                  <th className="py-3 px-6 font-medium text-center">الفاشلة</th>
                  <th className="py-3 px-6 font-medium text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      لا يوجد أي عمليات استيراد سابقة
                    </td>
                  </tr>
                ) : importJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium text-gray-900" dir="ltr">{job.originalFilename}</td>
                    <td className="py-4 px-6 text-gray-500" dir="ltr">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="py-4 px-6">{getStatusBadge(job.status)}</td>
                    <td className="py-4 px-6 text-center text-gray-700">{job.totalQuestions || 0}</td>
                    <td className="py-4 px-6 text-center text-green-600">{job.importedQuestions || 0}</td>
                    <td className="py-4 px-6 text-center text-red-600">{job.failedQuestions || 0}</td>
                    <td className="py-4 px-6 text-center">
                      {job.status === 'VALIDATED' && (
                        <button 
                          onClick={() => executeJobAction(job.id, 'confirm')}
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 mx-auto transition-colors"
                        >
                          <Play className="w-3 h-3" /> اعتماد الاستيراد
                        </button>
                      )}
                      {job.status === 'PENDING' && (
                        <button 
                          onClick={() => executeJobAction(job.id, 'validate')}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 mx-auto transition-colors"
                        >
                          فحص الملف
                        </button>
                      )}
                      {(job.failedQuestions > 0 || job.status === 'FAILED') && (
                        <button 
                          onClick={() => setSelectedJobId(job.id)}
                          className="mt-2 bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-xs font-medium flex items-center gap-1 mx-auto transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3" /> تقرير الأخطاء
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedJobId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl flex flex-col max-h-[80vh]">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> تقرير الأخطاء
                </h3>
                <button onClick={() => setSelectedJobId(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                {!errorsData ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                ) : errorsData.data?.length === 0 ? (
                  <p className="text-center text-gray-500">لا توجد أخطاء مسجلة أو تعذر جلبها.</p>
                ) : (
                  <div className="space-y-3">
                    {errorsData.data?.map((err: any, idx: number) => (
                      <div key={idx} className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-red-800 text-sm">صف {err.rowNumber || 'غير محدد'}</span>
                        </div>
                        <p className="text-sm text-red-600">{err.error || err.message || JSON.stringify(err)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t bg-white flex justify-end">
                <button onClick={() => setSelectedJobId(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">إغلاق</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
