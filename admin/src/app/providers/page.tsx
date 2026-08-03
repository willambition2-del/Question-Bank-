"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Plus, Settings, Trash2, ShieldCheck, ServerCrash, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import api from "@/lib/axios";

type Provider = {
  id: string;
  key: string;
  displayNameInternal: string;
  providerType: string;
  baseUrl: string;
  enabled: boolean;
  maskedApiKey?: string;
};

export default function ProvidersPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/providers', (url) => api.get(url));
  const providers: Provider[] = response?.data || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    displayNameInternal: "",
    providerType: "OPENAI_COMPATIBLE",
    baseUrl: "",
    authType: "BEARER_TOKEN",
    apiKey: "",
    enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Don't send empty apiKey if editing (so we don't overwrite with empty)
      const payload = { ...formData };
      if (editingProvider && !payload.apiKey) {
        delete (payload as any).apiKey;
      }
      if (editingProvider) {
        await api.patch(`/admin/intelligent-services/providers/${editingProvider.id}`, payload);
      } else {
        await api.post('/admin/intelligent-services/providers', payload);
      }
      setIsModalOpen(false);
      mutate();
    } catch (err: any) {
      alert(err?.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      await api.post(`/admin/intelligent-services/providers/${id}/test`);
      alert("تم اختبار الاتصال بنجاح!");
    } catch (err: any) {
      alert("فشل الاتصال: " + (err?.response?.data?.message || "غير معروف"));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من تعطيل/حذف هذا المزوّد؟")) {
      try {
        await api.delete(`/admin/intelligent-services/providers/${id}`);
        mutate();
      } catch (err) {
        alert("حدث خطأ أثناء الحذف");
      }
    }
  };

  const openNew = () => {
    setEditingProvider(null);
    setFormData({ key: "", displayNameInternal: "", providerType: "OPENAI_COMPATIBLE", baseUrl: "", authType: "BEARER_TOKEN", apiKey: "", enabled: true });
    setShowKey(false);
    setIsModalOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditingProvider(p);
    setFormData({ 
      key: p.key, 
      displayNameInternal: p.displayNameInternal, 
      providerType: p.providerType, 
      baseUrl: p.baseUrl, 
      authType: "BEARER_TOKEN", 
      apiKey: "", 
      enabled: p.enabled 
    });
    setShowKey(false);
    setIsModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto relative">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">مزوّدو الخدمات الذكية</h1>
            <p className="text-gray-500 mt-2">إدارة مفاتيح الـ API ونقاط الاتصال لمزودي خدمات الذكاء الاصطناعي.</p>
          </div>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" />
            إضافة مزوّد
          </button>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل البيانات.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                <tr>
                  <th className="py-3 px-6 font-medium">الاسم الداخلي</th>
                  <th className="py-3 px-6 font-medium">النوع</th>
                  <th className="py-3 px-6 font-medium">الرابط الأساسي (Base URL)</th>
                  <th className="py-3 px-6 font-medium">الحالة</th>
                  <th className="py-3 px-6 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">لا يوجد مزوّدين حالياً</td></tr>
                )}
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-900 font-medium">{p.displayNameInternal}</td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono">{p.providerType}</td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono" dir="ltr">{p.baseUrl}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.enabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ServerCrash className="w-3.5 h-3.5" />}
                        {p.enabled ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td className="py-4 px-6 flex items-center gap-3">
                      <button onClick={() => handleTest(p.id)} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 hover:bg-gray-200">
                        اختبار
                      </button>
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-blue-600 transition-colors" title="إعدادات المفاتيح والتعديل">
                        <Settings className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="حذف ناعم">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-900">{editingProvider ? "تعديل مزوّد" : "إضافة مزوّد"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الداخلي</label>
                    <input required value={formData.displayNameInternal} onChange={(e) => setFormData({...formData, displayNameInternal: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المفتاح التعريفي (Key)</label>
                    <input required disabled={!!editingProvider} value={formData.key} onChange={(e) => setFormData({...formData, key: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" dir="ltr" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرابط الأساسي (Base URL)</label>
                  <input required value={formData.baseUrl} onChange={(e) => setFormData({...formData, baseUrl: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" placeholder="https://api.openai.com/v1" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <div className="relative">
                    <input 
                      type={showKey ? "text" : "password"} 
                      value={formData.apiKey} 
                      onChange={(e) => setFormData({...formData, apiKey: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-lg text-sm pl-10" 
                      dir="ltr" 
                      placeholder={editingProvider ? "اتركه فارغاً للحفاظ على المفتاح الحالي (Masked)" : "sk-..."}
                      autoComplete="off"
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {editingProvider && editingProvider.maskedApiKey && !formData.apiKey && (
                    <p className="text-xs text-green-600 mt-1">يوجد مفتاح محفوظ ({editingProvider.maskedApiKey})</p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="enabled" checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} className="rounded text-blue-600" />
                  <label htmlFor="enabled" className="text-sm font-medium text-gray-700">تفعيل المزوّد</label>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
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
