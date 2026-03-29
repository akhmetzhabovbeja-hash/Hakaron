import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface CandidateItem {
  id: number;
  candidate_id: number;
  full_name: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  status: string;
  source: string;
}

function getScoreColor(score: number) {
  if (score >= 85) return "text-green-600 bg-green-100";
  if (score >= 60) return "text-yellow-600 bg-yellow-100";
  return "text-red-600 bg-red-100";
}

export default function ManagerDashboardPage() {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/manager/candidates")
      .then((res) => setCandidates(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Панель руководителя</h2>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Нет кандидатов на рассмотрение</p>
          <p className="text-sm mt-1">
            HR-отдел пока не отправил кандидатов для вашего одобрения
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((c) => (
            <Link
              key={c.id}
              to={`/manager/candidate/${c.id}`}
              className="bg-white rounded-xl shadow p-6 flex items-center justify-between hover:shadow-md transition"
            >
              <div>
                <h3 className="text-lg font-semibold">{c.full_name}</h3>
                <p className="text-gray-500">{c.vacancy_title}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  Match: {Math.round(c.vacancy_match * 100)}%
                </span>
                <span
                  className={`px-3 py-1 rounded-full font-bold ${getScoreColor(c.total_score)}`}
                >
                  {c.total_score}/100
                </span>
                <span className="text-gray-400">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
