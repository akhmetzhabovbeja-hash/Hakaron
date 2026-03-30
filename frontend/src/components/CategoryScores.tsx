interface CategoryScore {
  score: number;
  max: number;
  label: string;
  explanation: string;
}

interface Props {
  categoryScores: Record<string, CategoryScore> | null;
}

function barColor(score: number) {
  if (score >= 80) return "bg-dark";
  if (score >= 60) return "bg-gray-400";
  return "bg-red-400";
}

export default function CategoryScores({ categoryScores }: Props) {
  if (!categoryScores) return null;

  const entries = Object.entries(categoryScores).sort(
    (a, b) => b[1].score - a[1].score
  );

  return (
    <div className="border border-gray-100 rounded-2xl p-6 mb-6">
      <h3 className="font-bold text-dark mb-5">Оценка по категориям (Explainable AI)</h3>
      <div className="space-y-5">
        {entries.map(([key, cat]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-dark">{cat.label}</span>
              <span className="text-sm font-bold text-dark">
                {cat.score}<span className="text-gray-400 font-normal">/{cat.max}</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${barColor(cat.score)}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
            {cat.explanation && (
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{cat.explanation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
