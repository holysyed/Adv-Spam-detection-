from pathlib import Path
import joblib
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
MODEL = Path(__file__).with_name('model.joblib')

@app.get('/')
def home():
    return render_template('index.html')

@app.post('/api/classify')
def classify():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(error='Expected a JSON object.'), 400
    message = data.get('message', '')
    if not isinstance(message, str) or not message.strip() or len(message) > 5000:
        return jsonify(error='Enter a message between 1 and 5,000 characters.'), 400
    if not MODEL.exists():
        return jsonify(error='Model not found. Run python train.py first.'), 503
    bundle = joblib.load(MODEL)
    pipeline = bundle['pipeline']
    vectorizer, classifier = pipeline.steps[0][1], pipeline.steps[1][1]
    features = vectorizer.transform([message])
    probability = float(classifier.predict_proba(features)[0][list(classifier.classes_).index('spam')])
    contributions = features.multiply(classifier.coef_[0]).tocoo()
    names = vectorizer.get_feature_names_out()
    signals = sorted(((float(v), names[i]) for i, v in zip(contributions.col, contributions.data) if v > 0), reverse=True)[:4]
    return jsonify(label='spam' if probability >= .5 else 'ham', spam_score=round(probability * 100, 1), signals=[word for _, word in signals], source=bundle['source'])

if __name__ == '__main__':
    app.run(debug=False)
