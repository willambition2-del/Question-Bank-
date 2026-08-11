"use client";
import { useState, useRef, Suspense } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Trash2, XCircle } from "lucide-react";
import api from "@/lib/axios";
import { useSearchParams } from "next/navigation";

function DocumentsContent() {
  const searchParams = useSearchParams();
  const defaultKbId = searchParams?.get("kbId") || "";

  const { data: kbResponse } = useSWR('/admin/knowledge-bases', (url) => api.get(url));
  const knowledgeBases = kbResponse?.data || [];

  const [selectedKb, setSelectedKb] = useState(defaultKbId);
  const { data: docResponse, mutate, error, isLoading } = useSWR(selectedKb ? `/admin/knowledge-bases/${selectedKb}/documents` : null, (url) => api.get(url));
  const documents = docResponse?.data || [];

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    language: "ar",
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKb) return alert("اختر قاعدة معرفة أولاً");
    if (!fileInputRef.current?.files?.[0]) return alert("اختر ملفاً");

    const file = fileInputRef.current.files[0];
    const data = new FormData();
    data.append("file", file);
    data.append("title", formData.title || file.name);
    data.append("language", formData.language);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await api.post(`/admin/knowledge-bases/${selectedKb}/documents`, data, {
        headers: {
          // Next.js API Proxy will automatically pick up formData boundary
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      mutate();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFormData({ title: "", language: "ar" });
    } catch (err: any) {
      alert(err?.response?.data?.message || "فشل الرفع");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من أرشفة/حذف هذا المستند؟")) {
      try {
        await api.delete(`/admin/knowledge-documents/${id}`);
        mutate();
      } catch (err) {
        alert("فشل الحذف");
      }
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.post(`/admin/knowledge-documents/${id}/reprocess`);
      alert("تم إرسال طلب إعادة المعالجة. يرجى التحديث لاحقاً.");
      mutate();
    } catch (err) {
      alert("فشل طلب إعادة المعالجة");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">المستندات والمعالجة</h1>
          <p className="text-gray-500 mt-2">رفع المستندات (PDF, TXT) وإضافتها لقواعد المعرفة.</p>
        </header>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            رفع مستند جديد
          </h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">قاعدة المعرفة</label>
              <select required value={selectedKb} onChange={(e) => setSelectedKb(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50">
                <option value="" disabled>اختر القاعدة...</option>
                {knowledgeBases.map((kb: any) => (
                  <option key={kb.id} value={kb.id}>{kb.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">عنوان المستند</label>
              <input required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="يستخدم اسم الملف افتراضياً" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">الملف (PDF, TXT)</label>
              <input type="file" ref={fileInputRef} required accept=".pdf,.txt,.docx,.md" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            <div className="md:col-span-1">
              <button type="submit" disabled={isUploading || !selectedKb} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed h-[38px] flex justify-center items-center gap-2">
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress}%
                  </>
                ) : (
                  "رفع ومعالجة"
                )}
              </button>
            </div>
          </form>
          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">قائمة المستندات</h3>
            {!selectedKb && <span className="text-sm text-gray-500">الرجاء اختيار قاعدة معرفة لعرض مستنداتها</span>}
          </div>
          
          {selectedKb && isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : selectedKb && error ? (
            <div className="bg-red-50 text-red-700 p-4">حدث خطأ أثناء تحميل المستندات.</div>
          ) : selectedKb && documents.length === 0 ? (
            <div className="py-12 text-center text-gray-500">لا يوجد مستندات في هذه القاعدة</div>
          ) : (
            <table className="w-full text-right">
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-gray-400" />
                        <div>
                          <h4 className="font-bold text-gray-900">{doc.title}</h4>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{doc.id} • {doc.language || 'ar'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">الصفحات: <b>{doc.pageCount || '?'}</b></span>
                        <span className="text-sm text-gray-600">المقاطع (Chunks): <b>{doc.chunkCount || '?'}</b></span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {doc.status === 'READY' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> تمت المعالجة
                        </span>
                      )}
                      {(doc.status === 'PROCESSING' || doc.status === 'QUEUED') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> قيد المعالجة
                        </span>
                      )}
                      {doc.status === 'FAILED' && (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3.5 h-3.5" /> فشل
                          </span>
                          {doc.failureReason && <span className="text-xs text-red-500 max-w-xs">{doc.failureReason}</span>}
                        </div>
                      )}
                      {doc.status === 'OCR_DISABLED' && (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="w-3.5 h-3.5" /> تعذر المعالجة (OCR معطّل)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                       <div className="flex items-center gap-2">
                        {(doc.status === 'FAILED' || doc.status === 'OCR_DISABLED') && (
                          <button onClick={() => handleReprocess(doc.id)} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 hover:bg-gray-200">إعادة معالجة</button>
                        )}
                        <button onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <DocumentsContent />
    </Suspense>
  );
}
