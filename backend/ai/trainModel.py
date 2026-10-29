import os
import sqlite3

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "identity_model.joblib")
DB_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "../config/identity.db")
)


def load_historical_activity():
    rows = []

    if not os.path.exists(DB_PATH):
        print("Database not found; using baseline training data.")
        return rows

    try:
        connection = sqlite3.connect(DB_PATH)

        query = """
            SELECT
                COUNT(*) AS attempts,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
                COUNT(DISTINCT ip_address) AS unique_ips
            FROM authentication_events
            WHERE identity_id IS NOT NULL
            GROUP BY identity_id
        """

        for attempts, failures, unique_ips in connection.execute(query):
            failures = int(failures or 0)
            unique_ips = int(unique_ips or 1)

            rows.append([
                failures,
                max(0, unique_ips - 1)
            ])

        connection.close()

    except sqlite3.Error as error:
        print(f"Historical activity could not be loaded: {error}")

    return rows


def main():
    # Representative baseline patterns:
    # most normal activity has few failures and limited IP diversity.
    normal_patterns = [
        [0, 0]
    ] * 60 + [
        [0, 1]
    ] * 15 + [
        [0, 2]
    ] * 5 + [
        [1, 0]
    ] * 8 + [
        [1, 1]
    ] * 4 + [
        [2, 0]
    ] * 3

    # Representative anomalous patterns for training the outlier detector.
    anomaly_patterns = [
        [3, 0], [4, 0], [5, 0], [6, 0],
        [3, 1], [4, 1], [5, 2], [6, 2],
        [2, 4], [1, 5], [4, 4], [8, 1],
        [10, 0], [7, 3], [9, 2]
    ]

    historical_patterns = load_historical_activity()

    training_data = (
        normal_patterns
        + anomaly_patterns
        + historical_patterns
    )

    X = np.asarray(training_data, dtype=float)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("detector", IsolationForest(
            n_estimators=200,
            contamination=0.10,
            random_state=42
        ))
    ])

    model.fit(X)
    joblib.dump(model, MODEL_PATH)

    print("AI model trained successfully.")
    print(f"Training samples: {len(X)}")
    print(f"Historical identity patterns: {len(historical_patterns)}")
    print(f"Saved model: {MODEL_PATH}")


if __name__ == "__main__":
    main()
