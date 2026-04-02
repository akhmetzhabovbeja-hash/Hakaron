import { useState } from "react";
import apiClient from "../api/client";

interface EngineResult {
  engine: string;
  score: number;
  verdict: string;
}

interface DetectResult {
  source: string;
  score: number;
  verdict: string;
  ai_probability: number;
  is_ai_generated: boolean;
  indicators: string[];
  ml_scores: Record<string, number> | null;
  russian_rule_score: number;
  sloptotal_engines: EngineResult[];
}

export default function HrAiDetectPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<DetectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (text.trim().length < 50) {
      setError("Текст должен быть не менее 50 символов");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await apiClient.post("/hr/ai-detect", { text });
      setResult(data);
    } catch {
      setError("Ошибка проверки");
    } finally {
      setLoading(false);
    }
  };

  const verdictStyle = (v: string) => {
    if (v === "Подозрительный" || v === "AI-текст") return "bg-red-50 text-red-700 border-red-200";
    if (v === "Человеческий") return "bg-accent/20 text-dark border-accent/30";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-extrabold tracking-tight text-dark mb-2">AI Детектор</h1>
      <p className="text-gray-400 mb-8">Проверьте текст на наличие признаков AI-генерации (RU + EN)</p>

      {/* Input */}
      <div className="border border-gray-100 rounded-2xl p-8 mb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставьте текст для проверки (эссе, мотивационное письмо, ответ на вопрос)..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-dark h-40 resize-y"
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-400">{text.length} символов / {text.split(/\s+/).filter(Boolean).length} слов</span>
          <button
            onClick={handleCheck}
            disabled={loading}
            className="bg-dark text-white px-8 py-3 rounded-full text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? "Анализ..." : "Проверить"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Main verdict */}
          <div className={`border rounded-2xl p-8 text-center ${verdictStyle(result.verdict)}`}>
            <div className="text-6xl font-extrabold">{result.score}</div>
            <div className="text-xs uppercase tracking-widest mt-2 font-semibold">из 100</div>
            <div className="text-2xl font-bold mt-4">{result.verdict}</div>
            <div className="text-sm mt-1 opacity-70">
              {result.is_ai_generated ? "Текст вероятно написан AI" : "Текст вероятно написан человеком"}
            </div>
          </div>

          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-2xl p-6">
              <h3 className="font-bold text-dark mb-4">ML-движки (SlopTotal)</h3>
              {result.sloptotal_engines.length > 0 ? (
                <div className="space-y-3">
                  {result.sloptotal_engines.map((e) => (
                    <div key={e.engine}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{e.engine.replace("classifier_", "")}</span>
                        <span className="font-bold text-dark">{e.score}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${e.score > 60 ? "bg-red-400" : e.score > 30 ? "bg-yellow-400" : "bg-dark"}`}
                          style={{ width: `${e.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">SlopTotal недоступен</p>
              )}
            </div>

            <div className="border border-gray-100 rounded-2xl p-6">
              <h3 className="font-bold text-dark mb-4">Русские эвристики</h3>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Rule-based score</span>
                  <span className="font-bold text-dark">{Math.round(result.russian_rule_score * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${result.russian_rule_score > 0.4 ? "bg-red-400" : "bg-dark"}`}
                    style={{ width: `${result.russian_rule_score * 100}%` }}
                  />
                </div>
              </div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Индикаторы</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.indicators.map((ind, i) => (
                  <span key={i} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
