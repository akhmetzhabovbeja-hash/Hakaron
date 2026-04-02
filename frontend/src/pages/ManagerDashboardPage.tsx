import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface CandidateItem {
  id: number;
  candidate_id: number;
  full_name: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  status: string;
  source: string;
}

export default function ManagerDashboardPage() {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");

  const fetchCandidates = () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("sort_by", sortBy);
    apiClient
      .get(`/manager/candidates?${params}`)
      .then((res) => setCandidates(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, [sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCandidates();
  };

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight text-dark mb-8">Приёмная комиссия</h1>

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
          Абитуриентов: <span className="font-bold text-dark">{candidates.length}</span>
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl font-bold text-dark">Нет абитуриентов на рассмотрение</p>
          <p className="text-gray-400 mt-2">Координатор отбора пока не отправил абитуриентов</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c, idx) => (
            <Link
              key={c.id}
              to={`/manager/candidate/${c.id}`}
              className="group border border-gray-100 rounded-2xl p-6 flex items-center justify-between hover:border-dark transition"
            >
              <div className="flex items-start gap-4">
                <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-lg font-bold text-dark">{c.full_name}</h3>
                  <p className="text-gray-400 text-sm">{c.vacancy_title}</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-dark">{c.total_score}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">баллов</div>
                </div>
                <div className="w-px h-10 bg-gray-100" />
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-dark">{Math.round(c.vacancy_match * 100)}%</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">match</div>
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
