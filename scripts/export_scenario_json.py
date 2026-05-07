from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd


SOURCE_WORKBOOK = Path("/Users/Mo/Downloads/BlueForce_Scenario_Analysis_Latest/all_scenarios_export_final.xlsx")
OUTPUTS = [
    Path("public/assets/scenario-data.json"),
    Path("assets/scenario-data.json"),
]


def clean_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if hasattr(value, "item"):
        return clean_value(value.item())
    return value


def main() -> None:
    workbook = pd.ExcelFile(SOURCE_WORKBOOK)
    data = {}
    for sheet in workbook.sheet_names:
        frame = pd.read_excel(SOURCE_WORKBOOK, sheet_name=sheet)
        data[sheet] = [
            {str(key): clean_value(value) for key, value in row.items()}
            for row in frame.to_dict(orient="records")
        ]

    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {output}")


if __name__ == "__main__":
    main()
