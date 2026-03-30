import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";

interface CandidateItem {
  id: number; candidate_id: number; full_name: string; email: string;
  vacancy_title: string; total_score: number; vacancy_match: number; status: string; source: string;
}

const statusLabels: Record<string, { label: string; style: string }> = {
  pending: { label: "Ожидание", style: "bg-gray-100 text-gray-600" },
  processing: { label: "Анализ", style: "bg-gray-100 text-gray-600" },
  analyzed: { label: "Проанализирован", style: "bg-accent/30 text-dark" },
  hr_review: { label: "HR рассматривает", style: "bg-accent/30 text-dark" },
  sent_to_manager: { label: "У комиссии", style: "bg-dark text-white" },
  approved: { label: "Зачислен", style: "bg-accent text-dark" },
  rejected: { label: "Отклонён", style: "bg-red-100 text-red-600" },
};

export default function HrReportVacancyCandidatesPage() {
  const { id } = useParams();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleExcelExport = async () => {
    let url = `/hr/vacancies/${id}/report-excel`;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (params.toString()) url += `?${params.toString()}`;
    try { await downloadFile(url, `report_${vacancyTitle || id}.xlsx`); }
    catch { alert("Ошибка экспорта Excel"); }
  };

  useEffect(() => {
    Promise.all([apiClient.get(`/hr/vacancies/${id}`), apiClient.get(`/hr/vacancies/${id}/candidates`)])
      .then(([vRes, cRes]) => { setVacancyTitle(vRes.data.title); setCandidates(cRes.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <Link to="/hr/reports" className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к отчётам</Link>

      <h1 className="text-4xl font-extrabold tracking-tight text-dark mt-4 mb-8">{vacancyTitle}</h1>

      {/* Filters */}
      <div className="border border-gray-100 rounded-2xl p-5 mb-8 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">От</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">До</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
        </div>
        <button onClick={handleExcelExport} className="bg-dark text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-accent hover:text-dark transition">
          Excel Экспорт
        </button>
        <span className="text-gray-400 text-sm ml-auto">Абитуриентов: <span className="font-bold text-dark">{candidates.length}</span></span>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20"><p className="text-lg font-bold text-dark">Пока нет абитуриентов</p></div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c, idx) => {
            const st = statusLabels[c.status] || statusLabels.pending;
            return (
              <Link key={c.id} to={`/hr/reports/candidate/${c.id}`} className="group border border-gray-100 rounded-2xl p-5 flex items-center justify-between hover:border-dark transition">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-bold text-dark">{c.full_name}</h3>
                    <p className="text-gray-400 text-sm">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.style}`}>{st.label}</span>
                  <span className="text-xl font-extrabold text-dark">{c.total_score}</span>
                  <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
