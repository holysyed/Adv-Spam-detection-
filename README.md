# Adv-Spam-detection-

# Vibecheck — Spam Message Classifier

A Flask app that classifies messages using TF-IDF features and logistic regression. The interface supports keyboard shortcuts, touch gestures, example messages, a spam score, and terms that contributed toward the spam prediction.

## Run locally

Requires Python 3.10 or newer.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python train.py
python app.py
```

Open http://127.0.0.1:5000. Press Ctrl+Enter (or Cmd+Enter) to classify; tap or swipe the example control to cycle examples.

## Train with real data

The default model is trained on only 24 illustrative messages. It is for a UI demo and is **not suitable for real spam detection**. For meaningful results, obtain a responsibly sourced, labeled dataset and provide a UTF-8 CSV with `label` and `message` columns. Labels can be `ham`/`spam` or `0`/`1`.

```bash
python train.py --csv data/messages.csv
```

For datasets with at least 20 rows, the script reports metrics on a stratified held-out split before fitting the final model on all rows. Evaluate on a separate representative test set before deployment; reported scores are model probabilities, not calibrated guarantees. `model.joblib` and `data/` are ignored by Git. Only load model files you trust: joblib files can execute code when loaded.

Messages are processed on the server and are not stored by the application. Avoid sending sensitive content to any hosted copy. This development server is for local use.

## Photo scanner and email screenshots

The `/photo` page uses a quantized ONNX version of the [deepfake vs real face image model](https://huggingface.co/dima806/deepfake_vs_real_image_detection). The model is downloaded on the first scan and runs in the browser. Photos are not uploaded by the app. It accepts JPG, PNG, and WebP files up to 8 MB.

The model was trained on older face images and can be wrong. Its score is an experimental signal, not proof of authenticity; check independent evidence. The model is intended for face photos and does not analyze video or audio.

On the message page, choose an email screenshot to extract English text in the browser using Tesseract.js. Review the extracted text before selecting **Check the vibe**. The app sends the resulting text to the server for classification only when you click the button. OCR can make mistakes; longer text is limited to 5,000 characters. The first use downloads OCR resources.

## Vercel deployment

`vercel.json` configures the Flask app. The Vercel version builds the small sample spam model in memory when no `model.joblib` exists. Source assets are under `public/static/`. These sample predictions are not suitable for production spam filtering.