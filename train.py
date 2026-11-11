"""Train from a CSV with label and message columns (ham/spam or 0/1)."""
import argparse
import csv
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.pipeline import make_pipeline

DEMO = [
 ('spam','Congratulations you won a free prize claim now'), ('spam','URGENT your account is locked click this link to verify'),
 ('spam','You have won cash call now to collect your reward'), ('spam','Exclusive offer free gift click here today'),
 ('spam','Your bank account suspended update your password immediately'), ('spam','Act now limited time loan guaranteed approval'),
 ('spam','Free entry win a vacation text WIN to claim'), ('spam','Your package is held pay delivery fee now'),
 ('spam','Earn money fast from home no experience required'), ('spam','You are selected for a prize send your details'),
 ('spam','Claim your lottery winnings reply with bank details'), ('spam','Click here for cheap pills special discount'),
 ('ham','Hey are we still meeting for lunch today'), ('ham','Can you send me the notes from class'),
 ('ham','I will be home in ten minutes'), ('ham','Happy birthday hope you have a wonderful day'),
 ('ham','Please review the project before our meeting'), ('ham','Thanks for your help see you tomorrow'),
 ('ham','The package arrived at the front desk'), ('ham','Would you like to grab coffee this afternoon'),
 ('ham','Your appointment is scheduled for next Tuesday'), ('ham','I sent the photos to your email'),
 ('ham','Let me know when you are free to talk'), ('ham','We need to finish the assignment by Friday'),
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, help='CSV containing label and message columns')
    parser.add_argument('--output', type=Path, default=Path('model.joblib'))
    args = parser.parse_args()
    rows = DEMO
    if args.csv:
        with args.csv.open(encoding='utf-8-sig', newline='') as f:
            rows = [(r['label'].strip().lower(), r['message'].strip()) for r in csv.DictReader(f)]
        rows = [('spam' if label in ('spam','1') else 'ham' if label in ('ham','0') else label, message) for label, message in rows]
        if any(label not in ('spam','ham') or not message for label, message in rows):
            raise SystemExit('Each row needs a non-empty message and label ham/spam or 0/1.')
    if min(sum(label == name for label, _ in rows) for name in ('ham','spam')) < 2:
        raise SystemExit('Provide at least two examples of each class.')
    y, X = zip(*rows)
    model = make_pipeline(TfidfVectorizer(ngram_range=(1,2), sublinear_tf=True), LogisticRegression(class_weight='balanced', max_iter=1000))
    if args.csv and len(rows) >= 20:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
        model.fit(X_train, y_train)
        print('Held-out evaluation:\n' + classification_report(y_test, model.predict(X_test), zero_division=0))
    model.fit(X, y)
    joblib.dump({'pipeline': model, 'source': 'dataset' if args.csv else 'tiny demo dataset'}, args.output)
    print(f'Saved {args.output}. Training examples: {len(rows)}')

if __name__ == '__main__':
    main()
