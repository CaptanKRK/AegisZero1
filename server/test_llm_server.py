import os
import unittest
from llm_server import app

class TestLLMServer(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        # Ensure we have a test API key
        if not os.getenv('GEMINI_API_KEY'):
            raise Exception('GEMINI_API_KEY environment variable not set')

    def test_health(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

    def test_analyze(self):
        test_data = {
            "prompt": """
            Title: Understanding Climate Change: The Science Behind Global Warming
            Description: A comprehensive look at the scientific evidence and research behind climate change
            Channel: ScienceDaily
            Category: Education
            Tags: climate change, science, research, global warming
            Views: 100000
            Likes: 5000
            Comments: 1200
            """
        }
        response = self.client.post('/analyze', json=test_data)
        self.assertEqual(response.status_code, 200)
        data = response.json
        
        # Verify response structure
        self.assertIn("classification", data)
        self.assertIn("confidence_level", data)
        self.assertIn("explanation", data)
        self.assertIn("scores", data)
        
        # Verify classification is valid
        valid_classifications = ["FACTUAL", "MISLEADING", "SATIRE", "OPINION"]
        self.assertIn(data["classification"].upper(), valid_classifications)
        
        # Verify confidence level is valid
        valid_confidence = ["low", "medium", "high"]
        self.assertIn(data["confidence_level"].lower(), valid_confidence)
        
        # Verify scores
        scores = data["scores"]
        score_categories = ["factual", "misleading", "satire", "opinion"]
        for category in score_categories:
            self.assertIn(category, scores)
            self.assertGreaterEqual(scores[category], 0)
            self.assertLessEqual(scores[category], 10)

if __name__ == '__main__':
    unittest.main()