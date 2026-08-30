import sys
import json
import os

import numpy as np
import joblib


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "ai",
    "identity_model.joblib"
)


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

def load_model():

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            "AI model not found. "
            "Run: python3 ai/trainModel.py"
        )

    return joblib.load(MODEL_PATH)


# --------------------------------------------------
# RISK ANALYSIS
# --------------------------------------------------

def analyze_activity(activity):

    model = load_model()

    verification_attempts = activity[
        "verificationAttempts"
    ]

    failed_verifications = activity[
        "failedVerifications"
    ]

    registrations = activity[
        "registrations"
    ]

    unique_ips = activity[
        "uniqueIPs"
    ]

    features = np.array([[
        verification_attempts,
        failed_verifications,
        registrations,
        unique_ips
    ]], dtype=float)

    # ----------------------------------------------
    # MACHINE LEARNING ANOMALY DETECTION
    # ----------------------------------------------

    prediction = model.predict(features)[0]

    anomaly_score = model.decision_function(features)[0]

    ml_risk_score = max(
        0,
        min(
            100,
            round((0.5 - anomaly_score) * 100, 2)
        )
    )


    # ----------------------------------------------
    # SECURITY RISK FACTORS
    # ----------------------------------------------

    if verification_attempts > 0:
        failure_rate = (
            failed_verifications /
            verification_attempts
        )
    else:
        failure_rate = 0


    # Failed authentication risk
    failure_risk = min(
        40,
        failure_rate * 40
    )


    # Excessive verification attempts
    attempt_risk = min(
        30,
        max(
            0,
            (verification_attempts - 10) * 0.5
        )
    )


    # Multiple IP address risk
    ip_risk = min(
        20,
        max(
            0,
            (unique_ips - 3) * 0.5
        )
    )


    # Large number of failed attempts
    brute_force_risk = min(
        30,
        failed_verifications * 0.3
    )


    security_risk = (
        failure_risk +
        attempt_risk +
        ip_risk +
        brute_force_risk
    )

    security_risk = min(
        100,
        security_risk
    )


    # ----------------------------------------------
    # COMBINED AI + SECURITY SCORE
    # ----------------------------------------------

    risk_score = round(
        (
            ml_risk_score * 0.4
        ) +
        (
            security_risk * 0.6
        ),
        2
    )


    # ----------------------------------------------
    # ANOMALY DECISION
    # ----------------------------------------------

    if (
        prediction == -1
        or risk_score >= 40
    ):
        anomaly = True
    else:
        anomaly = False


    # ----------------------------------------------
    # SECURITY STATUS
    # ----------------------------------------------

    if risk_score >= 70:

        status = "HIGH_RISK"

    elif risk_score >= 40:

        status = "SUSPICIOUS"

    else:

        status = "NORMAL"


    return {
        "anomaly": anomaly,
        "riskScore": risk_score,
        "status": status
    }


# --------------------------------------------------
# INPUT VALIDATION
# --------------------------------------------------

def validate_activity(activity):

    required_fields = [
        "verificationAttempts",
        "failedVerifications",
        "registrations",
        "uniqueIPs"
    ]

    for field in required_fields:

        if field not in activity:
            raise ValueError(
                f"Missing required field: {field}"
            )

    numeric_values = [
        activity["verificationAttempts"],
        activity["failedVerifications"],
        activity["registrations"],
        activity["uniqueIPs"]
    ]

    for value in numeric_values:

        if not isinstance(value, (int, float)):
            raise ValueError(
                "Activity values must be numeric"
            )

        if not np.isfinite(value):
            raise ValueError(
                "Activity values must be finite"
            )

        if value < 0:
            raise ValueError(
                "Activity values cannot be negative"
            )


# --------------------------------------------------
# COMMAND LINE INTERFACE
# --------------------------------------------------

if __name__ == "__main__":

    try:

        input_data = sys.stdin.read()

        if not input_data.strip():
            raise ValueError(
                "No activity data provided"
            )

        activity = json.loads(input_data)

        validate_activity(activity)

        result = analyze_activity(activity)

        print(json.dumps(result))

    except Exception as error:

        print(json.dumps({
            "error": str(error)
        }))

        sys.exit(1)
