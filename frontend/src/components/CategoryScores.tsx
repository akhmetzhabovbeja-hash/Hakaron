interface CategoryScore {
  score: number;
  max: number;
  label: string;
  explanation: string;
}

interface Props {
  categoryScores: Record<string, CategoryScore> | null;
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function textColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

export default function CategoryScores({ categoryScores }: Props) {
  if (!categoryScores) return null;

  const entries = Object.entries(categoryScores).sort(
    (a, b) => b[1].score - a[1].score
  );

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6">
      <h3 className="font-semibold mb-4">Оценка по категориям (Explainable AI)</h3>
      <div className="space-y-4">
        {entries.map(([key, cat]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{cat.label}</span>
              <span className={`text-sm font-bold ${textColor(cat.score)}`}>
                {cat.score}/{cat.max}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${scoreColor(cat.score)}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
            {cat.explanation && (
              <p className="text-xs text-gray-400 mt-1">{cat.explanation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
