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

const statusColors: Record<string, string> = {
  pending: "bg-gray-400",
  processing: "bg-blue-400",
  analyzed: "bg-yellow-400",
  hr_review: "bg-orange-400",
  sent_to_manager: "bg-indigo-400",
  approved: "bg-green-500",
  rejected: "bg-red-400",
};

export default function HrStatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/hr/statistics")
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Загрузка статистики...</p>;
  if (!stats) return <p className="text-red-500">Ошибка загрузки</p>;

  const maxDistCount = Math.max(...stats.score_distribution.map((d) => d.count), 1);
  const totalByStatus = Object.values(stats.by_status).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Статистика</h2>

      {/* Top cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-primary-600">{stats.total_candidates}</div>
          <div className="text-sm text-gray-500 mt-1">Всего абитуриентов</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.avg_score}</div>
          <div className="text-sm text-gray-500 mt-1">Средний балл</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-green-600">{Math.round(stats.avg_match * 100)}%</div>
          <div className="text-sm text-gray-500 mt-1">Среднее соответствие</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-orange-600">{stats.ai_flags_count}</div>
          <div className="text-sm text-gray-500 mt-1">С AI-флагами</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Status funnel */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">Воронка статусов</h3>
          <div className="space-y-3">
            {Object.entries(stats.by_status).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{statusLabels[status] || status}</span>
                  <span className="font-medium">{count} ({Math.round((count / totalByStatus) * 100)}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${statusColors[status] || "bg-gray-400"}`}
                    style={{ width: `${(count / totalByStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score distribution */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">Распределение баллов</h3>
          <div className="space-y-3">
            {stats.score_distribution.map((d) => (
              <div key={d.range}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{d.range}</span>
                  <span className="font-medium">{d.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      d.range.startsWith("90") ? "bg-green-500" :
                      d.range.startsWith("80") ? "bg-green-400" :
                      d.range.startsWith("70") ? "bg-yellow-400" :
                      d.range.startsWith("60") ? "bg-orange-400" : "bg-red-400"
                    }`}
                    style={{ width: `${(d.count / maxDistCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By vacancy */}
      {stats.by_vacancy.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">По программам</h3>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-2">Программа</th>
                <th className="pb-2 text-center">Абитуриентов</th>
                <th className="pb-2 text-center">Средний балл</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_vacancy.map((v) => (
                <tr key={v.title} className="border-b last:border-0">
                  <td className="py-3 font-medium">{v.title}</td>
                  <td className="py-3 text-center">{v.count}</td>
                  <td className="py-3 text-center">
                    <span className={`font-bold ${
                      v.avg_score >= 80 ? "text-green-600" :
                      v.avg_score >= 60 ? "text-yellow-600" : "text-red-600"
                    }`}>
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
