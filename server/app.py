# server/app.py
from flask import Flask, request, jsonify
import google.generativeai as genai
import pickle
import pandas as pd
import os
import re
from urllib.parse import urlparse

app = Flask(__name__)
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
PHISHING_CSV = os.path.join(os.path.dirname(__file__), 'phishing_site_urls.csv')

# Configure Gemini API if key is available
if os.getenv('GEMINI_API_KEY'):
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-pro')
    print("Gemini API configured successfully")

# load model — user must drop their own model.pkl here
model = None
phish_df = None

if os.path.exists(MODEL_PATH):
    try:
        with open(MODEL_PATH,'rb') as f:
            model = pickle.load(f)
        print(f"Model loaded successfully from {MODEL_PATH}")
    except Exception as e:
        print(f"Error loading model: {e}")

if os.path.exists(PHISHING_CSV):
    try:
        phish_df = pd.read_csv(PHISHING_CSV)
        print(f"Phishing CSV loaded successfully from {PHISHING_CSV}")
    except Exception as e:
        print(f"Error loading phishing CSV: {e}")

def extract_url_features(url):
    """Extract basic features from URL for classification"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        
        features = {
            'url_length': len(url),
            'domain_length': len(domain),
            'path_length': len(path),
            'has_subdomain': len(domain.split('.')) > 2,
            'has_hyphen': '-' in domain,
            'has_numbers': bool(re.search(r'\d', domain)),
            'suspicious_keywords': any(keyword in url.lower() for keyword in 
                ['secure', 'account', 'login', 'verify', 'update', 'confirm', 'bank', 'paypal']),
            'suspicious_tld': any(tld in domain for tld in ['.tk', '.ml', '.ga', '.cf']),
            'path_depth': len([p for p in path.split('/') if p]),
            'has_query': bool(parsed.query),
            'has_fragment': bool(parsed.fragment)
        }
        return features
    except:
        return {}

def classify_url_with_model(url):
    """Classify URL using loaded model and phishing database"""
    try:
        # Check against known phishing domains first
        if phish_df is not None:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            if domain in phish_df.get('domain', pd.Series()).values:
                return {
                    'verdict': 'phishing', 
                    'reason': f'Domain {domain} matches known phishing list.',
                    'confidence': 0.95
                }
        
        # Use ML model if available
        if model is not None:
            try:
                features = extract_url_features(url)
                if features:
                    # Convert features to array format expected by model
                    feature_vector = [
                        features.get('url_length', 0),
                        features.get('domain_length', 0),
                        features.get('path_length', 0),
                        int(features.get('has_subdomain', False)),
                        int(features.get('has_hyphen', False)),
                        int(features.get('has_numbers', False)),
                        int(features.get('suspicious_keywords', False)),
                        int(features.get('suspicious_tld', False)),
                        features.get('path_depth', 0),
                        int(features.get('has_query', False)),
                        int(features.get('has_fragment', False))
                    ]
                    
                    if hasattr(model, 'predict_proba'):
                        score = model.predict_proba([feature_vector])[0, 1]
                    else:
                        score = model.predict([feature_vector])[0]
                    
                    verdict = 'suspicious' if score > 0.5 else 'benign'
                    return {
                        'verdict': verdict,
                        'reason': f'ML model score: {score:.3f}',
                        'confidence': abs(score - 0.5) * 2
                    }
            except Exception as e:
                return {
                    'verdict': 'unknown',
                    'reason': f'Model error: {str(e)}',
                    'confidence': 0.0
                }
        
        # Fallback: basic heuristic analysis
        features = extract_url_features(url)
        suspicious_count = sum([
            features.get('suspicious_keywords', False),
            features.get('suspicious_tld', False),
            features.get('has_hyphen', False) and features.get('has_numbers', False)
        ])
        
        if suspicious_count >= 2:
            return {
                'verdict': 'suspicious',
                'reason': f'Heuristic analysis: {suspicious_count} suspicious features detected',
                'confidence': 0.6
            }
        else:
            return {
                'verdict': 'benign',
                'reason': 'Heuristic analysis: no significant suspicious features',
                'confidence': 0.4
            }
            
    except Exception as e:
        return {
            'verdict': 'unknown',
            'reason': f'Classification error: {str(e)}',
            'confidence': 0.0
        }

def analyze_text_content(text, content_type='general'):
    """Analyze text content for suspicious patterns"""
    try:
        text_lower = text.lower()
        
        # Common suspicious patterns
        suspicious_patterns = [
            r'urgent.*action.*required',
            r'click.*here.*immediately',
            r'verify.*account.*now',
            r'limited.*time.*offer',
            r'act.*now.*or.*lose',
            r'congratulations.*winner',
            r'free.*money.*guaranteed'
        ]
        
        pattern_matches = sum(1 for pattern in suspicious_patterns if re.search(pattern, text_lower))
        
        # Check for excessive use of caps
        caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
        
        # Check for excessive punctuation
        punct_ratio = sum(1 for c in text if c in '!?') / max(len(text), 1)
        
        suspicious_score = (pattern_matches * 0.3 + caps_ratio * 0.3 + punct_ratio * 0.4)
        
        if suspicious_score > 0.6:
            verdict = 'suspicious'
            reason = f'High suspicious content score: {suspicious_score:.2f}'
        elif suspicious_score > 0.3:
            verdict = 'moderate'
            reason = f'Moderate suspicious content score: {suspicious_score:.2f}'
        else:
            verdict = 'benign'
            reason = f'Low suspicious content score: {suspicious_score:.2f}'
        
        return {
            'verdict': verdict,
            'reason': reason,
            'confidence': suspicious_score
        }
        
    except Exception as e:
        return {
            'verdict': 'unknown',
            'reason': f'Text analysis error: {str(e)}',
            'confidence': 0.0
        }

@app.route('/classify', methods=['POST'])
def classify():
    try:
        data = request.json or {}
        typ = data.get('type')
        payload = data.get('payload', {})
        
        if typ == 'url':
            url = payload.get('url')
            if not url:
                return jsonify({'verdict': 'error', 'reason': 'No URL provided'}), 400
            
            result = classify_url_with_model(url)
            return jsonify(result)
            
        elif typ == 'ebay':
            # Analyze eBay listing
            url = payload.get('url', '')
            title = payload.get('title', '')
            price = payload.get('price', '')
            seller = payload.get('seller', '')
            desc = payload.get('desc', '')
            
            # Combine all text for analysis
            combined_text = f"{title} {desc} {seller}".strip()
            
            # First check URL
            url_result = classify_url_with_model(url) if url else {'verdict': 'unknown', 'reason': 'No URL'}
            
            # Then analyze text content
            text_result = analyze_text_content(combined_text, 'ebay')
            
            # Combine results
            if url_result['verdict'] == 'phishing':
                final_verdict = 'phishing'
                reason = f"URL flagged: {url_result['reason']}"
            elif text_result['verdict'] == 'suspicious':
                final_verdict = 'suspicious'
                reason = f"Content analysis: {text_result['reason']}"
            else:
                final_verdict = 'benign'
                reason = "No suspicious patterns detected"
            
            return jsonify({
                'verdict': final_verdict,
                'reason': reason,
                'details': {
                    'url_analysis': url_result,
                    'content_analysis': text_result
                }
            })
            
        elif typ == 'youtube':
            # Analyze YouTube video
            url = payload.get('url', '')
            title = payload.get('title', '')
            channel = payload.get('channel', '')
            desc = payload.get('desc', '')
            
            combined_text = f"{title} {desc}".strip()
            
            # Check URL first
            url_result = classify_url_with_model(url) if url else {'verdict': 'unknown', 'reason': 'No URL'}
            
            # Analyze content for misinformation patterns
            text_result = analyze_text_content(combined_text, 'youtube')
            
            # YouTube-specific checks
            misinformation_keywords = [
                'fake news', 'conspiracy', 'hoax', 'misleading',
                'unverified', 'rumor', 'false claim'
            ]
            
            has_misinfo_keywords = any(keyword in combined_text.lower() for keyword in misinformation_keywords)
            
            if has_misinfo_keywords or text_result['verdict'] == 'suspicious':
                final_verdict = 'misleading'
                reason = f"Potential misinformation detected: {text_result['reason']}"
            else:
                final_verdict = 'reliable'
                reason = "No obvious misinformation patterns detected"
            
            return jsonify({
                'verdict': final_verdict,
                'reason': reason,
                'details': {
                    'url_analysis': url_result,
                    'content_analysis': text_result,
                    'channel': channel
                }
            })
            
        elif typ == 'tos':
            # Analyze Terms of Service
            text = payload.get('text', '')
            url = payload.get('url', '')
            
            if not text:
                return jsonify({'verdict': 'error', 'reason': 'No text provided'}), 400
            
            # Look for problematic clauses
            problematic_patterns = [
                r'we.*not.*liable.*for.*any.*damages',
                r'we.*reserve.*right.*to.*change.*terms',
                r'you.*agree.*to.*arbitration',
                r'we.*may.*sell.*your.*data',
                r'we.*collect.*personal.*information',
                r'third.*party.*access.*to.*your.*data'
            ]
            
            found_clauses = []
            for pattern in problematic_patterns:
                matches = re.findall(pattern, text.lower())
                if matches:
                    found_clauses.append(pattern)
            
            if len(found_clauses) >= 3:
                verdict = 'problematic'
                reason = f"Found {len(found_clauses)} potentially problematic clauses"
            elif len(found_clauses) >= 1:
                verdict = 'moderate'
                reason = f"Found {len(found_clauses)} potentially problematic clauses"
            else:
                verdict = 'acceptable'
                reason = "No obviously problematic clauses detected"
            
            return jsonify({
                'verdict': verdict,
                'reason': reason,
                'problematic_clauses': found_clauses,
                'text_length': len(text)
            })
            
        else:
            return jsonify({'verdict': 'error', 'reason': f'Unknown classification type: {typ}'}), 400
            
    except Exception as e:
        return jsonify({'verdict': 'error', 'reason': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'phishing_db_loaded': phish_df is not None
    })

if __name__ == "__main__":
    print("Starting AEGIS classifier server...")
    print(f"Model loaded: {model is not None}")
    print(f"Phishing database loaded: {phish_df is not None}")
    app.run(host='127.0.0.1', port=5000, debug=True)
