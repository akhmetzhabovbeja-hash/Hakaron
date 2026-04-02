import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface CandidateItem {
  id: number;
  full_name: string;
  vacancy_title: string;
  total_score: number;
  status: string;
  ai_suspected: boolean;
  ai_flags_count: number;
}

export default function HrApplicationsPage() {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");

  const fetchCandidates = () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("sort_by", sortBy);
    apiClient.get(`/hr/candidates?${params}`).then((res) => setCandidates(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, [sortBy]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchCandidates(); };

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Заявки</h1>
        <div className="w-16 h-1 bg-dark mt-3 mb-3" />
        <p className="text-gray-400">Абитуриенты после AI-анализа, ожидающие вашего рассмотрения</p>
      </div>

      {/* Search + Sort */}
      <div className="border border-gray-100 rounded-2xl p-5 mb-8 flex items-center gap-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dark"
          />
          <button type="submit" className="bg-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
            Найти
          </button>
        </form>
        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {[
            { key: "score", label: "По баллу" },
            { key: "date", label: "По дате" },
            { key: "name", label: "По имени" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${sortBy === s.key ? "bg-dark text-white" : "text-gray-500 hover:text-dark"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-gray-400 text-sm">
          Всего: <span className="font-bold text-dark">{candidates.length}</span>
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl font-bold text-dark">{search ? `Ничего не найдено по "${search}"` : "Нет заявок на рассмотрение"}</p>
          <p className="text-gray-400 mt-2">Новые заявки появятся после прохождения AI-анализа</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c, idx) => (
            <Link
              key={c.id}
              to={`/hr/candidates/${c.id}`}
              className={`group border rounded-2xl p-6 flex items-center justify-between hover:border-dark transition ${c.ai_suspected ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-dark">{c.full_name}</h3>
                    {c.ai_suspected && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">
                        AI подозрение ({c.ai_flags_count})
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">{c.vacancy_title}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-2xl font-extrabold ${c.total_score >= 80 ? "text-dark" : c.total_score >= 60 ? "text-gray-600" : "text-red-600"}`}>{c.total_score}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">баллов</div>
                </div>
                <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
