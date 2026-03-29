import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface Vacancy {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
}

export default function HrDashboardPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/hr/vacancies")
      .then((res) => setVacancies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">HR: Вакансии</h2>
        <Link
          to="/hr/vacancies/create"
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          + Создать вакансию
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">Вакансий пока нет</p>
          <p>Создайте первую вакансию и добавьте к ней вопросы</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vacancies.map((v) => (
            <Link
              key={v.id}
              to={`/hr/vacancies/${v.id}`}
              className="bg-white rounded-xl shadow p-6 hover:shadow-md transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{v.title}</h3>
                  <p className="text-gray-500 mt-1">{v.description}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    v.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {v.is_active ? "Активна" : "Закрыта"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Analyzed candidates section */}
      <HrAnalyzedCandidates />
    </div>
  );
}

function HrAnalyzedCandidates() {
  const [candidates, setCandidates] = useState<
    {
      id: number;
      full_name: string;
      vacancy_title: string;
      total_score: number;
      status: string;
    }[]
  >([]);

  useEffect(() => {
    apiClient
      .get("/hr/candidates")
      .then((res) => setCandidates(res.data))
      .catch(() => {});
  }, []);

  if (candidates.length === 0) return null;

  return (
    <div className="mt-10">
      <h3 className="text-2xl font-bold mb-4">
        Кандидаты после AI-анализа ({candidates.length})
      </h3>
      <div className="grid gap-3">
        {candidates.map((c) => (
          <Link
            key={c.id}
            to={`/hr/candidates/${c.id}`}
            className="bg-white rounded-xl shadow p-4 flex items-center justify-between hover:shadow-md transition"
          >
            <div>
              <span className="font-semibold">{c.full_name}</span>
              <span className="text-gray-400 ml-3">{c.vacancy_title}</span>
            </div>
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
    </div>
  );
}
