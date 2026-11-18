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
        with self.assertRaises(ValueError):
            process({"schema_version":1,"tasks":[{"id":"paid","approved":True,"type":"engineering","max_usd":1}]})
    def test_no_task(self):
        self.assertEqual(process({"schema_version":1,"tasks":[]})["status"],"no_eligible_task")
    def test_bad_schema(self):
        with self.assertRaises(ValueError):
            process({"schema_version":2,"tasks":[]})

if __name__=="__main__":
    unittest.main()
