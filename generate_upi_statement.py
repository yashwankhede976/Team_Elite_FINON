#!/usr/bin/env python3
"""
generate_upi_statement.py
─────────────────────────
Synthetic UPI Transaction Statement Generator
Generates 3 months of realistic UPI transactions for testing the
UPI Transaction Statement Analyser & Savings Intelligence Tool.

Usage:
    python generate_upi_statement.py

Outputs:
    sample_upi_statement.csv          ← Combined 3-month statement
    sample_upi_statement_jan.csv      ← January
    sample_upi_statement_feb.csv      ← February
    sample_upi_statement_mar.csv      ← March

Fields: Date, Transaction ID, Description, Debit, Credit, Balance, UPI Ref
"""

import csv
import random
import string
from datetime import date, timedelta

# ─── Merchant pools ────────────────────────────────────────────────────────────

MERCHANTS = [
    # (name, category, avg_amount, std_dev, frequency_per_month)
    ("Swiggy", "Food & Dining", 350, 150, 8),
    ("Zomato", "Food & Dining", 280, 120, 6),
    ("Dominos", "Food & Dining", 480, 100, 3),
    ("McDonald's", "Food & Dining", 320, 80, 2),
    ("BigBasket", "Food & Dining", 1200, 400, 4),
    ("Blinkit", "Food & Dining", 650, 250, 6),

    ("Ola", "Transport", 180, 80, 10),
    ("Uber", "Transport", 220, 90, 8),
    ("Rapido", "Transport", 90, 30, 6),
    ("IRCTC", "Transport", 850, 400, 2),
    ("RedBus", "Transport", 750, 300, 1),
    ("NHAI Fastag", "Transport", 200, 50, 4),

    ("Amazon", "Shopping", 1500, 800, 5),
    ("Flipkart", "Shopping", 1200, 600, 4),
    ("Myntra", "Shopping", 900, 400, 2),
    ("Nykaa", "Shopping", 700, 300, 2),
    ("Ajio", "Shopping", 850, 350, 1),

    ("Airtel Postpaid", "Utilities", 649, 0, 1),       # Recurring
    ("Jio Fiber", "Utilities", 999, 0, 1),              # Recurring
    ("BESCOM Electricity", "Utilities", 1400, 300, 1),
    ("Indane Gas", "Utilities", 950, 0, 1),             # Recurring

    ("Netflix", "Subscriptions", 649, 0, 1),            # Recurring
    ("Spotify", "Subscriptions", 119, 0, 1),            # Recurring
    ("Amazon Prime", "Subscriptions", 299, 0, 1),       # Recurring
    ("Hotstar Premium", "Subscriptions", 299, 0, 1),    # Recurring

    ("Apollo Pharmacy", "Healthcare", 850, 400, 2),
    ("1mg", "Healthcare", 600, 250, 1),
    ("CureFit", "Healthcare", 2500, 0, 1),              # Recurring gym

    ("PVR Cinemas", "Entertainment", 650, 150, 2),
    ("BookMyShow", "Entertainment", 450, 120, 2),

    ("HDFC Life Insurance", "Finance & Insurance", 3500, 0, 1),  # Recurring
    ("Zerodha", "Finance & Insurance", 5000, 2000, 2),

    ("Unacademy", "Education", 1999, 0, 1),             # Recurring
]

INCOME_SOURCES = [
    ("Salary Credit - TCS", 85000),
    ("Salary Credit - Infosys", 72000),
    ("Salary Credit - Wipro", 68000),
    ("Salary Credit - Cognizant", 75000),
    ("Salary Credit - HCL", 70000),
]

PEER_TRANSFERS_SEND = [
    "Paid to Rahul Sharma", "Sent to Priya Verma", "Transfer to Amit Kumar",
    "UPI/P2P to Neha Gupta", "Split - Rohit Mehta", "Paid to Anjali Singh",
    "Rent payment - Landlord", "Paid to Vikram Nair",
]

