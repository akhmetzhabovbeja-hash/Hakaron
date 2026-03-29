import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface Vacancy {
  id: number;
  title: string;
  description: string;
  requirements: string;
  is_active: boolean;
}

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/vacancies/")
      .then((res) => setVacancies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Программы</h2>
      <p className="text-gray-600 mb-8">
        Выберите программу и подайте заявку
      </p>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Программ пока нет</p>
          <p className="text-sm mt-1">Загляните позже</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vacancies.map((v) => (
            <Link
              key={v.id}
              to={`/questionnaire/${v.id}`}
              className="bg-white rounded-xl shadow p-6 hover:shadow-md transition block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{v.title}</h3>
                  <p className="text-gray-500 mt-1">{v.description}</p>
                </div>
                <span className="text-primary-600 font-medium whitespace-nowrap ml-4">
                  Подать заявку &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
