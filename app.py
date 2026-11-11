from pathlib import Path
from functools import lru_cache
import io
import joblib
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
MODEL = Path(__file__).with_name('model.joblib')

@lru_cache(maxsize=1)
def photo_model():
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    name = 'dima806/deepfake_vs_real_image_detection'
    processor = AutoImageProcessor.from_pretrained(name)
    model = AutoModelForImageClassification.from_pretrained(name)
    model.eval()
    return processor, model

@app.errorhandler(413)
def too_large(_error):
    return jsonify(error='Image is too large. Choose a file under 8 MB.'), 413

@app.post('/api/photo')
def analyze_photo():
    upload = request.files.get('image')
    if not upload or not upload.filename:
        return jsonify(error='Choose an image first.'), 400
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
        Image.MAX_IMAGE_PIXELS = 20_000_000
        image = Image.open(io.BytesIO(upload.read()))
        if image.format not in ('JPEG', 'PNG', 'WEBP'):
            return jsonify(error='Choose a JPEG, PNG, or WebP image.'), 400
        if image.width * image.height > 20_000_000:
            return jsonify(error='Image dimensions are too large (20 megapixels maximum).'), 400
        image = ImageOps.exif_transpose(image).convert('RGB')
    except (ImportError, ModuleNotFoundError):
        return jsonify(error='Photo dependencies are missing. Install requirements-photo.txt first.'), 503
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return jsonify(error='Could not read this image, or its dimensions are too large.'), 400
    try:
        import torch
        processor, model = photo_model()
        inputs = processor(images=image, return_tensors='pt')
        with torch.inference_mode():
            scores = model(**inputs).logits.softmax(dim=-1)[0]
        labels = {str(model.config.id2label[i]).lower(): float(scores[i]) for i in range(len(scores))}
        fake = next((value for label, value in labels.items() if label == 'fake'), None)
        if fake is None:
            return jsonify(error='The photo model has an unexpected label configuration.'), 503
        return jsonify(fake_score=round(fake * 100, 1))
    except (ImportError, ModuleNotFoundError):
        return jsonify(error='Photo dependencies are missing. Install requirements-photo.txt first.'), 503
    except Exception:
        app.logger.exception('Photo model failed to load or run')
        return jsonify(error='Photo model could not load. Check your connection and try again; the first scan downloads the model.'), 503

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
