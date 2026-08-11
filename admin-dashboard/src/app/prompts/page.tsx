"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Plus, History, CheckCircle2, MessageSquare, Loader2, AlertTriangle, Play } from "lucide-react";
import api from "@/lib/axios";

type Prompt = {
  id: string;
  key: string;
  nameInternal: string;
  taskType: string;
  systemPrompt: string;
  developerPrompt?: string;
  isActive: boolean;
  version: number;
};

export default function PromptsPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/prompts', (url) => api.get(url));
  const prompts: Prompt[] = response?.data || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    nameInternal: "",
    taskType: "GENERAL_CHAT",
    systemPrompt: "",
    developerPrompt: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/admin/intelligent-services/prompts', formData);
      setIsModalOpen(false);
      mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.post(`/admin/intelligent-services/prompts/${id}/activate`);
      mutate();
    } catch (err: any) {
      alert("فشل تفعيل الإصدار");
    }
  };

  const openNew = () => {
    setFormData({ key: "", nameInternal: "", taskType: "GENERAL_CHAT", systemPrompt: "", developerPrompt: "" });
    setIsModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة قوالب التعليمات (Prompts)</h1>
            <p className="text-gray-500 mt-2">إدارة إصدارات System Prompts و Developer Instructions للنماذج.</p>
          </div>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" />
            إصدار جديد
          </button>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل البيانات.
          </div>
        ) : (
          <div className="space-y-4">
            {prompts.length === 0 && (
              <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد قوالب تعليمات حالياً
              </div>
            )}
            {prompts.map((prompt) => (
              <div key={prompt.id} className={`bg-white p-6 rounded-xl border ${prompt.isActive ? 'border-green-200 shadow-green-50' : 'border-gray-200'} shadow-sm flex items-start gap-4 transition-colors`}>
                <div className={`p-3 rounded-full ${prompt.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {prompt.isActive ? <CheckCircle2 className="w-6 h-6" /> : <History className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        {prompt.nameInternal}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">v{prompt.version}</span>
                      </h3>
                      <p className="text-sm text-gray-500">{prompt.taskType} - {prompt.key}</p>
                    </div>
                    {!prompt.isActive && (
                      <button onClick={() => handleActivate(prompt.id)} className="text-sm bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center gap-2">
                        <Play className="w-4 h-4" /> تفعيل هذا الإصدار
                      </button>
                    )}
                    {prompt.isActive && (
                      <span className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium border border-green-100">
                        الإصدار النشط حالياً
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">System Prompt</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono" dir="auto">
                      {prompt.systemPrompt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-bold text-gray-900">إضافة إصدار جديد</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الداخلي</label>
                    <input required value={formData.nameInternal} onChange={(e) => setFormData({...formData, nameInternal: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">مفتاح القالب (Key)</label>
                    <input required value={formData.key} onChange={(e) => setFormData({...formData, key: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" dir="ltr" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع المهمة</label>
                  <select required value={formData.taskType} onChange={(e) => setFormData({...formData, taskType: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="GENERAL_CHAT">محادثة عامة (GENERAL_CHAT)</option>
                    <option value="EXAM_GENERATION">توليد اختبارات (EXAM_GENERATION)</option>
                    <option value="QUESTION_SOLVING">حل أسئلة (QUESTION_SOLVING)</option>
                    <option value="IMAGE_ANALYSIS">تحليل صور (IMAGE_ANALYSIS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                  <textarea required value={formData.systemPrompt} onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono h-32" dir="auto" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Developer Prompt (اختياري)</label>
                  <textarea value={formData.developerPrompt} onChange={(e) => setFormData({...formData, developerPrompt: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono h-24" dir="auto" />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
