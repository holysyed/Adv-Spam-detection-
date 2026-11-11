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

## Experimental photo scanner

Install the optional image dependencies with `pip install -r requirements-photo.txt`, then restart the app. Choose or drop a JPEG, PNG, or WebP face photo (up to 8 MB and 20 megapixels) and select **Scan photo**. The first scan downloads the pretrained [deepfake vs real image model](https://huggingface.co/dima806/deepfake_vs_real_image_detection) from Hugging Face and may take time and substantial disk space; later scans use the local cache. Photos are processed in memory on the server and are not saved by the app. The image itself is not sent to Hugging Face by this application.

The model was trained on older face images and may miss newer manipulation techniques or incorrectly flag real photos. Its score is an experimental signal, not proof of authenticity. It is not designed for video, audio, or arbitrary image editing detection. Verify important claims with independent evidence.
