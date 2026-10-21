#!/usr/bin/env python3
"""Clean the three program CSVs and write ONE json file for daily-coin.html.

Run from the repo root:
    python3 scripts/build_daily_dollar.py

Inputs  (data/precious/raw/):
    Average_Food_Cost_Per_Person.csv   $ per participant, per month
    Food_Costs.csv                     total $ per month
    Total_Number_of_Participants.csv   participants per month
Output:
    data/precious/daily-dollar.json

Nothing is estimated or pulled from anywhere else: every number on the page
is computed from these three files.
"""
import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "precious" / "raw"
OUT = ROOT / "data" / "precious" / "daily-dollar.json"

DAYS_PER_MONTH = 30.4  # average month length; used for every "per day" figure
TERRITORIES = {
    "Puerto Rico", "Virgin Islands", "Guam", "American Samoa", "Northern Marianas",
}
# "Mountain Plains" is a regional subtotal (it equals the sum of the rows above
# it), so keeping it would double count ~490K participants.
SUBTOTAL_ROWS = {"Mountain Plains"}


def agency_type(name: str) -> str:
    if name in TERRITORIES:
        return "Territory"
    if "," in name or "Nation" in name or "Tribe" in name or "Tribal" in name:
        return "Tribal"
    return "State"  # states and the District of Columbia


def load(filename: str, summary_col: str) -> pd.DataFrame:
    df = pd.read_csv(RAW / filename)
    df = df.rename(columns={df.columns[0]: "agency"})
    if summary_col not in df.columns:
        raise SystemExit(f"{filename}: expected a column named '{summary_col}'")
    df["agency"] = df["agency"].astype(str).str.strip()
    for col in df.columns[1:]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def clean(avg, cost, part):
    month_cols = list(avg.columns[1:13])
    # drop the empty duplicate row (Texas appears twice, once with no data)
    # and the regional subtotal row, using the same mask for all three files
    keep = ~avg[month_cols].isna().all(axis=1) & ~avg["agency"].isin(SUBTOTAL_ROWS)
    avg, cost, part = (d[keep].reset_index(drop=True) for d in (avg, cost, part))
    if not (avg["agency"].tolist() == cost["agency"].tolist() == part["agency"].tolist()):
        raise SystemExit("The three files list agencies in different orders; align them first.")
    return avg, cost, part, month_cols


def num(x, nd=4):
    """JSON-safe number (NaN -> None)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), nd)


def main():
    avg = load("Average_Food_Cost_Per_Person.csv", "Cumulative Average")
    cost = load("Food_Costs.csv", "Cumulative Cost")
    part = load("Total_Number_of_Participants.csv", "Average Participation")
    avg, cost, part, month_cols = clean(avg, cost, part)

    labels = [pd.to_datetime(c).strftime("%b %Y") for c in month_cols]

    # Sanity check: $ per person x participants should reproduce total cost
    implied = avg[month_cols].values * part[month_cols].values
    actual = cost[month_cols].values
    mask = pd.notna(implied) & (actual != 0)
    rel = abs(implied[mask] - actual[mask]) / abs(actual[mask])
    print(f"Reconciliation: median relative gap {pd.Series(rel).median():.6f}, "
          f"max {rel.max():.4f} (cells checked: {mask.sum()})")

    agencies = []
    for i, name in enumerate(avg["agency"]):
        monthly = avg.loc[i, month_cols].astype(float)
        people = part.loc[i, month_cols].astype(float)
        per_month = float(avg.loc[i, "Cumulative Average"])
        first, last = people.iloc[0], people.iloc[-1]
        agencies.append({
            "name": name,
            "type": agency_type(name),
            "avgParticipants": num(part.loc[i, "Average Participation"], 1),
            "annualCost": num(cost.loc[i, "Cumulative Cost"], 0),
            "perMonth": num(per_month),
            "perDay": num(per_month / DAYS_PER_MONTH),
            "monthly": [num(v, 2) for v in monthly],
            "participants": [None if math.isnan(v) else int(v) for v in people],
            "swingPct": num(monthly.std() / monthly.mean() * 100, 1),
            "participantChangePct": num((last / first - 1) * 100, 2) if first else None,
            "hasNegativeMonth": bool((monthly < 0).any()),
        })

    total_people = part[month_cols].sum()
    total_cost = cost[month_cols].sum()
    national = {
        "perMonth": num(total_cost.sum() / total_people.sum()),
        "perDay": num(total_cost.sum() / total_people.sum() / DAYS_PER_MONTH),
        "totalAnnualCost": num(total_cost.sum(), 0),
        "avgParticipants": num(part["Average Participation"].sum(), 1),
        "monthly": [num(c / p, 2) for c, p in zip(total_cost, total_people)],
        "participants": [int(v) for v in total_people],
    }

    out = {
        "meta": {
            "periodLabel": f"{labels[0]} to {labels[-1]}",
            "months": labels,
            "daysPerMonth": DAYS_PER_MONTH,
            "agencyCount": len(agencies),
            "droppedRows": ["empty duplicate row", *sorted(SUBTOTAL_ROWS)],
            "source": "Average_Food_Cost_Per_Person.csv, Food_Costs.csv, Total_Number_of_Participants.csv",
        },
        "national": national,
        "agencies": agencies,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(agencies)} agencies, "
          f"national ${national['perMonth']:.2f}/month = ${national['perDay']:.2f}/day")


if __name__ == "__main__":
    main()