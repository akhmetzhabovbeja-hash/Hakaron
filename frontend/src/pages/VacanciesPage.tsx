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

  if (days < 3) {
    let parts: string[] = [];
    if (days > 0) parts.push(`${days} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (days === 0 && minutes > 0) parts.push(`${minutes} мин.`);
    return { expired: false, text: `Осталось ${parts.join(" ")}`, color: "text-red-600" };
  }

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
      {/* Hero section */}
      <div className="mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-dark leading-tight">
          Программы<br />
          <span className="text-gray-300">inVision U</span>
        </h1>
        <div className="w-24 h-1 bg-dark mt-4 mb-4" />
        <p className="text-gray-500 text-lg max-w-xl">
          Выберите программу и подайте заявку. Год, который меняет всё.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-dark rounded-full animate-spin" />
          Загрузка программ...
        </div>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-xl font-bold text-dark">Программ пока нет</p>
          <p className="text-gray-400 mt-2">Загляните позже</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {vacancies.map((v, idx) => {
            const dl = deadlineInfo(v.application_deadline);
            const isExpired = dl?.expired ?? false;

            return (
              <div
                key={v.id}
                className={`group relative border border-gray-100 rounded-2xl p-8 transition-all ${
                  isExpired
                    ? "opacity-50"
                    : "hover:border-dark hover:shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-gray-300 tracking-widest">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-2xl font-bold text-dark">{v.title}</h3>
                    </div>
                    <p className="text-gray-500 leading-relaxed max-w-2xl">
                      {v.description}
                    </p>
                    {dl && (
                      <p className={`text-sm mt-3 font-semibold ${dl.color}`}>
                        {dl.text}
                      </p>
                    )}
                  </div>

                  {isExpired ? (
                    <div className="shrink-0 px-6 py-3 bg-gray-100 text-gray-400 rounded-full text-sm font-medium">
                      Приём закрыт
                    </div>
                  ) : (
                    <Link
                      to={`/questionnaire/${v.id}`}
                      className="shrink-0 px-6 py-3 bg-dark text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition group-hover:bg-accent group-hover:text-dark"
                    >
                      Подать заявку
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
