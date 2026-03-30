import { useEffect, useState } from "react";
import apiClient from "../api/client";

interface Stats {
  total_candidates: number;
  avg_score: number;
  avg_match: number;
  by_status: Record<string, number>;
  by_vacancy: { title: string; count: number; avg_score: number }[];
  score_distribution: { range: string; count: number }[];
  ai_flags_count: number;
}

const statusLabels: Record<string, string> = {
  pending: "Ожидание",
  processing: "Анализ",
  analyzed: "Проанализирован",
  hr_review: "HR рассматривает",
  sent_to_manager: "У комиссии",
  approved: "Зачислен",
  rejected: "Отклонён",
};

export default function HrStatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/hr/statistics").then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Загрузка статистики...</p>;
  if (!stats) return <p className="text-red-500">Ошибка загрузки</p>;

  const maxDistCount = Math.max(...stats.score_distribution.map((d) => d.count), 1);
  const totalByStatus = Object.values(stats.by_status).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight text-dark mb-10">Статистика</h1>

      {/* Top cards */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { value: stats.total_candidates, label: "Всего абитуриентов", color: "text-dark" },
          { value: stats.avg_score, label: "Средний балл", color: "text-dark" },
          { value: `${Math.round(stats.avg_match * 100)}%`, label: "Среднее соответствие", color: "text-dark" },
          { value: stats.ai_flags_count, label: "С AI-флагами", color: "text-red-600" },
        ].map((card, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl p-6 text-center">
            <div className={`text-4xl font-extrabold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-2 uppercase tracking-wide font-semibold">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-10">
        {/* Status funnel */}
        <div className="border border-gray-100 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-dark mb-6">Воронка статусов</h3>
          <div className="space-y-4">
            {Object.entries(stats.by_status).map(([status, count]) => {
              const pct = Math.round((count / totalByStatus) * 100);
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">{statusLabels[status] || status}</span>
                    <span className="font-bold text-dark">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-dark transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score distribution */}
        <div className="border border-gray-100 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-dark mb-6">Распределение баллов</h3>
          <div className="space-y-4">
            {stats.score_distribution.map((d) => {
              const isTop = d.range.startsWith("90") || d.range.startsWith("80");
              return (
                <div key={d.range}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">{d.range}</span>
                    <span className="font-bold text-dark">{d.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${isTop ? "bg-dark" : d.range.startsWith("0") ? "bg-red-400" : "bg-gray-400"}`}
                      style={{ width: `${(d.count / maxDistCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* By vacancy table */}
      {stats.by_vacancy.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-dark mb-6">По программам</h3>
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-3 text-left">Программа</th>
                <th className="pb-3 text-center">Абитуриентов</th>
                <th className="pb-3 text-center">Средний балл</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_vacancy.map((v) => (
                <tr key={v.title} className="border-b border-gray-50 last:border-0">
                  <td className="py-4 font-semibold text-dark">{v.title}</td>
                  <td className="py-4 text-center text-gray-600">{v.count}</td>
                  <td className="py-4 text-center">
                    <span className={`font-bold ${v.avg_score >= 80 ? "text-dark" : v.avg_score >= 60 ? "text-gray-600" : "text-red-600"}`}>
                      {v.avg_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
