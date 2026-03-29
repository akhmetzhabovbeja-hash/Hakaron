import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";

interface CandidateItem {
  id: number;
  candidate_id: number;
  full_name: string;
  email: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  status: string;
  source: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидание", color: "bg-gray-100 text-gray-600" },
  processing: { label: "Анализ", color: "bg-blue-100 text-blue-600" },
  analyzed: { label: "Проанализирован", color: "bg-yellow-100 text-yellow-700" },
  hr_review: { label: "HR рассматривает", color: "bg-orange-100 text-orange-700" },
  sent_to_manager: { label: "У руководителя", color: "bg-indigo-100 text-indigo-700" },
  approved: { label: "Одобрен", color: "bg-green-100 text-green-700" },
  rejected: { label: "Отклонён", color: "bg-red-100 text-red-700" },
};

function getScoreColor(score: number) {
  if (score >= 85) return "text-green-600 bg-green-100";
  if (score >= 60) return "text-yellow-600 bg-yellow-100";
  return "text-red-600 bg-red-100";
}

export default function HrReportVacancyCandidatesPage() {
  const { id } = useParams();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/hr/vacancies/${id}`),
      apiClient.get(`/hr/vacancies/${id}/candidates`),
    ])
      .then(([vRes, cRes]) => {
        setVacancyTitle(vRes.data.title);
        setCandidates(cRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <Link
        to="/hr/reports"
        className="text-primary-600 hover:underline text-sm"
      >
        &larr; Назад к отчётам
      </Link>

      <h2 className="text-3xl font-bold mt-4 mb-2">{vacancyTitle}</h2>
      <p className="text-gray-600 mb-8">
        Абитуриенты: {candidates.length}
      </p>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Пока нет абитуриентов</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c) => {
            const st = statusLabels[c.status] || statusLabels.pending;
            return (
              <Link
                key={c.id}
                to={`/hr/reports/candidate/${c.id}`}
                className="bg-white rounded-xl shadow p-5 flex items-center justify-between hover:shadow-md transition"
              >
                <div>
                  <h3 className="font-semibold">{c.full_name}</h3>
                  <p className="text-gray-400 text-sm">{c.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                    {st.label}
                  </span>
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${getScoreColor(c.total_score)}`}>
                    {c.total_score}/100
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
