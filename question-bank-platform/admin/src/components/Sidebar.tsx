"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Server,
  Cpu,
  Waypoints,
  MessageSquareCode,
  BookOpenText,
  FileText,
  ShieldAlert,
  ActivitySquare,
  HeartPulse,
  ListChecks,
  Upload,
  LogOut,
  Users,
  ChevronDown,
  ChevronUp,
  FolderTree,
  BookMarked,
  FileCheck,
  CheckCircle,
  HelpCircle,
  Bell,
  Megaphone,
  Database,
  History,
  Settings,
  BrainCircuit,
  Wrench,
  Gauge
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: any;
};

type NavGroup = {
  name: string;
  icon: any;
  items: NavItem[];
};

export function Sidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "الرئيسية": true,
    "المحتوى": true,
    "المستخدمون": false,
    "الذكاء الاصطناعي": false,
    "التواصل": false,
    "النظام": false,
  });

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const navGroups: NavGroup[] = [
    {
      name: "الرئيسية",
      icon: LayoutDashboard,
      items: [
        { name: "نظرة عامة", href: "/", icon: Gauge },
      ]
    },
    {
      name: "المحتوى",
      icon: FolderTree,
      items: [
        { name: "المنهج", href: "/education", icon: BookOpenText },
        { name: "بنك الأسئلة", href: "/questions", icon: HelpCircle },
        { name: "القطع القرائية", href: "/reading-passages", icon: BookMarked },
        { name: "المصادر", href: "/sources", icon: Database },
        { name: "نماذج الاختبارات", href: "/exam-models", icon: FileText },
        { name: "الاستيراد والتصدير", href: "/questions/import", icon: Upload },
        { name: "جودة المحتوى", href: "/question-quality", icon: CheckCircle },
      ]
    },
    {
      name: "المستخدمون",
      icon: Users,
      items: [
        { name: "إدارة المستخدمين", href: "/users", icon: Users },
        { name: "المحاولات والنتائج", href: "/quiz-attempts", icon: FileCheck },
        { name: "تقدم الطلاب", href: "/student-progress", icon: ActivitySquare },
        { name: "البلاغات والدعم", href: "/support-tickets", icon: ShieldAlert },
      ]
    },
    {
      name: "الذكاء الاصطناعي",
      icon: BrainCircuit,
      items: [
        { name: "الإعداد السريع", href: "/intelligent-services/setup", icon: Wrench },
        { name: "المزوّدون", href: "/providers", icon: Server },
        { name: "النماذج", href: "/models", icon: Cpu },
        { name: "التوجيه", href: "/routing", icon: Waypoints },
        { name: "الموجهات", href: "/prompts", icon: MessageSquareCode },
        { name: "المعرفة والوثائق", href: "/knowledge", icon: BookOpenText },
        { name: "الاستخدام والحدود", href: "/usage-policies", icon: ListChecks },
        { name: "الإحصائيات والتكلفة", href: "/usage-stats", icon: ActivitySquare },
      ]
    },
    {
      name: "التواصل",
      icon: Megaphone,
      items: [
        { name: "الإعلانات", href: "/announcements", icon: Megaphone },
        { name: "الإشعارات", href: "/notifications", icon: Bell },
      ]
    },
    {
      name: "النظام",
      icon: Settings,
      items: [
        { name: "حالة المنصة", href: "/platform-status", icon: HeartPulse },
        { name: "سجلات التدقيق", href: "/audit-logs", icon: History },
        { name: "الصيانة والنسخ", href: "/maintenance", icon: Database },
        { name: "الإعدادات", href: "/settings", icon: Settings },
      ]
    }
  ];

  // Auto-expand group if a child route is active
  useEffect(() => {
    navGroups.forEach(group => {
      const hasActiveChild = group.items.some(item => 
        pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
      );
      if (hasActiveChild) {
        setOpenGroups(prev => ({ ...prev, [group.name]: true }));
      }
    });
  }, [pathname]);

  const handleLogout = async () => {
    const { logoutAction } = await import("@/app/actions/auth");
    await logoutAction();
    window.location.href = "/login";
  };

  return (
    <aside className="w-72 bg-white border-l border-slate-200 h-screen sticky top-0 flex flex-col shadow-sm" dir="rtl">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-indigo-900 tracking-tight">
            لوحة الإدارة
          </h1>
          <p className="text-xs text-indigo-500 font-semibold mt-1">
            SUPER_ADMIN
          </p>
        </div>
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.name} className="space-y-1">
            <button
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <group.icon className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>{group.name}</span>
              </div>
              {openGroups[group.name] ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            
            <div className={`overflow-hidden transition-all duration-300 ${openGroups[group.name] ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
              <div className="space-y-1 pr-6 border-r-2 border-slate-100 mr-5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ml-3 transition-colors ${isActive ? "text-indigo-600" : "text-slate-400"}`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center px-4 py-2.5 rounded-lg text-sm font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm bg-white border border-red-200"
        >
          <LogOut className="w-5 h-5 ml-2" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
