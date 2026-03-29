import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface VacancyWithCount {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  candidateCount?: number;
}

export default function HrReportsPage() {
  const [vacancies, setVacancies] = useState<VacancyWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/hr/vacancies")
      .then(async (res) => {
        const vacs = res.data as VacancyWithCount[];
        // Fetch candidate counts for each vacancy
        const withCounts = await Promise.all(
          vacs.map(async (v) => {
            try {
              const cRes = await apiClient.get(
                `/hr/vacancies/${v.id}/candidates`
              );
              return { ...v, candidateCount: cRes.data.length };
            } catch {
              return { ...v, candidateCount: 0 };
            }
          })
        );
        setVacancies(withCounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Отчёты</h2>
      <p className="text-gray-600 mb-8">
        Выберите вакансию для просмотра кандидатов и их анализа
      </p>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Вакансий пока нет</p>
          <p className="text-sm mt-1">
            Создайте вакансию в разделе "Вакансии"
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vacancies.map((v) => (
            <Link
              key={v.id}
              to={`/hr/reports/vacancy/${v.id}`}
              className="bg-white rounded-xl shadow p-6 hover:shadow-md transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{v.title}</h3>
                  <p className="text-gray-500 mt-1 text-sm">{v.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">
                      {v.candidateCount ?? 0}
                    </div>
                    <div className="text-xs text-gray-400">кандидатов</div>
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
                  <span className="text-gray-400">&rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
