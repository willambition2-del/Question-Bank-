"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Plus, Settings, BrainCircuit, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import api from "@/lib/axios";

type Model = {
  id: string;
  internalName: string;
  remoteModelId: string;
  providerId: string;
  enabled: boolean;
  qualityClass?: number;
  provider?: { displayNameInternal: string };
};

export default function ModelsPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/models', (url) => api.get(url));
  const models: Model[] = response?.data || [];

  const { data: providersResponse } = useSWR('/admin/intelligent-services/providers', (url) => api.get(url));
  const providers = providersResponse?.data || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    providerId: "",
    internalName: "",
    remoteModelId: "",
    enabled: true,
    supportsText: true,
    supportsVision: false,
    supportsImages: false,
    supportsEmbeddings: false,
    supportsJsonMode: true,
    supportsStreaming: true,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latencyClass: 3,
    qualityClass: 4,
  });

  const openNew = () => {
    setEditingModel(null);
    setFormData({ 
      providerId: providers.length > 0 ? providers[0].id : "", 
      internalName: "", remoteModelId: "", enabled: true, 
      supportsText: true, supportsVision: false, supportsImages: false, 
      supportsEmbeddings: false, supportsJsonMode: true, supportsStreaming: true, 
      contextWindow: 128000, maxOutputTokens: 4096, 
      inputCostPerMillion: 0, outputCostPerMillion: 0, 
      latencyClass: 3, qualityClass: 4 
    });
    setIsModalOpen(true);
  };

  const openEdit = (m: Model) => {
    setEditingModel(m);
    setFormData({
      ...formData,
      providerId: m.providerId,
      internalName: m.internalName,
      remoteModelId: m.remoteModelId,
      enabled: m.enabled,
      qualityClass: m.qualityClass || 4,
      // Need to populate other fields if they exist in the model DTO from API
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData };
      if (editingModel) {
        await api.patch(`/admin/intelligent-services/models/${editingModel.id}`, payload);
      } else {
        await api.post('/admin/intelligent-services/models', payload);
      }
      setIsModalOpen(false);
      mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من تعطيل هذا النموذج؟")) {
      try {
        await api.delete(`/admin/intelligent-services/models/${id}`);
        mutate();
      } catch (err) {
        alert("حدث خطأ أثناء التعطيل");
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة النماذج (Models)</h1>
            <p className="text-gray-500 mt-2">تسجيل النماذج وارتباطها بالمزودين وقدراتها (Vision, Reasoning).</p>
          </div>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" />
            إضافة نموذج
          </button>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل البيانات.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد نماذج حالياً
              </div>
            )}
            {models.map((m) => (
              <div key={m.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-2 h-full ${m.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className={`w-8 h-8 ${m.enabled ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <h3 className="font-bold text-gray-900">{m.internalName}</h3>
                      <p className="text-sm text-gray-500 font-mono">{m.remoteModelId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-blue-600">
                      <Settings className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">المزوّد:</span>
                    <span className="font-medium text-gray-900">{m.provider?.displayNameInternal || m.providerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">فئة الجودة:</span>
                    <span className="font-medium text-gray-900">{m.qualityClass || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">الحالة:</span>
                    <span className={m.enabled ? "text-green-600 font-medium" : "text-gray-400"}>
                      {m.enabled ? "مفعّل" : "معطّل"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-bold text-gray-900">{editingModel ? "تعديل نموذج" : "إضافة نموذج"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المزوّد</label>
                  <select required disabled={!!editingModel} value={formData.providerId} onChange={(e) => setFormData({...formData, providerId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="" disabled>اختر المزوّد</option>
                    {providers.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.displayNameInternal}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الداخلي</label>
                    <input required value={formData.internalName} onChange={(e) => setFormData({...formData, internalName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remote Model ID</label>
                    <input required value={formData.remoteModelId} onChange={(e) => setFormData({...formData, remoteModelId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Context Window</label>
                    <input type="number" required value={formData.contextWindow} onChange={(e) => setFormData({...formData, contextWindow: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Output Tokens</label>
                    <input type="number" required value={formData.maxOutputTokens} onChange={(e) => setFormData({...formData, maxOutputTokens: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 bg-gray-50 p-4 rounded-lg">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.supportsText} onChange={(e) => setFormData({...formData, supportsText: e.target.checked})} /> <span className="text-sm">نص</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.supportsVision} onChange={(e) => setFormData({...formData, supportsVision: e.target.checked})} /> <span className="text-sm">رؤية</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.supportsJsonMode} onChange={(e) => setFormData({...formData, supportsJsonMode: e.target.checked})} /> <span className="text-sm">JSON Mode</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.supportsStreaming} onChange={(e) => setFormData({...formData, supportsStreaming: e.target.checked})} /> <span className="text-sm">Streaming</span></label>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="enabledModel" checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} className="rounded text-blue-600" />
                  <label htmlFor="enabledModel" className="text-sm font-medium text-gray-700">تفعيل النموذج</label>
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
