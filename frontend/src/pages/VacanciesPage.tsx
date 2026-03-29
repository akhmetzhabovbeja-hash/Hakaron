import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface Vacancy {
  id: number;
  title: string;
  description: string;
  requirements: string;
  is_active: boolean;
  application_deadline: string | null;
}

function deadlineInfo(deadline: string | null) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl.getTime() - now.getTime();

  if (diff <= 0) return { expired: true, text: "Приём закрыт", color: "text-red-600" };

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  // <= 3 days: exact countdown
  if (days < 3) {
    let parts: string[] = [];
    if (days > 0) parts.push(`${days} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (days === 0 && minutes > 0) parts.push(`${minutes} мин.`);
    return { expired: false, text: `Осталось ${parts.join(" ")}`, color: "text-red-600" };
  }

  // > 3 days: show date
  return {
    expired: false,
    text: `До ${dl.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`,
    color: "text-gray-500",
  };
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
          {vacancies.map((v) => {
            const dl = deadlineInfo(v.application_deadline);
            const isExpired = dl?.expired ?? false;

            const Wrapper = isExpired ? "div" : Link;
            const wrapperProps = isExpired
              ? {}
              : { to: `/questionnaire/${v.id}` };

            return (
              <Wrapper
                key={v.id}
                {...(wrapperProps as any)}
                className={`bg-white rounded-xl shadow p-6 transition block ${
                  isExpired
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{v.title}</h3>
                    <p className="text-gray-500 mt-1">{v.description}</p>
                    {dl && (
                      <p className={`text-sm mt-2 font-medium ${dl.color}`}>
                        {dl.text}
                      </p>
                    )}
                  </div>
                  {isExpired ? (
                    <span className="text-red-500 font-medium whitespace-nowrap ml-4">
                      Приём закрыт
                    </span>
                  ) : (
                    <span className="text-primary-600 font-medium whitespace-nowrap ml-4">
                      Подать заявку &rarr;
                    </span>
                  )}
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
