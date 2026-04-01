# ai_assistant/services/simulation_service.py

import json
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def simulate_financial_impact(scenario_type: str, amount: float, current_score: int = 750, scenario_details: dict = None) -> dict:
    """
    Simulate the impact of a financial decision using deterministic rules.
    Removes the LLM dependency for instant, reliable hackathon results.
    """
    if scenario_details is None:
        scenario_details = {}

    stype = scenario_type.lower()
    impact_points = 0
    risk_level = "LOW"
    score_trend = "STABLE"
    
    observations = []
    recommendations = []
    warnings = []
    
    # 1. New Loan Application (Hard Inquiry + Increased Debt)
    if stype in ["new_loan", "personal_loan", "home_loan", "auto_loan"]:
        impact_points = -15
        risk_level = "MEDIUM" if amount > 500000 else "LOW"
        score_trend = "DECLINING"
        observations.append(f"Applying for a ₹{amount:,.0f} loan triggers a hard inquiry.")
        observations.append("It temporarily lowers your score and increases your credit utilization.")
        recommendations.append("Ensure you don't apply for multiple loans within a 6-month period.")
        recommendations.append("Set up auto-pay to ensure timely EMI payments once approved.")
        if amount > 1000000:
            warnings.append("High loan amount significantly impacts debt-to-income ratio.")
            
    # 2. Credit Card Application
    elif stype in ["new_credit_card", "credit_card"]:
        impact_points = -5
        risk_level = "LOW"
        score_trend = "STABLE"
        observations.append("New credit card applications cause minor temporary score drops.")
        observations.append("It will eventually improve your credit mix and total credit limit.")
        recommendations.append("Keep utilization below 30% of your new limit.")
        
    # 3. Missed Payment / Default
    elif stype in ["missed_emi", "default", "missed_payment"]:
        impact_points = max(-50, -int(amount * 0.005) - 30)  # Heavy penalty
        risk_level = "HIGH"
        score_trend = "DECLINING"
        observations.append(f"Missing a ₹{amount:,.0f} payment is a severe negative event on your credit report.")
        recommendations.append("Pay the due amount immediately including late fees.")
        recommendations.append("Contact your lender to negotiate if facing financial hardship.")
        warnings.append("Missed payments stay on your credit report for up to 7 years.")
        
    # 4. Large Payoff / Premature Closure
    elif stype in ["loan_payoff", "early_closure", "payoff"]:
        impact_points = +15
        risk_level = "LOW"
        score_trend = "IMPROVING"
        observations.append(f"Paying off ₹{amount:,.0f} heavily reduces your outstanding debt burden.")
        recommendations.append("Ensure you obtain a No Objection Certificate (NOC) from the bank.")
        recommendations.append("Keep your oldest credit accounts open to maintain credit history length.")
        
    # 5. Generic Default
    else:
        impact_points = -5
        risk_level = "MEDIUM"
        score_trend = "STABLE"
        observations.append(f"Scenario: {scenario_type} involving ₹{amount:,.0f}.")
        recommendations.append("Monitor your credit report regularly via CIBIL/Experian.")

    # Calculate final score (bounded 300 - 900)
    new_score = max(300, min(900, current_score + impact_points))
    
    analysis = (
        f"This scenario is estimated to {'reduce' if impact_points < 0 else 'increase' if impact_points > 0 else 'maintain'} "
        f"your score by {abs(impact_points)} points. Overall risk is {risk_level} and trend is {score_trend.title()}."
    )

    return {
        "impact_points": impact_points,
        "new_score": new_score,
        "risk_level": risk_level,
        "score_trend": score_trend,
        "analysis": analysis,
        "key_observations": observations,
        "recommendations": recommendations,
        "critical_warnings": warnings
    }


def analyze_credit_health(loans: list, current_score: int) -> dict:
    """
    Analyze the user's full credit profile and loan portfolio deterministically.
    """
    total_principal = 0
    total_emi = 0
    missed_payments = 0
    
    if loans:
        for loan in loans:
            try:
                total_principal += float(loan.get('principal', 0))
                total_emi += float(loan.get('emi', 0))
                missed = loan.get('missed_emis', 0)
                if missed:
                    missed_payments += int(missed)
            except (ValueError, TypeError):
                pass

    # Basic Risk Scoring
    if missed_payments > 0:
        risk_level = "HIGH"
        score_trend = "DECLINING"
        analysis = "Your credit profile is at severe risk due to missed EMI payments."
        predicted_score_range = f"{max(300, current_score - 40)} - {max(300, current_score - 10)}"
    elif total_emi > 50000:
        risk_level = "MEDIUM"
        score_trend = "STABLE"
        analysis = "You have a high debt obligation, but no reported missed payments."
        predicted_score_range = f"{max(300, current_score - 5)} - {min(900, current_score + 15)}"
    elif not loans:
        risk_level = "LOW"
        score_trend = "STABLE"
        analysis = "You have no active loans reported. This keeps your risk low, though maintaining a credit mix helps build your score."
        predicted_score_range = f"{current_score} - {min(900, current_score + 10)}"
    else:
        risk_level = "LOW"
        score_trend = "IMPROVING"
        analysis = "Outstanding profile! You are managing your active loans correctly with no missed payments."
        predicted_score_range = f"{min(900, current_score + 10)} - {min(900, current_score + 25)}"

    # Generate insights
    observations = []
    actions = []
    warnings = []

    if loans:
        observations.append(f"You hold {len(loans)} active loan(s) with a total EMI of ₹{total_emi:,.0f}.")
    else:
        observations.append("No active credit facilities linked to this profile.")
        
    if missed_payments > 0:
        warnings.append(f"Critical: {missed_payments} missed payment(s) detected. Pay immediately to stop compounding penalties.")
        actions.append("Clear overdue EMIs within 30 days to mitigate severe CIBIL damage.")
    else:
        actions.append("Continue paying all EMIs on time before the due date.")

    if current_score < 600:
        warnings.append("Your score is well below average, making access to new credit difficult and expensive.")
        actions.append("Focus entirely on repayment; do not apply for any new credit.")
    elif current_score > 750:
        observations.append("Your score is excellent, qualifying you for the best market interest rates.")

    return {
        "risk_level": risk_level,
        "score_trend": score_trend,
        "predicted_score_range": predicted_score_range,
        "analysis": analysis,
        "key_observations": observations,
        "recommended_actions": actions,
        "critical_warnings": warnings 
    }
