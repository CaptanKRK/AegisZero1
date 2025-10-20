from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import joblib
import re
import os

MODEL_PATH = "model.pkl"
CSV_PATH = "phishing_site_urls.csv"

app = FastAPI(title="Phishing URL Detector")

# Allow CORS so the extension (service worker) can call localhost:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class URLRequest(BaseModel):
    url: str

def load_data(path=CSV_PATH, nrows=None):
    # robust CSV load: many rows are messy; use engine='python' and no strict quoting
    df = pd.read_csv(path, header=None, names=["url", "label"],
                     engine="python", nrows=nrows, encoding="utf-8", keep_default_na=False)
    # Clean label: mark 'bad' as phishing (1) else 0
    df["label"] = df["label"].astype(str).str.lower().str.strip().apply(lambda x: 1 if "bad" in x else 0)
    df = df[df["url"].astype(bool)]
    return df

def url_normalize(u: str):
    # basic normalization: lowercase and remove protocol
    u = u.strip()
    u = re.sub(r"^https?:\/\/", "", u, flags=re.I)
    return u.lower()

def make_pipeline():
    # Character n-grams on URLs are effective at this task
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3,5), preprocessor=url_normalize)
    clf = LogisticRegression(max_iter=1000, class_weight="balanced", solver="liblinear")
    return Pipeline([("tfidf", vec), ("clf", clf)])

def train_and_save_model(force_retrain=False):
    if os.path.exists(MODEL_PATH) and not force_retrain:
        return joblib.load(MODEL_PATH)
    df = load_data()
    if df.empty:
        raise RuntimeError("No training data loaded from " + CSV_PATH)
    X = df["url"].values
    y = df["label"].values
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.1, random_state=42, stratify=y)
    pipe = make_pipeline()
    pipe.fit(X_train, y_train)
    joblib.dump(pipe, MODEL_PATH)
    return pipe

# Train (or load) model at startup (small dataset => quick)
model = train_and_save_model()

@app.post("/predict")
def predict(req: URLRequest):
    u = req.url
    if not u or not isinstance(u, str):
        raise HTTPException(status_code=400, detail="url required")
    proba = model.predict_proba([u])[0][1]  # probability of class 1 (phishing)
    pred = int(proba >= 0.5)
    return {"url": u, "prediction": pred, "score": float(proba)}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)