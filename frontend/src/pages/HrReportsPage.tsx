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
    apiClient.get("/hr/vacancies").then(async (res) => {
      const vacs = res.data as VacancyWithCount[];
      const withCounts = await Promise.all(
        vacs.map(async (v) => {
          try { const cRes = await apiClient.get(`/hr/vacancies/${v.id}/candidates`); return { ...v, candidateCount: cRes.data.length }; }
          catch { return { ...v, candidateCount: 0 }; }
        })
      );
      setVacancies(withCounts);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Отчёты</h1>
        <div className="w-16 h-1 bg-dark mt-3 mb-3" />
        <p className="text-gray-400">Выберите программу для просмотра абитуриентов и их анализа</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : vacancies.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl font-bold text-dark">Программ пока нет</p>
          <p className="text-gray-400 mt-2">Создайте программу в разделе "Программы"</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vacancies.map((v, idx) => (
            <Link key={v.id} to={`/hr/reports/vacancy/${v.id}`} className="group border border-gray-100 rounded-2xl p-7 hover:border-dark hover:shadow-md transition block">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{v.title}</h3>
                    <p className="text-gray-400 mt-1 text-sm">{v.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-dark">{v.candidateCount ?? 0}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">абитуриентов</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${v.is_active ? "bg-accent text-dark" : "bg-gray-100 text-gray-500"}`}>
                    {v.is_active ? "Активна" : "Закрыта"}
                  </span>
                  <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
