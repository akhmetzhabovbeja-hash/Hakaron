import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";
import CategoryScores from "../components/CategoryScores";

interface DossierData {
  name: string; email: string; phone: string; bio: string; avatar_url: string | null;
  id_document_url: string | null;
  total_score: number; vacancy_match: number; growth_potential: string;
  strengths: string[]; weaknesses: string[]; summary: string; status: string; vacancy_title: string;
  answers: { question_number: number; question_text: string; answer_text: string }[];
  category_scores?: Record<string, any> | null;
  ai_detection_flags?: any[];
  growth_path_score?: number;
}

export default function HrCandidateDossierPage() {
  const { id } = useParams();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalFlag, setModalFlag] = useState<any>(null);

  useEffect(() => {
    apiClient.get(`/hr/candidates/${id}/dossier`).then((res) => setDossier(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400">Загрузка досье...</p>;
  if (!dossier) return <p className="text-red-500">Досье не найдено</p>;

  const avatarSrc = dossier.avatar_url ? `${dossier.avatar_url}` : null;

  const explainIndicator = (ind: string): string => {
    if (ind === "explicit_ai_label") return "Ответ начинается с явной пометки AI-генератора (\"Ответ Gemini\", \"Ответ ChatGPT\" и т.д.). Абитуриент скопировал ответ из AI-чата без редактирования.";
    if (ind === "copy_pasted_ai_response") return "Текст является прямой копией ответа AI-ассистента. Абитуриент не написал ответ самостоятельно.";
    if (ind.startsWith("ai_phrases_strong:")) {
      const phrases = ind.replace("ai_phrases_strong:", "").split(",").map(p => `"${p.trim()}"`).join(", ");
      return `Обнаружены характерные AI-фразы: ${phrases}. Такие обороты типичны для ChatGPT и Claude — живые люди так почти не пишут.`;
    }
    if (ind.startsWith("ai_phrases_medium:")) {
      const phrases = ind.replace("ai_phrases_medium:", "").split(",").map(p => `"${p.trim()}"`).join(", ");
      return `Найдены подозрительные обороты: ${phrases}. Они часто встречаются в AI-текстах.`;
    }
    if (ind.startsWith("ai_phrases_light:")) return "Обнаружены слабые AI-маркеры в тексте.";
    if (ind === "very_uniform_sentences") return "Все предложения почти одинаковой длины. Люди пишут неравномерно — короткие и длинные предложения чередуются, а AI генерирует равномерный текст.";
    if (ind === "uniform_sentences") return "Предложения подозрительно однородны по длине.";
    if (ind.startsWith("low_burstiness:")) return "Очень низкая «скачкообразность» текста. У человека длина предложений варьируется сильно, у AI — почти не меняется.";
    if (ind.startsWith("medium_burstiness:")) return "Средняя вариативность длин предложений — слегка ниже человеческой нормы.";
    if (ind === "too_formal") return "Текст написан чрезмерно формальным языком без единого разговорного слова. Живые люди, особенно студенты, обычно пишут менее формально.";
    if (ind.startsWith("heavy_hedging:")) return "Чрезмерное количество вводных конструкций (\"кроме того\", \"более того\", \"вместе с тем\"). AI злоупотребляет такими связками.";
    if (ind.startsWith("hedging:")) return "Обнаружено несколько вводных конструкций подряд — характерный паттерн AI-генерации.";
    if (ind === "abstract_no_details") return "Текст полностью абстрактный — нет ни одного конкретного примера, имени, даты или цифры. Человек обычно приводит детали из личного опыта.";
    if (ind === "low_concreteness") return "Мало конкретных деталей — текст больше похож на общие рассуждения, чем на личный опыт.";
    if (ind.startsWith("word_repetition:")) return "Повторяющиеся слова — AI часто зацикливается на ключевых терминах.";
    if (ind === "no_first_person") return "В тексте отсутствует первое лицо (\"я\", \"мне\", \"мой\"). Для мотивационного эссе это неестественно.";
    if (ind.startsWith("high_comma_density:")) return "Необычно высокая плотность запятых — AI в русском языке использует сложные конструкции с большим количеством запятых.";
    if (ind === "structured_formatting") return "Текст содержит нумерованные списки или маркеры — AI часто структурирует ответы в виде списков.";
    if (ind === "repetitive_starters") return "Предложения начинаются с одних и тех же слов — AI часто использует повторяющиеся конструкции.";
    if (ind.startsWith("BERT-RAID:")) return `ML-модель BERT-RAID оценивает вероятность AI-текста в ${ind.split(":")[1]}.`;
    if (ind.startsWith("E5:")) return `ML-модель E5 оценивает вероятность AI-текста в ${ind.split(":")[1]}.`;
    if (ind.startsWith("TMR:")) return `ML-модель TMR оценивает вероятность AI-текста в ${ind.split(":")[1]}.`;
    if (ind.startsWith("Linguistic:")) return `Лингвистический анализ показывает ${ind.split(":")[1]} вероятность AI.`;
    if (ind === "ml+rules_agree") return "ML-модели и русские эвристики единодушны — оба метода указывают на AI-генерацию.";
    if (ind === "hybrid_ml+ru") return "";  // system tag, skip
    if (ind.startsWith("human_")) return "";  // human markers, skip
    if (ind.startsWith("low_vocabulary")) return "Низкое разнообразие лексики — AI склонен повторять одни и те же слова.";
    return "";
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link to={`/hr/reports/candidate/${id}`} className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к анализу</Link>

      <div className="flex items-center justify-between mt-6 mb-8">
        <h1 className="text-3xl font-extrabold text-dark">Досье абитуриента</h1>
        <button
          onClick={() => downloadFile(`/hr/candidates/${id}/report-pdf`, `dossier_${id}.pdf`).catch(() => alert("Ошибка PDF"))}
          className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition"
        >
          Скачать PDF
        </button>
      </div>

      {/* User Info */}
      <div className="border border-gray-100 rounded-2xl p-8 mb-8">
        <div className="flex items-start gap-6">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-dark text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {dossier.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-dark">{dossier.name}</h3>
            <p className="text-gray-400 mt-1">{dossier.vacancy_title}</p>
            <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</span>
                <p className="text-dark mt-0.5">{dossier.email}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Телефон</span>
                <p className="text-dark mt-0.5">{dossier.phone}</p>
              </div>
            </div>
            {dossier.bio && (
              <div className="mt-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">О себе</span>
                <p className="text-gray-600 mt-0.5 leading-relaxed">{dossier.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: `${dossier.total_score}/100`, label: "Балл" },
          { value: `${Math.round(dossier.vacancy_match * 100)}%`, label: "Соответствие" },
          { value: dossier.growth_potential, label: "Потенциал" },
          { value: `${Math.round((dossier.growth_path_score || 0) * 100)}%`, label: "Рост" },
        ].map((card, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl p-5 text-center">
            <div className="text-2xl font-extrabold text-dark">{card.value}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-dark mb-4">AI-резюме</h3>
        <div className="space-y-4">
          {(dossier.summary || "").split("\n\n").map((section, i) => {
            const lines = section.split("\n");
            const title = lines[0];
            const body = lines.slice(1).join("\n");
            return (
              <div key={i}>
                {title && <p className="font-semibold text-dark text-sm mb-1">{title}</p>}
                {body && <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{body}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ID Document */}
      {dossier.id_document_url && (
        <div className="border border-gray-100 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-dark mb-4">Удостоверение личности</h3>
          <img
            src={`${dossier.id_document_url}`}
            alt="Удостоверение"
            className="max-w-md rounded-xl border border-gray-200"
          />
        </div>
      )}

      {/* Category scores */}
      <CategoryScores categoryScores={dossier.category_scores || null} />

      {/* AI Detection summary */}
      {(dossier.ai_detection_flags || []).some((f: any) => f.is_ai_generated) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-red-700 mb-2">AI Детекция: подозрение</h3>
          <p className="text-red-600 text-sm">
            Наш детектор обнаружил признаки AI-генерации в {(dossier.ai_detection_flags || []).filter((f: any) => f.is_ai_generated).length} из {dossier.answers.length} ответов.
            Ответы с подозрением на AI отмечены красной рамкой ниже.
          </p>
        </div>
      )}

      {/* Answers */}
      <div className="border border-gray-100 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-dark mb-6">
          Ответы абитуриента
          <span className="ml-2 text-sm font-normal text-gray-400">({dossier.answers.length})</span>
        </h3>
        <div className="space-y-4">
          {dossier.answers.map((a) => {
            const aiFlag = (dossier.ai_detection_flags || []).find((f: any) => f.question_number === a.question_number);
            const isAi = aiFlag?.is_ai_generated;
            return (
              <div key={a.question_number} className={`border rounded-xl p-5 ${isAi ? "border-red-300 bg-red-50/50" : aiFlag ? "border-yellow-200 bg-yellow-50/30" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${isAi ? "bg-red-600 text-white" : "bg-dark text-white"}`}>
                    {String(a.question_number).padStart(2, "0")}
                  </span>
                  <p className="text-sm font-semibold text-dark flex-1">{a.question_text}</p>
                  {aiFlag && (
                    <button
                      onClick={() => setModalFlag(aiFlag)}
                      className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 font-bold uppercase cursor-pointer hover:opacity-80 transition ${isAi ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                    >
                      {isAi ? "AI-текст" : `AI ${Math.round(aiFlag.ai_probability * 100)}%`}
                    </button>
                  )}
                </div>
                <div className={`ml-10 rounded-xl p-4 ${isAi ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{a.answer_text}</p>
                </div>
              </div>
            );
          })}
          {dossier.answers.length === 0 && (
            <p className="text-gray-400 text-center py-6">Ответы не найдены</p>
          )}
        </div>
      </div>

      {/* AI Explanation Modal */}
      {modalFlag && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalFlag(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold text-dark">Почему AI?</h3>
              <button onClick={() => setModalFlag(null)} className="text-gray-400 hover:text-dark text-2xl leading-none">&times;</button>
            </div>

            {/* Score */}
            <div className={`text-center p-6 rounded-xl mb-6 ${modalFlag.is_ai_generated ? "bg-red-50" : "bg-yellow-50"}`}>
              <div className={`text-4xl font-extrabold ${modalFlag.is_ai_generated ? "text-red-600" : "text-yellow-600"}`}>
                {Math.round(modalFlag.ai_probability * 100)}%
              </div>
              <div className="text-sm text-gray-500 mt-1">вероятность AI-генерации</div>
            </div>

            {/* Explanations */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Что смутило детектор:</p>
              {(modalFlag.indicators || []).map((ind: string, i: number) => {
                const text = explainIndicator(ind);
                if (!text) return null;
                return (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                    <span className="text-red-500 mt-0.5 shrink-0 text-lg">!</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setModalFlag(null)}
              className="w-full mt-6 bg-dark text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
