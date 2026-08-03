"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";

type Provider = {
  id: string;
  displayNameInternal: string;
  credentialMasked?: string;
};
type Discovered = { providerId: string; models: string[] };
type Readiness = { status: string; blockers: string[] };

export default function IntelligentServicesSetupPage() {
  const { data: readinessResponse, mutate: refreshReadiness } = useSWR(
    "/admin/intelligent-services/readiness",
    (url) => api.get(url),
  );
  const readiness = readinessResponse?.data as Readiness | undefined;
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [capabilities, setCapabilities] = useState({
    vision: false,
    embeddings: false,
    json: true,
    streaming: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await api.post("/admin/intelligent-services/providers", {
        key: String(form.get("key")),
        displayNameInternal: String(form.get("displayNameInternal")),
        providerType: String(form.get("providerType")),
        baseUrl: String(form.get("baseUrl")),
        authType: String(form.get("authType")),
        apiKey: String(form.get("apiKey")),
        enabled: false,
        timeoutMs: 30000,
        maxRetries: 2,
      });
      setProvider(response.data);
      event.currentTarget.reset();
      setStep(2);
      setMessage("تم حفظ المزوّد بنجاح. قم باكتشاف النماذج الآن.");
    } catch {
      setMessage("حدث خطأ بالاتصال. تأكد من الرابط والمفتاح.");
    } finally {
      setBusy(false);
    }
  }

  async function discoverModels() {
    if (!provider) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post(
        `/admin/intelligent-services/providers/${provider.id}/discover-models`,
      );
      const discovered = response.data as Discovered;
      setModels(discovered.models);
      setSelectedModel(discovered.models[0] ?? "");
      setMessage(
        discovered.models.length
          ? "تم اكتشاف النماذج. اختر النموذج المناسب أدناه."
          : "لم يتم العثور على نماذج. تأكد من إعدادات المزوّد.",
      );
    } catch {
      setModels([]);
      setMessage("فشل استرداد النماذج. تحقق من مفتاح API والرابط.");
    } finally {
      setBusy(false);
    }
  }

  async function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider || !selectedModel.trim()) return;
    setBusy(true);
    try {
      const response = await api.post("/admin/intelligent-services/models", {
        providerId: provider.id,
        internalName: selectedModel.trim(),
        remoteModelId: selectedModel.trim(),
        enabled: true,
        supportsText: true,
        supportsVision: capabilities.vision,
        supportsImages: capabilities.vision,
        supportsEmbeddings: capabilities.embeddings,
        supportsJsonMode: capabilities.json,
        supportsStreaming: capabilities.streaming,
        contextWindow: 8192,
        maxOutputTokens: 2048,
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
        imageCost: 0,
        currency: "USD",
        latencyClass: 3,
        qualityClass: 3,
      });
      await api.patch(`/admin/intelligent-services/providers/${provider.id}`, {
        enabled: true,
      });
      await api.post(
        `/admin/intelligent-services/models/${response.data.id}/test`,
      );
      setStep(3);
      setMessage("تم حفظ النموذج وتفعيله كنموذج رئيسي بنجاح.");
    } catch {
      setMessage("فشل حفظ النموذج. قد يكون موجوداً مسبقاً.");
    } finally {
      setBusy(false);
      void refreshReadiness();
    }
  }

  async function createSafeRoutes() {
    if (!provider) return;
    setBusy(true);
    try {
      const modelsResponse = await api.get(
        "/admin/intelligent-services/models",
      );
      const model = modelsResponse.data.find(
        (item: { providerId: string; remoteModelId: string }) =>
          item.providerId === provider.id &&
          item.remoteModelId === selectedModel,
      );
      if (!model) throw new Error("MODEL_NOT_FOUND");
      const tasks = [
        "TEXT_CHAT",
        "QUESTION_EXPLANATION",
        "QUESTION_HINT",
        "STUDY_ASSISTANT",
      ];
      if (capabilities.vision) tasks.push("IMAGE_QUESTION_ANALYSIS");
      if (capabilities.embeddings) tasks.push("EMBEDDING_GENERATION");
      for (const taskType of tasks) {
        await api.post("/admin/intelligent-services/routes", {
          taskType,
          nameInternal: `staging-${taskType.toLowerCase()}`,
          enabled: true,
          strategy: "PRIORITY",
          primaryModelId: model.id,
          maxFallbacks: 1,
          requiredVision: taskType === "IMAGE_QUESTION_ANALYSIS",
          requiredJsonMode: false,
          minContextWindow: 0,
          timeoutMs: 30000,
          temperature: 0.2,
          maxOutputTokens: 1024,
          candidates: [
            { modelId: model.id, priority: 1, weight: 1, enabled: true },
          ],
        });
      }
      setStep(4);
      setMessage(
        "تم إنشاء التوجيه بنجاح. راجع الحالة للتحقق من جاهزية النظام.",
      );
      await refreshReadiness();
    } catch {
      setMessage("فشلت عملية التوجيه. تأكد من صلاحيات النموذج.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <p className="text-sm font-semibold text-blue-700">مرحباً SUPER_ADMIN</p>
          <h1 className="text-3xl font-bold text-slate-950">
            إعداد منصة الخدمات الذكية
          </h1>
          <p className="mt-2 text-slate-600">
            سيقوم هذا المعالج بمساعدتك في إعداد المزوّد، النماذج، والتوجيه الذكي للمهام.
          </p>
        </header>

        <div className="mb-8 grid grid-cols-4 gap-3">
          {["المزوّد", "النماذج", "التوجيه", "الانتهاء"].map((label, index) => (
            <div
              key={label}
              className={`rounded-xl border p-3 text-sm ${step >= index + 1 ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-500"}`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {message}
          </div>
        )}

        {step === 1 && (
          <form
            onSubmit={saveProvider}
            className="max-w-2xl space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <input
              name="displayNameInternal"
              required
              placeholder="الاسم الداخلي للمزوّد"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              name="key"
              required
              pattern="[a-z0-9][a-z0-9_-]{1,63}"
              placeholder="provider_key"
              dir="ltr"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              name="providerType"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="OPENAI_COMPATIBLE">OpenAI Compatible</option>
              <option value="GOOGLE_COMPATIBLE">Google Compatible</option>
              <option value="CUSTOM_HTTP">Custom HTTP</option>
            </select>
            <input
              name="baseUrl"
              type="url"
              required
              placeholder="https://provider.example/v1"
              dir="ltr"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select name="authType" className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="BEARER">Bearer token</option>
              <option value="API_KEY_HEADER">API key header</option>
              <option value="QUERY_PARAMETER">Query parameter</option>
              <option value="NONE">No authentication</option>
            </select>
            <input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder="API key"
              dir="ltr"
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-blue-700 px-5 py-3 text-white disabled:opacity-50"
            >
              {busy ? "جاري الحفظ..." : "حفظ ومتابعة"}
            </button>
          </form>
        )}

        {step === 2 && (
          <section className="max-w-2xl space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <button
              onClick={discoverModels}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border px-4 py-2"
            >
              <RefreshCw className="h-4 w-4" /> اكتشاف النماذج
            </button>
            <form onSubmit={saveModel} className="space-y-4">
              <input
                list="discovered-models"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                required
                placeholder="اختر النموذج"
                dir="ltr"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <datalist id="discovered-models">
                {models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["vision", "تحليل الصور"],
                  ["embeddings", "Embeddings"],
                  ["json", "JSON mode"],
                  ["streaming", "Streaming"],
                ].map(([key, label]) => (
                  <label key={key} className="flex gap-2 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      checked={capabilities[key as keyof typeof capabilities]}
                      onChange={(event) =>
                        setCapabilities({
                          ...capabilities,
                          [key]: event.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                disabled={busy}
                className="rounded-lg bg-blue-700 px-5 py-3 text-white"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "حفظ النموذج ومتابعة"
                )}
              </button>
            </form>
          </section>
        )}

        {step === 3 && (
          <section className="max-w-2xl rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">توجيه المهام الذكي</h2>
            <p className="my-3 text-slate-600">
              سيتم إنشاء طرق التوجيه الأساسية بناءً على هذا النموذج لمهام المحادثة وتحليل الأسئلة. هل ترغب في المتابعة؟
            </p>
            <button
              onClick={createSafeRoutes}
              disabled={busy}
              className="rounded-lg bg-blue-700 px-5 py-3 text-white"
            >
              إنشاء التوجيه
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="max-w-2xl rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-blue-700" />
              <h2 className="text-xl font-bold">حالة الجاهزية</h2>
            </div>
            <p className="mt-4 text-lg font-semibold">
              {readiness?.status ?? "جاري الفحص..."}
            </p>
            {readiness?.blockers?.length ? (
              <ul className="mt-3 list-inside list-disc text-red-700">
                {readiness.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" /> الخدمات الذكية جاهزة للعمل بالكامل.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
