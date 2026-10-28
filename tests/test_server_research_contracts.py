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


def test_research_quality_retains_supported_pairs_and_withholds_wrong_units_without_npm():
    node = shutil.which("node")
    if not node:
        pytest.skip("Worker quality contracts need Node.js")
    root = Path(__file__).resolve().parents[1]
    program = """
      import {assessResearchQuality} from './deploy/cloudflare-worker/src/research-quality.js';
      const quote='Total cargo in 2022: 3,818 thousand tonnes; in 2023: 4,483 thousand tonnes.';
      const input={question:'Сравни тонны за 2022 и 2023 годы',language:'ru'};
      const analysis={findings:[{claim:'Непроверенный черновик модели.',source_id:'S1',quote}],
        interpretations:[],open_questions:[]};
      const payload={sources:[{id:'S1'}]};
      const run=unit=>assessResearchQuality({input,analysis,payload,proposal:{
        findings:{S1:{measurements:[
          {value_raw:'3,818',unit,period:'2022',scope:'Total cargo',kind:'observed'},
          {value_raw:'4,483',unit,period:'2023',scope:'Total cargo',kind:'observed'}
        ]}},coverage:{Q1:{status:'answered',source_ids:['S1'],
          explanation:'Источник содержит оба года и сопоставимые единицы.'}}
      }});
      console.log(JSON.stringify({golden:run('thousand tonnes'),bad:run('TEU')}));
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
    validator = Draft202012Validator(schema["$defs"]["quality"])
    for case in result.values():
        validator.validate(case["quality"])
    assert result["golden"]["quality"]["status"] == "checks_passed"
    assert result["golden"]["quality"]["calculations"][0]["value_percent"] == 17.4
    assert result["bad"]["quality"]["status"] == "blocked"
    assert result["bad"]["analysis"]["findings"] == []
    assert result["bad"]["quality"]["coverage"][0]["status"] == "unresolved"
