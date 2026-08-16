"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import {
  BrainCircuit,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Server,
  Cpu,
  RotateCcw,
  Search,
  Users,
  ShieldAlert,
  Info,
} from "lucide-react";
import api from "@/lib/axios";

type Provider = {
  id: string;
  key: string;
  displayNameInternal: string;
  providerType: string;
  enabled: boolean;
  credentialConfigured?: boolean;
};

type Model = {
  id: string;
  internalName: string;
  remoteModelId: string;
  providerId: string;
  enabled: boolean;
  provider?: { displayNameInternal: string };
};

type AssistantSettings = {
  id: string;
  enabled: boolean;
  providerId?: string | null;
  modelId?: string | null;
  fallbackModelId?: string | null;
  userMessageLimit: number;
  resetPeriod: "DAILY" | "WEEKLY" | "MONTHLY" | "NEVER";
  limitMessage: string;
  updatedAt?: string;
};

type UserUsageItem = {
  id: string;
  name: string;
  email?: string;
  username: string;
  role: string;
  used: number;
  limit: number;
  remaining: number | null;
  periodKey: string;
  resetPeriod: string;
  resetAt?: string | null;
  lastUsedAt?: string | null;
};

export default function AssistantSettingsPage() {
  const {
    data: settingsRes,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR("/admin/intelligent-services/assistant-settings", (url) =>
    api.get(url)
  );

  const { data: providersRes } = useSWR(
    "/admin/intelligent-services/providers",
    (url) => api.get(url)
  );
  const providers: Provider[] = providersRes?.data || [];

  const { data: modelsRes } = useSWR(
    "/admin/intelligent-services/models",
    (url) => api.get(url)
  );
  const models: Model[] = modelsRes?.data || [];

  // Form State
  const [formData, setFormData] = useState<AssistantSettings>({
    id: "default",
    enabled: false,
    providerId: "",
    modelId: "",
    fallbackModelId: "",
    userMessageLimit: 20,
    resetPeriod: "DAILY",
    limitMessage: "لقد وصلت إلى الحد المسموح للمساعد الذكي.",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // User Usage State
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data: usageRes, isLoading: usageLoading } = useSWR(
    `/admin/intelligent-services/user-usage?search=${encodeURIComponent(
      searchQuery
    )}&page=${page}&limit=10`,
    (url) => api.get(url)
  );
  const usageData = usageRes?.data;
  const usageItems: UserUsageItem[] = usageData?.items || [];

  useEffect(() => {
    if (settingsRes?.data) {
      setFormData({
        id: "default",
        enabled: Boolean(settingsRes.data.enabled),
        providerId: settingsRes.data.providerId || "",
        modelId: settingsRes.data.modelId || "",
        fallbackModelId: settingsRes.data.fallbackModelId || "",
        userMessageLimit: Number(settingsRes.data.userMessageLimit ?? 20),
        resetPeriod: settingsRes.data.resetPeriod || "DAILY",
        limitMessage:
          settingsRes.data.limitMessage ||
          "لقد وصلت إلى الحد المسموح للمساعد الذكي.",
      });
    }
  }, [settingsRes]);

  // Filter models by selected provider
  const availableModels = formData.providerId
    ? models.filter((m) => m.providerId === formData.providerId)
    : models;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      await api.patch("/admin/intelligent-services/assistant-settings", {
        enabled: formData.enabled,
        providerId: formData.providerId || null,
        modelId: formData.modelId || null,
        fallbackModelId: formData.fallbackModelId || null,
        userMessageLimit: Number(formData.userMessageLimit),
        resetPeriod: formData.resetPeriod,
        limitMessage: formData.limitMessage.trim(),
      });
      await mutateSettings();
      setFeedback({
        type: "success",
        message: "تم حفظ إعدادات المساعد الذكي وتحديث السياسات بنجاح!",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          "حدث خطأ أثناء حفظ الإعدادات. يرجى التحقق من المدخلات.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const periodLabel = (period: string) => {
    switch (period) {
      case "DAILY":
        return "يوميًا (DAILY)";
      case "WEEKLY":
        return "أسبوعيًا (WEEKLY)";
      case "MONTHLY":
        return "شهريًا (MONTHLY)";
      case "NEVER":
        return "بدون تجديد تلقائي (NEVER)";
      default:
        return period;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900">
                  المساعد الذكي (الإعدادات والحدود)
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                  التحكم المركزي في تشغيل المساعد، المزوّد، النموذج الأساسي، وحدود
                  رسائل المستخدمين.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${
                formData.enabled
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  formData.enabled ? "bg-green-600 animate-pulse" : "bg-red-600"
                }`}
              />
              {formData.enabled ? "المساعد مفعّل" : "المساعد معطّل"}
            </span>
          </div>
        </header>

        {settingsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : settingsError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold">فشل في تحميل إعدادات المساعد الذكي</p>
              <p className="text-sm mt-1">تأكد من تشغيل الخادم واتصال قاعدة البيانات.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Feedback Alert */}
            {feedback && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  feedback.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                )}
                <span className="font-medium text-sm">{feedback.message}</span>
              </div>
            )}

            {/* Main Settings Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-blue-600" />
                    إعدادات الموديل والتحكم التشغيلي
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    تغيير المزوّد أو النموذج يتم تطبيقه فورًا على جميع طلبات الطلاب
                    دون الحاجة لإعادة تشغيل النظام.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6">
                {/* 1. Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="space-y-1">
                    <label
                      htmlFor="ai-enable-switch"
                      className="font-bold text-gray-900 text-sm cursor-pointer"
                    >
                      تشغيل المساعد الذكي للطلاب
                    </label>
                    <p className="text-xs text-gray-500">
                      عند التعطيل، لن يتمكن الطلاب من إرسال رسائل أو طلب شروحات،
                      وستظهر لهم رسالة تفيد بعدم التوفر.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="ai-enable-switch"
                      checked={formData.enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Provider Dropdown */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      مزوّد الخدمة (Provider)
                    </label>
                    <div className="relative">
                      <select
                        value={formData.providerId || ""}
                        onChange={(e) => {
                          const newProviderId = e.target.value;
                          setFormData({
                            ...formData,
                            providerId: newProviderId,
                            modelId: "",
                            fallbackModelId: "",
                          });
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      >
                        <option value="">-- اختر مزوّد الخدمة --</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.displayNameInternal} ({p.providerType})
                            {!p.enabled ? " - [معطّل]" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <Server className="w-3.5 h-3.5" />
                      المزوّدون المتاحون في النظام (مفاتيح API مشفرة وآمنة).
                    </p>
                  </div>

                  {/* Model Dropdown */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      النموذج الأساسي (Model)
                    </label>
                    <select
                      value={formData.modelId || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, modelId: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                      <option value="">-- اختر النموذج الأساسي --</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.internalName} ({m.remoteModelId})
                          {!m.enabled ? " - [معطّل]" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      النموذج المستخدم للرد على أسئلة وشروحات الطلاب.
                    </p>
                  </div>

                  {/* Fallback Model Dropdown */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      النموذج الاحتياطي (Fallback Model)
                    </label>
                    <select
                      value={formData.fallbackModelId || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fallbackModelId: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                      <option value="">-- بدون نموذج احتياطي (اختياري) --</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.internalName} ({m.remoteModelId})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" />
                      يتم الانتقال له تلقائيًا في حال تعطل النموذج الأساسي.
                    </p>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* 2. Usage Quotas & Limits */}
                <div>
                  <h3 className="font-bold text-gray-900 text-md mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                    حدود استخدام رسائل الذكاء الاصطناعي لكل مستخدم
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Message Limit */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        حد الرسائل لكل مستخدم
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.userMessageLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            userMessageLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                      <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        أدخل <strong>0</strong> لجعل الاستخدام غير محدود
                        (Unlimited).
                      </p>
                    </div>

                    {/* Reset Period */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        فترة إعادة ضبط الحد (Reset Period)
                      </label>
                      <select
                        value={formData.resetPeriod}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            resetPeriod: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      >
                        <option value="DAILY">يوميًا (DAILY - يتجدد كل منتصف ليل UTC)</option>
                        <option value="WEEKLY">أسبوعيًا (WEEKLY - يتجدد كل بداية أسبوع)</option>
                        <option value="MONTHLY">شهريًا (MONTHLY - يتجدد أول كل شهر)</option>
                        <option value="NEVER">بدون تجديد (NEVER - رصيد ثابت دائم)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1.5">
                        الفترة الزمنية التي يتم بعدها تصفير استهلاك الطالب.
                      </p>
                    </div>

                    {/* Limit Exceeded Message */}
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        رسالة التنبيه عند بلوغ الحد
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.limitMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            limitMessage: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">
                        الرسالة التي ستظهر للطالب في تطبيق الموبايل عند نفاد الرصيد.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    حفظ التعديلات المركزية
                  </button>
                </div>
              </form>
            </div>

            {/* 3. User Consumption Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    استهلاك المستخدمين في الفترة الحالية (
                    {periodLabel(formData.resetPeriod)})
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    متابعة حية للرسائل المستهلكة والمتبقية لكل مستخدم في المنصة.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-gray-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو البريد..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full ps-9 pe-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {usageLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : usageItems.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium">لم يتم العثور على مستخدمين مطابقين للبحث.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-4">المستخدم</th>
                        <th className="p-4">البريد / المعرف</th>
                        <th className="p-4">الدور</th>
                        <th className="p-4">المستهلك</th>
                        <th className="p-4">الحد المسموح</th>
                        <th className="p-4">المتبقي</th>
                        <th className="p-4">حالة الحصة</th>
                        <th className="p-4">آخر نشاط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usageItems.map((u) => {
                        const isExhausted =
                          u.limit > 0 && u.used >= u.limit;
                        const isUnlimited = u.limit === 0;

                        return (
                          <tr key={u.id} className="hover:bg-gray-50/80 transition">
                            <td className="p-4 font-bold text-gray-900">
                              {u.name}
                            </td>
                            <td className="p-4 text-gray-600 font-mono text-xs">
                              {u.email || `@${u.username}`}
                            </td>
                            <td className="p-4">
                              <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-blue-600 font-mono">
                              {u.used}
                            </td>
                            <td className="p-4 text-gray-700 font-mono">
                              {isUnlimited ? "غير محدود" : u.limit}
                            </td>
                            <td className="p-4 font-bold font-mono">
                              {isUnlimited ? (
                                <span className="text-green-600">∞</span>
                              ) : isExhausted ? (
                                <span className="text-red-600">0</span>
                              ) : (
                                <span className="text-green-600">
                                  {u.remaining}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {isUnlimited ? (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold">
                                  غير محدود
                                </span>
                              ) : isExhausted ? (
                                <span className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-bold">
                                  تم بلوغ الحد
                                </span>
                              ) : (
                                <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-bold">
                                  نشط
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-gray-400 text-xs">
                              {u.lastUsedAt
                                ? new Date(u.lastUsedAt).toLocaleString("ar-EG")
                                : "لا يوجد استخدام"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {usageData?.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        عرض الصفحة {usageData.page} من {usageData.totalPages} (إجمالي{" "}
                        {usageData.total} مستخدم)
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          السابق
                        </button>
                        <button
                          disabled={page >= usageData.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          التالي
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
