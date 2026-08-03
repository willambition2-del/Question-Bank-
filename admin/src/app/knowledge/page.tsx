"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Plus, Database, Search, Library, FileText, Loader2, AlertTriangle, FileSearch } from "lucide-react";
import api from "@/lib/axios";
import Link from "next/link";

type KnowledgeBase = {
  id: string;
  name: string;
  description?: string;
  scope: string;
  enabled: boolean;
  documentCount?: number;
};

export default function KnowledgeBasesPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/knowledge-bases', (url) => api.get(url));
  const bases: KnowledgeBase[] = response?.data || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: "GLOBAL",
  });
  const [testData, setTestData] = useState({ id: "", query: "" });
  const [testResults, setTestResults] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/admin/knowledge-bases', formData);
      setIsModalOpen(false);
      mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    try {
      const res = await api.post(`/admin/knowledge-bases/${testData.id}/test-search`, { query: testData.query });
      setTestResults(res.data);
    } catch (err: any) {
      alert("خطأ في البحث: " + err?.response?.data?.message);
      setTestResults(null);
    } finally {
      setIsTesting(false);
    }
  };

  const openNew = () => {
    setFormData({ name: "", description: "", scope: "GLOBAL" });
    setIsModalOpen(true);
  };

  const openTest = (id: string) => {
    setTestData({ id, query: "" });
    setTestResults(null);
    setIsTestModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">قواعد المعرفة (RAG)</h1>
            <p className="text-gray-500 mt-2">إدارة مساحات السياق (Context) ومصادر الاسترجاع المعرفي.</p>
          </div>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" />
            قاعدة جديدة
          </button>
        </header>

        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">تنبيه تقني حول بيئة العمل (Production Verification)</p>
            <p>وفقاً للوثائق التقنية، ميزات <b>Vector Search</b> و <b>Embeddings</b> غير مكتملة. البحث الحالي يعتمد حصرياً على المطابقة النصية <b>KEYWORD MODE</b>.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل البيانات.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {bases.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد قواعد معرفة حالياً
              </div>
            )}
            {bases.map((kb) => (
              <div key={kb.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{kb.name}</h3>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                            <Library className="w-3 h-3" /> {kb.scope}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                            KEYWORD_ONLY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-6 min-h-[40px]">{kb.description}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <Link href={`/documents?kbId=${kb.id}`} className="text-sm bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> المستندات
                    </Link>
                  </div>
                  <button onClick={() => openTest(kb.id)} className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                    <Search className="w-4 h-4" /> اختبار البحث
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: New KB */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-900">قاعدة معرفة جديدة</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم القاعدة</label>
                  <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نطاق التغطية (Scope)</label>
                  <select required value={formData.scope} onChange={(e) => setFormData({...formData, scope: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="GLOBAL">عام (GLOBAL)</option>
                    <option value="SUBJECT">مادة دراسية (SUBJECT)</option>
                    <option value="GRADE">صف دراسي (GRADE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">وصف (اختياري)</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm h-20" />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Test Search */}
        {isTestModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-bold text-gray-900">اختبار استرجاع النصوص (Keyword Mode)</h3>
                <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 flex flex-col h-full overflow-hidden">
                <form onSubmit={handleTest} className="flex gap-3 mb-6 shrink-0">
                  <input required value={testData.query} onChange={(e) => setTestData({...testData, query: e.target.value})} placeholder="اكتب سؤالك هنا للبحث..." className="flex-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <button type="submit" disabled={isTesting} className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2">
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                    بحث
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-4">
                  {!testResults && !isTesting && (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">أدخل استعلامك لرؤية المقاطع المسترجعة</div>
                  )}
                  {testResults?.results?.length === 0 && (
                    <div className="text-center text-gray-500 py-8">لم يتم العثور على أي نتائج مطابقة.</div>
                  )}
                  {testResults?.results?.map((res: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Score: {res.score?.toFixed(4) || "N/A"}</span>
                        <span className="text-xs text-gray-500">مستند: {res.documentId || "Unknown"} | صفحة: {res.pageNumber || "1"}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed font-serif">{res.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
