import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from runner import process

class RunnerTests(unittest.TestCase):
    def test_selects_approved_priority(self):
        data={"schema_version":1,"tasks":[
            {"id":"later","approved":True,"type":"dry_run","max_usd":0,"priority":2},
            {"id":"first","approved":True,"type":"dry_run","max_usd":0,"priority":1},
            {"id":"unapproved","approved":False,"type":"engineering","max_usd":9,"priority":0}]}
        self.assertEqual(process(data)["task_id"],"first")
    def test_rejects_approved_paid_task(self):
        valid = {"id": "sample", "approved": True, "type": "dry_run", "max_usd": 0}
        for invalid in (
            {"max_usd": 1},
            {"max_usd": False},
            {"type": "engineering"},
            {"type": []},
            {"priority": "1"},
            {"id": " "},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                process({"schema_version": 1, "tasks": [{**valid, **invalid}]})
    def test_no_task(self):
        self.assertEqual(process({"schema_version":1,"tasks":[]})["status"],"no_eligible_task")
    def test_bad_schema(self):
        for data in ([], {"schema_version": 2, "tasks": []}, {"schema_version": True, "tasks": []}):
            with self.subTest(data=data), self.assertRaises(ValueError):
                process(data)

if __name__=="__main__":
    unittest.main()
