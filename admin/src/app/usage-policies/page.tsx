"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { Save, Settings, Loader2, AlertTriangle, Info } from "lucide-react";
import api from "@/lib/axios";

type UsagePolicy = {
  taskType: string;
  enabled: boolean;
  userDailyLimit: number;
  userMonthlyLimit: number;
  globalDailyLimit: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxImages: number;
  maxImageSize: number;
  maxDocumentPages: number;
  allowedRoles: string[];
  subscriptionTier?: string;
  cooldownSeconds: number;
};

export default function UsagePoliciesPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/usage-policies', (url) => api.get(url));
  const policies: UsagePolicy[] = response?.data || [];

  const [editingType, setEditingType] = useState<string | null>(null);
  const [formData, setFormData] = useState<UsagePolicy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (policy: UsagePolicy) => {
    setEditingType(policy.taskType);
    setFormData({ ...policy });
  };

  const cancelEdit = () => {
    setEditingType(null);
    setFormData(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setIsSaving(true);
    try {
      await api.patch(`/admin/intelligent-services/usage-policies/${formData.taskType}`, formData);
      mutate();
      setEditingType(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">سياسات الاستخدام (Usage Policies)</h1>
            <p className="text-gray-500 mt-2">إدارة الحصص، الحدود، وفترات التبريد (Cooldown) للخدمات الذكية.</p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> حدث خطأ أثناء تحميل البيانات.
          </div>
        ) : (
          <div className="space-y-6">
            {policies.length === 0 && (
              <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد سياسات مسجلة
              </div>
            )}
            {policies.map((policy) => (
              <div key={policy.taskType} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    {policy.taskType}
                    {!policy.enabled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-normal">معطّل</span>}
                  </h2>
                  {editingType !== policy.taskType && (
                    <button onClick={() => startEdit(policy)} className="text-sm bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> تعديل السياسة
                    </button>
                  )}
                </div>

                {editingType === policy.taskType && formData ? (
                  <form onSubmit={handleSave} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد اليومي للمستخدم</label>
                        <input type="number" required min="0" value={formData.userDailyLimit} onChange={(e) => setFormData({...formData, userDailyLimit: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد الشهري للمستخدم</label>
                        <input type="number" required min="0" value={formData.userMonthlyLimit} onChange={(e) => setFormData({...formData, userMonthlyLimit: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد اليومي العام (Global)</label>
                        <input type="number" required min="0" value={formData.globalDailyLimit} onChange={(e) => setFormData({...formData, globalDailyLimit: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">فترة التبريد (ثواني)</label>
                        <input type="number" required min="0" max="86400" value={formData.cooldownSeconds} onChange={(e) => setFormData({...formData, cooldownSeconds: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للمقاطع (Input Tokens)</label>
                        <input type="number" required min="1" value={formData.maxInputTokens} onChange={(e) => setFormData({...formData, maxInputTokens: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للإخراج (Output Tokens)</label>
                        <input type="number" required min="1" value={formData.maxOutputTokens} onChange={(e) => setFormData({...formData, maxOutputTokens: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      
                      <div className="md:col-span-3 flex items-center gap-2 mt-2 pt-4 border-t border-gray-100">
                        <input type="checkbox" id={`enabled-${policy.taskType}`} checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} className="rounded text-blue-600" />
                        <label htmlFor={`enabled-${policy.taskType}`} className="text-sm font-medium text-gray-700">السماح بتنفيذ هذا النوع من المهام</label>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                      <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ التغييرات
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الحد اليومي (للمستخدم)</p>
                        <p className="font-bold text-gray-900">{policy.userDailyLimit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الحد الشهري (للمستخدم)</p>
                        <p className="font-bold text-gray-900">{policy.userMonthlyLimit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الحد العام (للنظام)</p>
                        <p className="font-bold text-gray-900">{policy.globalDailyLimit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">التبريد (Cooldown)</p>
                        <p className="font-bold text-gray-900">{policy.cooldownSeconds} ثانية</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الحد الأقصى للـ Input</p>
                        <p className="font-bold text-gray-900">{policy.maxInputTokens}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الحد الأقصى للـ Output</p>
                        <p className="font-bold text-gray-900">{policy.maxOutputTokens}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500 mb-1">الأدوار المسموحة</p>
                        <div className="flex gap-2">
                          {policy.allowedRoles.map(role => (
                            <span key={role} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{role}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
