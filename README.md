# Adv-Spam-detection-

# Vibecheck — Spam Message Classifier

**Live demo:** [vabecheck.vercel.app](https://vabecheck.vercel.app/) · [Photo scanner](https://vabecheck.vercel.app/photo)

A Flask app that classifies messages using TF-IDF features and logistic regression. The interface supports keyboard shortcuts, touch gestures, example messages, a spam score, and terms that contributed toward the spam prediction.

## Run locally

Use Python 3.12. A trained message classifier is included in the repository.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000. Press Ctrl+Enter (or Cmd+Enter) to classify; tap or swipe the example control to cycle examples.

## Message classifier

The classifier learns weights for words, word pairs and 3–5 character fragments. Character fragments let it recognize parts of misspelled or abbreviated words. The bundled logistic regression model has 47,719 learned coefficients including its intercept. It was fitted on 5,159 distinct SMS messages and the 24 original Vibecheck examples. Only whole-word and word-pair contributions appear in the interface.

The training script removes duplicates after normalizing case and whitespace, drops messages with conflicting labels and reserves a stratified 20% test set. On a separate validation split of the training data, it compared regularization values `C = 1, 4, 16` by spam F1 and selected 16. Both models below used the same 1,032 held-out messages (128 spam and 904 legitimate). The bundled model was then refitted on all available examples.

| Model | Spam precision | Spam recall | Spam F1 | False alarms | Missed spam |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original 24-example model | 43.3% | 57.8% | 49.5% | 97 | 54 |
| Word + character model | 96.0% | 93.8% | 94.9% | 5 | 8 |

These results measure performance on older English SMS. Accuracy on modern phishing, long emails and OCR errors needs separate evaluation. The displayed spam score is a model estimate.

### Reproduce training

Download the original ZIP for the SMS Spam Collection by Tiago Almeida and José María Gómez Hidalgo (2011), distributed under CC BY 4.0. Keep the ZIP intact and pass its path to the script. [UCI dataset and citation](https://doi.org/10.24432/C5CC84) · [License](https://creativecommons.org/licenses/by/4.0/)

```bash
python train.py --uci-zip data/sms-spam-collection.zip --output sms-spam.joblib
```

To train a local override, supply a UTF-8 CSV with `label` and `message` columns and labels `ham`/`spam` or `0`/`1`.

```bash
python train.py --csv data/messages.csv
```

The app uses a custom `model.joblib` when present and skips overrides tagged as the old tiny demo. Git ignores local overrides and `data/`. Only load trusted joblib files because they can execute code when opened.

Messages are processed on the server and are not stored by the application. Avoid sending sensitive content to any hosted copy. This development server is for local use.

## Photo scanner and email screenshots

The `/photo` page uses a quantized ONNX version of the [deepfake vs real face image model](https://huggingface.co/dima806/deepfake_vs_real_image_detection). The model is downloaded on the first scan and runs in the browser. Photos are not uploaded by the app. It accepts JPG, PNG, and WebP files up to 8 MB.

The model was trained on older face images and can be wrong. Its score is an experimental signal, not proof of authenticity; check independent evidence. The model is intended for face photos and does not analyze video or audio.

On the message page, choose an email screenshot to extract English text in the browser using Tesseract.js. Review the extracted text before selecting **Check the vibe**. The app sends the resulting text to the server for classification only when you click the button. OCR can make mistakes; longer text is limited to 5,000 characters. The first use downloads OCR resources.

## Vercel deployment

`vercel.json` includes the trained `sms-spam.joblib` in the Flask function. The first message scan loads the weights and subsequent scans reuse the model. Source assets are under `public/static/`.
