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
  return { text: `До ${dl.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`, color: "text-gray-500" };
}

export default function HrDashboardPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const fetchVacancies = () => {
    apiClient.get("/hr/vacancies").then((res) => setVacancies(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchVacancies(); }, []);

  const archiveVacancy = async (id: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    await apiClient.patch(`/hr/vacancies/${id}/archive`);
    fetchVacancies();
  };
  const restoreVacancy = async (id: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    await apiClient.patch(`/hr/vacancies/${id}/restore`);
    fetchVacancies();
  };

  const active = vacancies.filter((v) => v.is_active);
  const archived = vacancies.filter((v) => !v.is_active);
  const shown = tab === "active" ? active : archived;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Программы</h1>
        <Link to="/hr/vacancies/create" className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition">
          + Создать программу
        </Link>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-full p-1 mb-8 w-fit">
        <button onClick={() => setTab("active")} className={`px-5 py-2 rounded-full text-sm font-medium transition ${tab === "active" ? "bg-dark text-white" : "text-gray-500 hover:text-dark"}`}>
          Активные ({active.length})
        </button>
        <button onClick={() => setTab("archived")} className={`px-5 py-2 rounded-full text-sm font-medium transition ${tab === "archived" ? "bg-dark text-white" : "text-gray-500 hover:text-dark"}`}>
          Удалённые ({archived.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {tab === "active" ? <><p className="text-lg font-semibold">Активных программ нет</p><p className="text-sm mt-1">Создайте первую программу</p></> : <p>Удалённых программ нет</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map((v) => {
            const dl = deadlineLabel(v.application_deadline);
            return (
              <Link key={v.id} to={`/hr/vacancies/${v.id}`} className={`group border border-gray-100 rounded-2xl p-6 transition-all hover:border-dark hover:shadow-md ${!v.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-dark">{v.title}</h3>
                    <p className="text-gray-400 mt-1 text-sm">{v.description}</p>
                    {dl && <p className={`text-sm mt-1 font-medium ${dl.color}`}>{dl.text}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {tab === "active" ? (
                      <button onClick={(e) => archiveVacancy(v.id, e)} className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition">Удалить</button>
                    ) : (
                      <button onClick={(e) => restoreVacancy(v.id, e)} className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100 transition">Восстановить</button>
                    )}
                    <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

