#!/usr/bin/env python3
"""Fail-closed, offline queue dry-run. No network, credentials, code writes or API use."""
import argparse
import datetime
import json
from pathlib import Path

ALLOWED_TYPES = {"dry_run"}
def process(data):
    if data.get("schema_version") != 1 or not isinstance(data.get("tasks"), list):
        raise ValueError("Unsupported queue schema")
    approved = []
    for task in data["tasks"]:
        if not isinstance(task, dict):
            raise ValueError("Malformed task")
        if task.get("approved") is not True:
            continue
        if task.get("type") not in ALLOWED_TYPES or task.get("max_usd") != 0:
            raise ValueError("Approved task is not permitted in offline pilot")
        if not isinstance(task.get("id"), str) or not task["id"]:
            raise ValueError("Missing task ID")
        approved.append(task)
    if not approved:
        return {"status":"no_eligible_task","task_id":None,"api_calls":0,"api_cost_usd":0}
    selected = sorted(approved, key=lambda t:(t.get("priority",999),t["id"]))[0]
    return {"status":"dry_run_completed","task_id":selected["id"],"api_calls":0,
            "api_cost_usd":0,"tests":"see workflow test step",
            "output":"Validated queue selection; no engineering work executed"}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--queue",required=True)
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    data=json.loads(Path(args.queue).read_text(encoding="utf-8"))
    result=process(data)
    result["timestamp_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    Path(args.report).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result))

if __name__=="__main__":
    main()