PEER_TRANSFERS_RECV = [
    "Received from Rahul Sharma", "From Priya Verma", "Transfer from Amit Kumar",
    "UPI Credit Neha Gupta", "Refund - Ola", "Cashback Swiggy",
    "Received from Vikram Nair",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def rand_txn_id():
    """Generate a realistic UPI transaction ID."""
    return "TXN" + "".join(random.choices(string.digits, k=12))

def rand_upi_ref():
    """Generate a realistic UPI reference number."""
    return "".join(random.choices(string.digits, k=12))

def rand_amount(avg, std):
    """Generate a positive random amount."""
    if std == 0:
        return round(avg, 2)
    val = random.gauss(avg, std)
    return round(max(10, val), 2)

def random_date_in_month(year, month):
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    start = date(year, month, 1)
    delta = (next_month - start).days
    return start + timedelta(days=random.randint(0, delta - 1))


# ─── Generator ────────────────────────────────────────────────────────────────

def generate_month(year, month, salary_amount, opening_balance):
    rows = []

    # 1. Salary credit on the 1st
    salary_date = date(year, month, 1)
    rows.append({
        "Date": salary_date.strftime("%d/%m/%Y"),
        "Transaction ID": rand_txn_id(),
        "Description": f"Salary Credit NEFT",
        "Debit": "",
        "Credit": f"{salary_amount:.2f}",
        "Balance": 0,          # Will recalculate
        "UPI Ref": rand_upi_ref(),
    })

    # 2. Merchant expenses
    for merchant, category, avg_amt, std_amt, freq in MERCHANTS:
        n_txns = max(0, round(random.gauss(freq, max(1, freq * 0.3))))
        for _ in range(n_txns):
            amt = rand_amount(avg_amt, std_amt)
            rows.append({
                "Date": random_date_in_month(year, month).strftime("%d/%m/%Y"),
                "Transaction ID": rand_txn_id(),
                "Description": f"UPI/{merchant}",
                "Debit": f"{amt:.2f}",
                "Credit": "",
                "Balance": 0,
                "UPI Ref": rand_upi_ref(),
            })

    # 3. Peer transfers (sent) – 5-10 per month
    for _ in range(random.randint(5, 10)):
        amt = rand_amount(800, 500)
        rows.append({
            "Date": random_date_in_month(year, month).strftime("%d/%m/%Y"),
            "Transaction ID": rand_txn_id(),
            "Description": random.choice(PEER_TRANSFERS_SEND),
            "Debit": f"{amt:.2f}",
            "Credit": "",
            "Balance": 0,
            "UPI Ref": rand_upi_ref(),
        })

    # 4. Peer transfers (received) – 2-4 per month
    for _ in range(random.randint(2, 4)):
        amt = rand_amount(600, 300)
        rows.append({
            "Date": random_date_in_month(year, month).strftime("%d/%m/%Y"),
            "Transaction ID": rand_txn_id(),
            "Description": random.choice(PEER_TRANSFERS_RECV),
            "Debit": "",
            "Credit": f"{amt:.2f}",
            "Balance": 0,
            "UPI Ref": rand_upi_ref(),
        })

    # 5. Sort by date
    rows.sort(key=lambda r: r["Date"].split("/")[::-1])

    # 6. Recalculate running balance
    balance = opening_balance + salary_amount
    for r in rows:
        if r["Description"] == "Salary Credit NEFT":
            # Already credited at start
            r["Balance"] = f"{balance:.2f}"
        elif r["Credit"]:
            balance += float(r["Credit"])
            r["Balance"] = f"{balance:.2f}"
        elif r["Debit"]:
            balance -= float(r["Debit"])
            balance = max(balance, 0)   # No overdraft in demo
            r["Balance"] = f"{balance:.2f}"

    return rows, balance     # Return closing balance for next month


def write_csv(filename, rows):
    fieldnames = ["Date", "Transaction ID", "Description", "Debit", "Credit", "Balance", "UPI Ref"]
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ Written {len(rows)} rows → {filename}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("🏦  Synthetic UPI Statement Generator")
    print("━" * 45)

    # Pick a random salary
    _, salary = random.choice(INCOME_SOURCES)
    opening_balance = round(random.uniform(8000, 20000), 2)

    months = [
        (2025, 1, "jan"),
        (2025, 2, "feb"),
        (2025, 3, "mar"),
    ]

    all_rows = []

    for year, month, label in months:
        print(f"\n📅  Generating {label.upper()} {year}  (salary ₹{salary:,})")
        rows, opening_balance = generate_month(year, month, salary, opening_balance)
        write_csv(f"sample_upi_statement_{label}.csv", rows)
        all_rows.extend(rows)

    # Combined file — sort chronologically
    all_rows.sort(key=lambda r: list(reversed(r["Date"].split("/"))))
    write_csv("sample_upi_statement.csv", all_rows)

    print(f"\n✅  Done! Generated {len(all_rows)} total transactions across 3 months.")
    print("📂  Files: sample_upi_statement.csv  (and _jan, _feb, _mar variants)")
    print("\nUpload sample_upi_statement.csv to the UPI Analyser to test it!")


if __name__ == "__main__":
    main()
