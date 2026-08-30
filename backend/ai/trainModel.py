import os
import sqlite3
import numpy as np
import joblib

from sklearn.ensemble import IsolationForest


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "config",
    "identity.db"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "ai",
    "identity_model.joblib"
)


def get_real_identity_activity():
    """
    Read authentication activity from the existing
    SQLite database and convert it into training features.
    """

    if not os.path.exists(DATABASE_PATH):
        return np.empty((0, 4))

    connection = sqlite3.connect(DATABASE_PATH)

    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            (
                SELECT COUNT(*)
                FROM authentication_events ae
                WHERE ae.identity_id = i.id
            ) AS verification_attempts,
            (
                SELECT COUNT(*)
                FROM authentication_events ae
                WHERE ae.identity_id = i.id
                AND ae.success = 0
            ) AS failed_verifications,
            (
                SELECT COUNT(DISTINCT ae.ip_address)
                FROM authentication_events ae
                WHERE ae.identity_id = i.id
                AND ae.ip_address IS NOT NULL
            ) AS unique_ips
        FROM identities i
    """)

    rows = cursor.fetchall()

    connection.close()

    if not rows:
        return np.empty((0, 4))

    features = []

    for row in rows:

        identity_id = row[0]
        verification_attempts = row[1]
        failed_verifications = row[2]
        unique_ips = row[3]

        # One current registration per identity.
        registrations = 1

        features.append([
            verification_attempts,
            failed_verifications,
            registrations,
            unique_ips
        ])

    return np.array(features, dtype=float)


def get_baseline_training_data():
    """
    Baseline normal activity used when the system does not
    yet have enough real authentication history.
    """

    return np.array([
        [1, 0, 1, 1],
        [2, 0, 1, 1],
        [3, 0, 2, 1],
        [2, 0, 2, 1],
        [4, 0, 2, 1],
        [3, 1, 2, 1],
        [5, 0, 3, 1],
        [4, 1, 3, 1],
        [2, 0, 1, 1],
        [3, 0, 2, 1],
        [5, 1, 3, 1],
        [4, 0, 2, 1],
    ], dtype=float)


def train_model():

    baseline = get_baseline_training_data()

    real_activity = get_real_identity_activity()

    if len(real_activity) > 0:
        training_data = np.vstack([
            baseline,
            real_activity
        ])

        print(
            f"Using {len(real_activity)} real identity activity records."
        )
    else:
        training_data = baseline

        print(
            "No real identity activity found. "
            "Using baseline training data."
        )

    model = IsolationForest(
        n_estimators=200,
        contamination=0.10,
        random_state=42
    )

    model.fit(training_data)

    joblib.dump(model, MODEL_PATH)

    print("\nModel trained successfully.")
    print("Training samples:", len(training_data))
    print("Model saved to:")
    print(MODEL_PATH)


if __name__ == "__main__":
    train_model()
