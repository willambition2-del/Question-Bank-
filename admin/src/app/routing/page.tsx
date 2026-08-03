"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import { ArrowDownUp, Save, GripVertical, AlertTriangle, Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import api from "@/lib/axios";

type Route = {
  id: string;
  taskType: string;
  primaryModelId?: string;
  strategy: string;
  enabled: boolean;
  candidates: { modelId: string; priority: number }[];
};

type Model = {
  id: string;
  internalName: string;
};

export default function RoutingPage() {
  const { data: response, error, isLoading, mutate } = useSWR('/admin/intelligent-services/routes', (url) => api.get(url));
  const routes: Route[] = response?.data || [];

  const { data: modelsResponse } = useSWR('/admin/intelligent-services/models', (url) => api.get(url));
  const models: Model[] = modelsResponse?.data || [];
  
  const [savingId, setSavingId] = useState<string | null>(null);

  const getModelName = (id?: string) => {
    if (!id) return "غير محدد";
    return models.find(m => m.id === id)?.internalName || id;
  };

  const handleDragEnd = async (result: any, route: Route) => {
    if (!result.destination) return;
    
    const items = Array.from(route.candidates);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update priorities based on new order
    const updatedCandidates = items.map((item, index) => ({
      ...item,
      priority: index + 1
    }));

    // Optimistic UI update could be done here with SWR mutate, but we'll do it safely
    setSavingId(route.id);
    try {
      await api.patch(`/admin/intelligent-services/routes/${route.id}`, {
        candidates: updatedCandidates
      });
      mutate();
    } catch (err) {
      alert("فشل تحديث الترتيب");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">توجيه المهام (Task Routing)</h1>
            <p className="text-gray-500 mt-2">تحديد النموذج الأساسي والبدائل (Fallbacks) لكل مهمة ذكية وترتيبها.</p>
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
            {routes.length === 0 && (
              <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد سياسات توجيه مهام حالياً
              </div>
            )}
            {routes.map((route) => (
              <div key={route.id} className={`bg-white p-6 rounded-xl border ${savingId === route.id ? 'border-blue-300 shadow-blue-100' : 'border-gray-200'} shadow-sm relative transition-all`}>
                {savingId === route.id && (
                  <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{route.taskType}</h2>
                    <p className="text-sm text-gray-500 mt-1">الاستراتيجية: <span className="font-mono bg-gray-100 px-1 rounded">{route.strategy}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={route.enabled ? "px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium" : "px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"}>
                      {route.enabled ? "نشط" : "معطّل"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className="flex-1 w-full">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">النموذج الأساسي</h4>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <span className="font-bold text-blue-900">{getModelName(route.primaryModelId)}</span>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Primary</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full md:border-r border-gray-200 md:pr-8">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center justify-between">
                      <span>البدائل (Fallbacks) بالترتيب</span>
                      <ArrowDownUp className="w-4 h-4 text-gray-400" />
                    </h4>
                    <DragDropContext onDragEnd={(res) => handleDragEnd(res, route)}>
                      <Droppable droppableId={`droppable-${route.id}`}>
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 min-h-[50px]">
                            {route.candidates.sort((a, b) => a.priority - b.priority).map((candidate, index) => (
                              <Draggable key={candidate.modelId} draggableId={candidate.modelId} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                                      snapshot.isDragging ? 'shadow-lg bg-blue-50 border-blue-200' : ''
                                    }`}
                                  >
                                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                    <span className="font-medium text-gray-700">{getModelName(candidate.modelId)}</span>
                                    <span className="mr-auto text-xs text-gray-400">أولوية: {candidate.priority}</span>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {route.candidates.length === 0 && (
                              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm text-center">
                                لا يوجد بدائل. ستفشل المهمة إذا تعطل الأساسي.
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                    
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
