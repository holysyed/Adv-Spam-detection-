"""Train the message classifier from the UCI SMS archive or a labeled CSV."""
import argparse
import csv
from pathlib import Path
from zipfile import ZipFile
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.pipeline import FeatureUnion, make_pipeline

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

def read_rows(args):
    if args.uci_zip:
        with ZipFile(args.uci_zip) as archive:
            lines = archive.read('SMSSpamCollection').decode('utf-8').splitlines()
        return [line.split('\t', 1) for line in lines if line.strip()]
    with args.csv.open(encoding='utf-8-sig', newline='') as stream:
        return [(row['label'], row['message']) for row in csv.DictReader(stream)]


def unique_rows(rows):
    labels = {'0': 'ham', '1': 'spam', 'ham': 'ham', 'spam': 'spam'}
    examples = {}
    conflicts = set()
    for raw_label, message in rows:
        label = labels.get(raw_label.strip().lower())
        key = ' '.join(message.casefold().split())
        if label is None or not key:
            raise ValueError('Each row needs a message and a ham/spam or 0/1 label.')
        if key in examples and examples[key][0] != label:
            conflicts.add(key)
        examples.setdefault(key, (label, message.strip()))
    return [row for key, row in examples.items() if key not in conflicts]


def build_model(c, min_df):
    features = FeatureUnion([
        ('word', TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=min_df)),
        ('char', TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5),
                                 sublinear_tf=True, min_df=min_df, max_features=40000)),
    ])
    return make_pipeline(features, LogisticRegression(
        C=c, class_weight='balanced', solver='liblinear', max_iter=1000, random_state=42))


def fit(model, rows):
    labels, messages = zip(*rows)
    return model.fit(messages, labels)


def split(rows):
    return train_test_split(rows, test_size=max(2, round(len(rows) * 0.2)),
                            stratify=[label for label, _ in rows], random_state=42)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument('--csv', type=Path, help='CSV with label and message columns')
    inputs.add_argument('--uci-zip', type=Path, help='Original UCI SMS Spam Collection ZIP')
    parser.add_argument('--output', type=Path, default=Path('model.joblib'))
    args = parser.parse_args()
    rows = unique_rows(read_rows(args))
    smallest_class = min(sum(label == name for label, _ in rows) for name in ('ham', 'spam'))
    if smallest_class < 2:
        parser.error('Provide at least two distinct messages per class.')
    min_df = 2 if len(rows) >= 100 else 1
    c = 4
    extras = DEMO if args.uci_zip else []
    if smallest_class >= 10 and len(rows) >= 100:
        train, test = split(rows)
        subtrain, validation = split(train)
        val_labels, val_messages = zip(*validation)
        scores = {}
        for candidate in (1, 4, 16):
            model = fit(build_model(candidate, min_df), subtrain + extras)
            scores[candidate] = f1_score(val_labels, model.predict(val_messages), pos_label='spam')
        c = max(scores, key=scores.get)
        print('Validation spam F1 by C:', scores, 'Selected C:', c)
        baseline = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
                                 LogisticRegression(class_weight='balanced', max_iter=1000))
        test_labels, test_messages = zip(*test)
        for name, model in [('24-message baseline', fit(baseline, DEMO)),
                            ('Word + character model', fit(build_model(c, min_df), train + extras))]:
            predicted = model.predict(test_messages)
            print(name, 'on', len(test), 'held-out messages')
            print(classification_report(test_labels, predicted, digits=4, zero_division=0))
            print(confusion_matrix(test_labels, predicted, labels=['ham', 'spam']))
    final = fit(build_model(c, min_df), unique_rows(rows + extras))
    source = 'UCI SMS + Vibecheck examples' if args.uci_zip else 'Custom dataset'
    joblib.dump({'pipeline': final, 'source': source}, args.output, compress=3)
    print('Saved', args.output, 'with', final[-1].coef_.size + 1, 'parameters;',
          len(rows), 'unique corpus messages plus', len(extras), 'examples.')


if __name__ == '__main__':
    main()
