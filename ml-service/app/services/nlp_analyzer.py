"""
NLP Analyzer Service — placeholder for ML team.

This module will contain the core ML logic for analyzing candidate answers.
The ML team should implement:
1. Text embedding using a transformer model (e.g., ruBERT or multilingual model)
2. Scoring logic based on answer quality, relevance, and depth
3. Vacancy matching using cosine similarity between answer embeddings and vacancy requirements
4. Growth potential estimation based on answer patterns

Hardware constraint: RTX 3070 Ti (8GB VRAM)
Recommended models that fit in 8GB:
- cointegrated/rubert-tiny2 (~120MB) — fast, good for Russian text
- ai-forever/sbert_large_nlu_ru (~1.3GB) — better quality
- sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (~470MB) — multilingual
"""


class NLPAnalyzer:
    def __init__(self):
        self.model = None
        self.tokenizer = None

    def load_model(self):
        """Load the NLP model. Called once at startup."""
        # TODO: ML team implements model loading
        pass

    def analyze_answers(self, answers: list[dict], vacancy_requirements: str) -> dict:
        """
        Analyze candidate answers against vacancy requirements.

        Returns:
            dict with keys: total_score, vacancy_match, growth_potential,
                           strengths, weaknesses, summary
        """
        # TODO: ML team implements analysis pipeline
        pass

    def compute_vacancy_match(self, answer_embeddings, vacancy_embedding) -> float:
        """Compute cosine similarity between answer and vacancy embeddings."""
        # TODO: implement
        pass
