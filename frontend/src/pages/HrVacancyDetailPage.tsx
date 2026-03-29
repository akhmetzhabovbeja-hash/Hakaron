import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";

interface QuestionItem {
  id: number;
  text: string;
  category: string;
  order: number;
}

interface VacancyDetail {
  id: number;
  title: string;
  description: string;
  requirements: string;
  is_active: boolean;
  questions: QuestionItem[];
}

interface CandidateItem {
  id: number;
  full_name: string;
  vacancy_title: string;
  total_score: number;
  status: string;
}

export default function HrVacancyDetailPage() {
  const { id } = useParams();
  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/hr/vacancies/${id}`),
      apiClient.get("/hr/candidates"),
    ])
      .then(([vRes, cRes]) => {
        setVacancy(vRes.data);
        setCandidates(
          cRes.data.filter(
            (c: CandidateItem) => c.vacancy_title === vRes.data.title
          )
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (!vacancy) return <p className="text-red-500">Вакансия не найдена</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/hr" className="text-primary-600 hover:underline text-sm">
          &larr; Назад к вакансиям
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{vacancy.title}</h2>
            <p className="text-gray-600 mt-2">{vacancy.description}</p>
            {vacancy.requirements && (
              <p className="text-gray-500 mt-2 text-sm">
                <strong>Требования:</strong> {vacancy.requirements}
              </p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              vacancy.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {vacancy.is_active ? "Активна" : "Закрыта"}
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Вопросы анкеты ({vacancy.questions.length})
        </h3>
        {vacancy.questions.length === 0 ? (
          <p className="text-gray-500">Вопросы ещё не назначены</p>
        ) : (
          <ol className="space-y-2">
            {vacancy.questions.map((q, i) => (
              <li key={q.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-400 font-mono text-sm w-6">
                  {i + 1}.
                </span>
                <span className="text-sm">{q.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Candidates for this vacancy */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Кандидаты ({candidates.length})
        </h3>
        {candidates.length === 0 ? (
          <p className="text-gray-500">Пока нет кандидатов для этой вакансии</p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <Link
                key={c.id}
                to={`/hr/candidates/${c.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <span className="font-medium">{c.full_name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full font-bold text-sm ${
                      c.total_score >= 85
                        ? "text-green-600 bg-green-100"
                        : c.total_score >= 60
                        ? "text-yellow-600 bg-yellow-100"
                        : "text-red-600 bg-red-100"
                    }`}
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
    </div>
  );
}
