import { useEffect, useState } from "react";
import apiClient from "../api/client";

interface Survey {
  id: number;
  name: string;
  phone: string;
  telegram_username: string;
  total_score: number;
  status: string;
  analysis: any;
  answers: { question: string; answer: string }[];
  created_at: string;
}

export default function HrProactivePage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tab, setTab] = useState<"new" | "approved">("new");
  const [acting, setActing] = useState<number | null>(null);

  const fetchSurveys = () => {
    apiClient.get("/telegram/proactive-surveys").then((res) => setSurveys(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchSurveys(); }, []);

  const approve = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActing(id);
    try { await apiClient.post(`/telegram/proactive-surveys/${id}/approve`); fetchSurveys(); }
    catch { alert("Ошибка"); } finally { setActing(null); }
  };

  const reject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Отклонить кандидата?")) return;
    setActing(id);
    try { await apiClient.post(`/telegram/proactive-surveys/${id}/reject`); fetchSurveys(); }
    catch { alert("Ошибка"); } finally { setActing(null); }
  };

  const newSurveys = surveys.filter(s => s.status === "analyzed" || s.status === "pending");
  const approvedSurveys = surveys.filter(s => s.status === "approved");
  const shown = tab === "new" ? newSurveys : approvedSurveys;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Поиск талантов</h1>
        <div className="w-16 h-1 bg-accent mt-3 mb-3" />
        <p className="text-gray-400">Кандидаты из Telegram-бота (мини-анкета 5 вопросов → AI-анализ)</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1 mb-8 w-fit">
        <button onClick={() => setTab("new")} className={`px-5 py-2 rounded-full text-sm font-medium transition ${tab === "new" ? "bg-dark text-white" : "text-gray-500 hover:text-dark"}`}>
          Новые ({newSurveys.length})
        </button>
        <button onClick={() => setTab("approved")} className={`px-5 py-2 rounded-full text-sm font-medium transition ${tab === "approved" ? "bg-dark text-white" : "text-gray-500 hover:text-dark"}`}>
          Одобренные ({approvedSurveys.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">{tab === "new" ? "🔍" : "✅"}</div>
          <p className="text-xl font-bold text-dark">{tab === "new" ? "Нет новых заявок" : "Нет одобренных"}</p>
          <p className="text-gray-400 mt-2">{tab === "new" ? "Отправьте ссылку на бота партнёрским школам" : "Одобренные кандидаты появятся здесь"}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((s, idx) => {
            const isExpanded = expandedId === s.id;
            const hasAnalysis = s.status !== "pending" && s.analysis;

            return (
              <div key={s.id} className={`border rounded-2xl p-6 transition ${isExpanded ? "border-dark shadow-md" : "border-gray-100"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="text-lg font-bold text-dark">{s.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {s.telegram_username ? `@${s.telegram_username}` : s.phone} · {new Date(s.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasAnalysis && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${isExpanded ? "bg-dark text-white" : "bg-gray-100 text-dark hover:bg-gray-200"}`}
                      >
                        {isExpanded ? "Скрыть" : "Анализ AI"}
                      </button>
                    )}
                    {tab === "new" && s.status === "analyzed" && (
                      <>
                        <button onClick={(e) => approve(s.id, e)} disabled={acting === s.id} className="px-4 py-1.5 rounded-full text-xs font-semibold bg-accent text-dark hover:bg-accent/80 transition disabled:opacity-50">
                          {acting === s.id ? "..." : "Одобрить"}
                        </button>
                        <button onClick={(e) => reject(s.id, e)} disabled={acting === s.id} className="px-4 py-1.5 rounded-full text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition disabled:opacity-50">
                          Отклонить
                        </button>
                      </>
                    )}
                    {tab === "approved" && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-accent text-dark">
                        Приглашён
                      </span>
                    )}
                    <div className="text-right">
                      <div className={`text-2xl font-extrabold ${s.total_score >= 70 ? "text-dark" : s.total_score >= 50 ? "text-gray-600" : "text-red-500"}`}>
                        {s.total_score}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">баллов</div>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && hasAnalysis && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    {s.analysis.category_scores && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Оценка по категориям</h4>
                        <div className="space-y-3">
                          {Object.entries(s.analysis.category_scores).map(([key, cat]: [string, any]) => (
                            <div key={key}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-semibold text-dark">{cat.label || key}</span>
                                <span className="font-bold text-dark">{cat.score}<span className="text-gray-400 font-normal">/100</span></span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`h-2 rounded-full ${cat.score >= 70 ? "bg-dark" : cat.score >= 50 ? "bg-gray-400" : "bg-red-400"}`} style={{ width: `${cat.score}%` }} />
                              </div>
                              {cat.explanation && <p className="text-xs text-gray-400 mt-1">{cat.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {s.analysis.strengths?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Сильные стороны</h4>
                          <ul className="space-y-1">{s.analysis.strengths.map((str: string, i: number) => (<li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-dark font-bold">+</span> {str}</li>))}</ul>
                        </div>
                      )}
                      {s.analysis.weaknesses?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Зоны развития</h4>
                          <ul className="space-y-1">{s.analysis.weaknesses.map((w: string, i: number) => (<li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-red-500 font-bold">-</span> {w}</li>))}</ul>
                        </div>
                      )}
                    </div>
                    {s.analysis.summary && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">AI-резюме</h4>
                        <div className="space-y-3">
                          {s.analysis.summary.split("\n\n").map((section: string, i: number) => {
                            const lines = section.split("\n");
                            return (<div key={i}>{lines[0] && <p className="font-semibold text-dark text-sm">{lines[0]}</p>}{lines.slice(1).join("\n") && <p className="text-gray-600 text-sm whitespace-pre-wrap">{lines.slice(1).join("\n")}</p>}</div>);
                          })}
                        </div>
                      </div>
                    )}
                    {s.analysis.leadership_assessment && (
                      <div className="mb-6"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Лидерский потенциал</h4><p className="text-sm text-gray-600">{s.analysis.leadership_assessment}</p></div>
                    )}
                    {s.analysis.predictive_summary && (
                      <div className="mb-6"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Прогноз успеха {s.analysis.predictive_score ? `(${s.analysis.predictive_score}/100)` : ""}</h4><p className="text-sm text-gray-600">{s.analysis.predictive_summary}</p></div>
                    )}
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Ответы</h4>
                    <div className="space-y-3">
                      {s.answers.map((a, i) => (<div key={i} className="bg-gray-50 rounded-xl p-4"><p className="text-xs font-semibold text-gray-500 mb-1">{a.question}</p><p className="text-sm text-dark">{a.answer}</p></div>))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
