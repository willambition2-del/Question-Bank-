"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Save, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function NewExamModelPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: "",
    title: "",
    slug: "",
    durationMinutes: 60,
    difficulty: "MEDIUM",
    year: new Date().getFullYear(),
    governorate: "",
    description: "",
    isOfficial: true,
  });

  const { data: subjectsData } = useSWR("/admin/subjects?limit=50", fetcher);
  const subjects = subjectsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subjectId || !formData.title || !formData.slug || !formData.durationMinutes) {
      alert("الرجاء تعبئة الحقول المطلوبة.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        year: formData.year ? parseInt(formData.year.toString()) : undefined,
        durationMinutes: parseInt(formData.durationMinutes.toString())
      };
      
      await api.post("/exam-models", payload);
      router.push("/exam-models");
    } catch (err: any) {
      alert("حدث خطأ: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/exam-models" className="p-2 hover:bg-slate-200 rounded-full">
              <ArrowRight className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">إضافة نموذج امتحاني جديد</h1>
              <p className="text-slate-500 mt-2">إنشاء Quiz جديد يمكن للطلاب اختباره.</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">المادة *</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">اختر المادة...</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">مستوى الصعوبة</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="EASY">سهل</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="HARD">صعب</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">عنوان النموذج *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: الاختبار النصفي للأحياء"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">الرابط الدائم (Slug) *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-left"
                  placeholder="biology-midterm-2025"
                  required
                  dir="ltr"
                  maxLength={180}
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  title="أحرف إنجليزية صغيرة وأرقام وشرطات فقط"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">المدة (بالدقائق) *</label>
                <input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  min="1"
                  max="1440"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">السنة</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  min="1900"
                  max="2200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">المحافظة</label>
                <input
                  type="text"
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  maxLength={120}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                maxLength={2000}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOfficial"
                checked={formData.isOfficial}
                onChange={(e) => setFormData({ ...formData, isOfficial: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="isOfficial" className="text-sm font-medium">نموذج رسمي</label>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? "جاري الحفظ..." : "حفظ النموذج"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
