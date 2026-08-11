"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { 
  Users, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  UserX, 
  UserCheck, 
  Loader2 
} from "lucide-react";
import api from "@/lib/axios";

type User = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
  });
  if (search) queryParams.append("search", search);
  if (roleFilter) queryParams.append("role", roleFilter);
  if (statusFilter) queryParams.append("isActive", statusFilter);

  const { data, error, isLoading, mutate } = useSWR(
    `/admin/users?${queryParams.toString()}`,
    (url) => api.get(url)
  );

  const users: User[] = data?.data?.data || [];
  const meta = data?.data?.meta || { totalPages: 1 };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`هل أنت متأكد من تغيير صلاحية المستخدم إلى ${newRole}؟`)) return;
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ أثناء تغيير الصلاحية");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    const actionText = currentStatus ? "تعطيل" : "تفعيل";
    if (!confirm(`هل أنت متأكد من ${actionText} حساب هذا المستخدم؟`)) return;
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive: !currentStatus });
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || `حدث خطأ أثناء ${actionText} الحساب`);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              إدارة المستخدمين
            </h1>
            <p className="text-gray-500 mt-2">
              عرض وإدارة حسابات الطلاب والمشرفين وتحديد صلاحياتهم.
            </p>
          </div>
        </header>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute right-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ابحث بالاسم، المعرف، البريد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">جميع الأدوار</option>
              <option value="SUPER_ADMIN">مدير نظام</option>
              <option value="ADMIN">مشرف</option>
              <option value="REVIEWER">مراجع</option>
              <option value="STUDENT">طالب</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">جميع الحالات</option>
              <option value="true">نشط</option>
              <option value="false">محظور</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              حدث خطأ أثناء تحميل بيانات المستخدمين.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                  <tr>
                    <th className="py-3 px-6 font-medium">الاسم / المعرف</th>
                    <th className="py-3 px-6 font-medium">معلومات التواصل</th>
                    <th className="py-3 px-6 font-medium">الصلاحية</th>
                    <th className="py-3 px-6 font-medium">الحالة</th>
                    <th className="py-3 px-6 font-medium">تاريخ التسجيل</th>
                    <th className="py-3 px-6 font-medium text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        لا يوجد مستخدمين لعرضهم
                      </td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-1" dir="ltr">@{user.username}</div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {user.email && <div className="text-gray-600">{user.email}</div>}
                        {user.phone && <div className="text-gray-500 mt-1" dir="ltr">{user.phone}</div>}
                        {!user.email && !user.phone && <span className="text-gray-400">غير متوفر</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                          user.role === 'REVIEWER' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                            <ShieldCheck className="w-4 h-4" /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
                            <ShieldAlert className="w-4 h-4" /> محظور
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500" dir="ltr">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-center space-x-2 space-x-reverse">
                        <select 
                          className="text-xs border rounded p-1 bg-white"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="STUDENT">طالب</option>
                          <option value="REVIEWER">مراجع</option>
                          <option value="ADMIN">مشرف</option>
                          <option value="SUPER_ADMIN">مدير نظام</option>
                        </select>
                        <button 
                          onClick={() => handleStatusToggle(user.id, user.isActive)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.isActive 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                          title={user.isActive ? "حظر المستخدم" : "تفعيل المستخدم"}
                        >
                          {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {!isLoading && meta.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
              >
                السابق
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                صفحة {page} من {meta.totalPages}
              </span>
              <button 
                disabled={page === meta.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
