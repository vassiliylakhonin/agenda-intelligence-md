"""Exercise the separate hosted research admission contract with real SQLite."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator


def test_server_research_admits_valid_request_and_rejects_invalid_input_without_dispatch():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker protocol tests need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import {DatabaseSync} from 'node:sqlite';
      import {readFileSync} from 'node:fs';
      import {handleResearch} from './deploy/cloudflare-worker/src/research-http.js';
      const db=new DatabaseSync(':memory:');
      db.exec(readFileSync('deploy/cloudflare-worker/research-migrations/0001_research.sql','utf8'));
      let dispatched=0;
      const env={RESEARCH_ENABLED:'1',RESEARCH_AI:{run(){throw new Error('Admission must not infer');}},
        RESEARCH_WORKFLOW:{async create(){dispatched++;}},
        RESEARCH_DB:{prepare(sql){return {bind(...args){return {
          async first(){return db.prepare(sql).get(...args)??null;},
          async run(){return db.prepare(sql).run(...args);}
        };}};}}};
      const call=body=>handleResearch(new Request('https://example.test/v1/research',{
        method:'POST',headers:{'content-type':'application/json',
          authorization:'Bearer private-contract-caller-12345678901234'},body:JSON.stringify(body)}),env);
      const valid=await call({question:'What changed in Middle Corridor transport?',request_id:'contract-run-1'});
      const invalid=await call({question:'What changed?',language:'unsupported',request_id:'contract-run-2'});
      console.log(JSON.stringify({status:valid.status,payload:await valid.json(),
        invalid_status:invalid.status,invalid:await invalid.json(),dispatched}));db.close();
    """
    run = subprocess.run(
        [node, "--input-type=module", "-e", program],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    result = json.loads(run.stdout)
    schema = json.loads((root / "schemas/v1/corridor-research-response.schema.json").read_text())
    Draft202012Validator(schema).validate(result["payload"])
    assert result["status"] == 202
    assert result["payload"]["status"] == "queued"
    assert result["payload"]["human_review_required"] is True
    assert result["invalid_status"] == 400
    assert result["invalid"]["code"] == "unsupported_language"
    assert result["dispatched"] == 1
