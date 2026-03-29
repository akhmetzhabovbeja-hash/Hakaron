import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface Vacancy {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  application_deadline: string | null;
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl.getTime() - now.getTime();

  if (diff <= 0) return { text: "Срок истёк", color: "text-red-600" };

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days < 3) {
    let parts: string[] = [];
    if (days > 0) parts.push(`${days} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (days === 0 && minutes > 0) parts.push(`${minutes} мин.`);
    return { text: `Осталось ${parts.join(" ")}`, color: "text-red-600" };
  }

  return {
    text: `До ${dl.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`,
    color: "text-gray-500",
  };
}

export default function HrDashboardPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const fetchVacancies = () => {
    apiClient
      .get("/hr/vacancies")
      .then((res) => setVacancies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVacancies(); }, []);

  const archiveVacancy = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await apiClient.patch(`/hr/vacancies/${id}/archive`);
    fetchVacancies();
  };

  const restoreVacancy = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await apiClient.patch(`/hr/vacancies/${id}/restore`);
    fetchVacancies();
  };

  const active = vacancies.filter((v) => v.is_active);
  const archived = vacancies.filter((v) => !v.is_active);
  const shown = tab === "active" ? active : archived;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Координатор: Программы</h2>
        <Link
          to="/hr/vacancies/create"
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          + Создать программу
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "active"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Активные ({active.length})
        </button>
        <button
          onClick={() => setTab("archived")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "archived"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Удалённые ({archived.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {tab === "active" ? (
            <>
              <p className="text-lg mb-2">Активных программ нет</p>
              <p>Создайте первую программу</p>
            </>
          ) : (
            <p className="text-lg">Удалённых программ нет</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map((v) => {
            const dl = deadlineLabel(v.application_deadline);
            return (
              <Link
                key={v.id}
                to={`/hr/vacancies/${v.id}`}
                className={`bg-white rounded-xl shadow p-6 hover:shadow-md transition block ${
                  !v.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{v.title}</h3>
                    <p className="text-gray-500 mt-1">{v.description}</p>
                    {dl && (
                      <p className={`text-sm mt-1 font-medium ${dl.color}`}>
                        {dl.text}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {tab === "active" ? (
                      <button
                        onClick={(e) => archiveVacancy(v.id, e)}
                        className="text-sm text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
                      >
                        Удалить
                      </button>
                    ) : (
                      <button
                        onClick={(e) => restoreVacancy(v.id, e)}
                        className="text-sm text-green-600 hover:text-green-800 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
                      >
                        Восстановить
                      </button>
                    )}
                    <span className="text-gray-400">&rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
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
        Абитуриенты после AI-анализа ({candidates.length})
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
