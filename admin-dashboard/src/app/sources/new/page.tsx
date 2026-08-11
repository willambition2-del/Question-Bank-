"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Save, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSourcePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "MINISTRY_EXAM",
    year: new Date().getFullYear(),
    governorate: "",
    description: "",
    referenceUrl: "",
    isOfficial: true,
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert("اسم المصدر مطلوب.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        year: formData.year ? parseInt(formData.year.toString()) : undefined,
      };
      
      // Some endpoints might be /admin/sources or just /sources. According to the backend controller, it's just /sources. Wait, I should use the correct one based on my audit. Let's try /sources.
      await api.post("/sources", payload);
      router.push("/sources");
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
            <Link href="/sources" className="p-2 hover:bg-slate-200 rounded-full">
              <ArrowRight className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">إضافة مصدر جديد</h1>
              <p className="text-slate-500 mt-2">إنشاء مرجع جديد لأسئلة المنصة.</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">اسم المصدر *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: اختبار وزارة التربية 2025"
                  required
                  maxLength={180}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">النوع</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="MINISTRY_EXAM">اختبار وزاري</option>
                  <option value="MINISTRY_MODEL">نموذج وزاري</option>
                  <option value="TEXTBOOK">كتاب مدرسي</option>
                  <option value="TEACHER">معلم</option>
                  <option value="IMPORT">استيراد</option>
                  <option value="GENERATED">توليد ذكاء اصطناعي</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">السنة</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value ? Number(e.target.value) : new Date().getFullYear() })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  min="1900"
                  max="2200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">المحافظة (اختياري)</label>
                <input
                  type="text"
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: بغداد"
                  maxLength={120}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">الوصف (اختياري)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                placeholder="تفاصيل إضافية حول المصدر..."
                maxLength={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">رابط المرجع (URL اختياري)</label>
              <input
                type="url"
                value={formData.referenceUrl}
                onChange={(e) => setFormData({ ...formData, referenceUrl: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-left"
                placeholder="https://..."
                dir="ltr"
                maxLength={2000}
              />
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isOfficial"
                  checked={formData.isOfficial}
                  onChange={(e) => setFormData({ ...formData, isOfficial: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="isOfficial" className="text-sm font-medium">مصدر رسمي</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium">نشط</label>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? "جاري الحفظ..." : "حفظ المصدر"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
