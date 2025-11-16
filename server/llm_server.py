# LLM Analysis Server
from flask import Flask, request, jsonify
import os
import re

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        content = data['prompt']
        
        # Simple pattern-based analysis
        text = content.lower()
        
        # Initialize scores
        scores = {
            'factual': 0,
            'misleading': 0,
            'satire': 0,
            'opinion': 0
        }
        
        # Pattern matching
        factual_patterns = ['research', 'study', 'evidence', 'data', 'scientific']
        misleading_patterns = ['conspiracy', 'shocking truth', 'they dont want you to know', 'secret']
        satire_patterns = ['parody', 'humor', 'comedy', 'funny', 'joke']
        opinion_patterns = ['i think', 'review', 'reaction', 'my thoughts', 'opinion']
        
        # Calculate scores
        for pattern in factual_patterns:
            if pattern in text:
                scores['factual'] += 2
        for pattern in misleading_patterns:
            if pattern in text:
                scores['misleading'] += 2
        for pattern in satire_patterns:
            if pattern in text:
                scores['satire'] += 2
        for pattern in opinion_patterns:
            if pattern in text:
                scores['opinion'] += 2
                
        # Determine classification
        max_score = max(scores.values())
        classification = max(scores.items(), key=lambda x: x[1])[0].upper()
        
        # Determine confidence
        confidence_level = 'high' if max_score > 6 else 'medium' if max_score > 3 else 'low'
        
        result = {
            "classification": classification,
            "confidence_level": confidence_level,
            "explanation": f"Content analysis suggests this is {classification.lower()} content based on keyword analysis",
            "scores": scores
        }
        
        # Parse and return the response
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)