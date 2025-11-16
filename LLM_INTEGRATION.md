# LLM Analysis Integration

This extension now includes LLM-based content analysis for YouTube videos using Google's Gemini API. This provides more accurate and nuanced content classification compared to pattern matching alone.

## Setup

1. Get a Gemini API key from Google Cloud Console
2. Set the API key as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

3. Install additional Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the LLM server:
   ```bash
   python server/llm_server.py
   ```

## Features

- Dual analysis system:
  - Primary: LLM-based analysis using Gemini API
  - Fallback: Pattern matching analysis
- Enhanced content classification:
  - FACTUAL
  - MISLEADING
  - SATIRE
  - OPINION
- Confidence levels with detailed explanations
- Score breakdown across categories
- Automatic fallback to pattern matching if LLM fails

## Testing

Run the integration tests:
```bash
python -m unittest server/test_llm_server.py
```

## Technical Details

- LLM server runs on port 5000
- Uses Flask for the API server
- Results are cached to minimize API calls
- Gemini API provides:
  - Content classification
  - Confidence scores
  - Detailed reasoning
  - Category-specific scores