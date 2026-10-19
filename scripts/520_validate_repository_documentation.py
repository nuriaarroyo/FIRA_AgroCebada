"""Validate documentation, provenance and positional splits using stdlib only."""
from pathlib import Path
from collections import Counter
import argparse
import csv
import hashlib
import json
import re
import subprocess
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]
DOCS=['README.md','documentation/README.md','documentation/project_scope_and_guidelines.md',
      'documentation/model_registry.md','documentation/experiment_index.md','documentation/reproducibility.md',
      'documentation/repository_organization.md','documentation/ai_usage.md','documentation/ai/README.md',
      'documentation/git_data_policy.md','configs/README.md','environments/README.md',
      'documentation/current_champions_reproduction.md','results/README.md','results/current_champions/v1/README.md']
DOCS += ['documentation/model_status_history.md']
DOCS += [p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'documentation/models').rglob('README.md'))]
if (ROOT/'results/comparison_97_41/v1/README.md').exists():
    DOCS.append('results/comparison_97_41/v1/README.md')
if (ROOT/'results/core4_relevance/v1/README.md').exists():
    DOCS.append('results/core4_relevance/v1/README.md')
if (ROOT/'results/reference26_component_evidence/v1/README.md').exists():
    DOCS.append('results/reference26_component_evidence/v1/README.md')
if (ROOT/'results/reference26_distribution/v1/README.md').exists():
    DOCS.append('results/reference26_distribution/v1/README.md')
if (ROOT/'results/current_champions_final/v1/README.md').exists():
    DOCS.append('results/current_champions_final/v1/README.md')


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def sha_portable(p, expected):
    """Accept a historical source hash across checkout-only LF/CRLF changes.

    Preserve frozen-design content: only newline bytes may differ. This does
    not waive changed words, missing documentation, or label-bearing files.
    """
    data=p.read_bytes()
    normalized=data.replace(b'\r\n',b'\n')
    return expected in {hashlib.sha256(candidate).hexdigest() for candidate in (
        data, normalized, normalized.replace(b'\n',b'\r\n'))}


def read(relative):
    return json.loads((ROOT/relative).read_text(encoding='utf-8'))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--local-sources',action='store_true',help='Also compare optional original design JSON hashes; no data loading.')
    args=parser.parse_args()
    checks=Counter()
    inputs=read('configs/current_champions_inputs.json')['features']
    import runpy
    cards=runpy.run_path(str(ROOT/'scripts/524_document_current_models.py'))
    assert [c for c,_ in cards['SETS']['Reference26']]==inputs
    for name,size in [('CT3',4),('Reference26',26),('Compact14',14),('B1',26)]:
        names=[c for c,_ in cards['SETS'][name]]
        assert len(names)==len(set(names))==size
        assert set(names)<=set(inputs)
        text=(ROOT/f'documentation/models/{name}/README.md').read_text(encoding='utf-8')
        assert all('`'+c+'`' in text for c in names)
        checks['model_variable_inventories']+=1
    with (ROOT/'documentation/models/L40/variables_C4_2082.csv').open(encoding='utf-8',newline='') as stream:
        l40=list(csv.DictReader(stream))
    assert len(l40)==len({r['variable'] for r in l40})==2082
    assert Counter(r['layer'] for r in l40)==dict(base=1397,agronomic=350,empirical=335)
    checks['external_input_names']=len(l40)
    with (ROOT/'documentation/inventories/model_status_audit.csv').open(encoding='utf-8',newline='') as stream:
        for record in csv.DictReader(stream):
            assert sha_portable(ROOT/record['document'],record['sha256_after']),record['document']
            if record['treatment'].startswith('frozen_design_preserved'):
                assert record['sha256_before']==record['sha256_after']
            checks['model_status_documents']+=1
    for name in DOCS:
        p=ROOT/name
        assert p.is_file(),name
        text=p.read_text(encoding='utf-8')
        assert '\ufffd' not in text,name
        for raw in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)',text):
            if raw.startswith(('http:','https:','mailto:','#')):continue
            destination=unquote(raw.split('#',1)[0].strip('<>'))
            linked=(p.parent/destination).resolve()
            # Versioned reports legitimately link to private local output bundles.
            # Keep checking public relative links; never publish those bundles.
            if not linked.exists() and any(linked.is_relative_to(ROOT/folder)
                                           for folder in ('outputs','data','docs/resources')):
                checks['private_local_links_not_versioned']+=1
                continue
            assert linked.exists(),f'Broken link: {name} -> {raw}'
            checks['local_links']+=1
    manifest=read('configs/experiments/manifest.json')
    for record in manifest['snapshots']:
        p=ROOT/record['snapshot']
        assert sha(p)==record['snapshot_sha256'],str(p)
        assert record['source'].startswith('outputs/modeling/')
        json.loads(p.read_text(encoding='utf-8'))
        if args.local_sources:
            assert sha(ROOT/record['source'])==record['source_sha256'],record['source']
        checks['design_snapshots']+=1
    a=read('configs/validation/original65.json')
    b=read('configs/validation/original65_plus_fresh16.json')
    assert len(a['folds'])==65 and len(b['folds'])==81
    assert a['folds']==b['folds'][:65]
    assert a['ordered_ids_sha256']==b['ordered_ids_sha256']
    protocols=Counter(f['protocol'] for f in a['folds'])
    assert protocols==dict(random=50,climate_profile=5,municipality=5,spatial=5),protocols
    for item in [a,b]:
        for fold in item['folds']:
            assert set(fold)=={'execution_index','protocol','repeat','fold','train_positions','validation_positions','inner'}
            tr=fold['train_positions'];va=fold['validation_positions']
            assert not set(tr)&set(va)
            assert sorted(tr+va)==list(range(138))
            held=[]
            for inner in fold['inner']:
                x=inner['train_relative_positions'];y=inner['validation_relative_positions']
                assert not set(x)&set(y)
                assert sorted(x+y)==list(range(len(tr)))
                held.extend(y)
            assert sorted(held)==list(range(len(tr))),f'Inner folds fail OOF partition: {fold["execution_index"]}'
            checks['fold_records']+=1
        for (protocol,repeat),counts in _outer_coverage(item['folds']).items():
            if protocol!='fresh_97_41': assert counts==Counter(range(138)),(protocol,repeat)
    for fold in b['folds'][65:]:
        assert fold['protocol']=='fresh_97_41'
        assert len(fold['train_positions'])==97 and len(fold['validation_positions'])==41
    registry=read('configs/model_registry.json')['models']
    assert len(set(m['id'] for m in registry))==len(registry)
    model_ids={m['id'] for m in registry}
    for model in registry:
        assert set(model.get('components',[]))<=model_ids,model['id']
        for key in ['documentation','implementation']:
            if key in model:assert (ROOT/model[key]).exists(),model[key]
        checks['registered_models']+=1
    stage=read('configs/current_stage.json')
    assert stage['champions']==['Reference26','Compact14']
    assert stage['included_models']==['CT3','Reference26','Compact14','B1']
    assert 'L40' in stage['excluded_from_current_delivery']
    if stage.get('new_PRED59'):
        assert stage['final_prediction_models']==['Reference26','Compact14']
        final=read('results/current_champions_final/v1/prediction_audit.json')
        assert final['n_predictions']==59 and final['saved_model_replay_exact']
        assert final['old_columns_unchanged'] and final['historical_champion_unchanged']
        assert final['internal_ledger_verified'] and not final['unknown_error_metrics_computed']
        with (ROOT/'results/current_champions_final/v1/pairwise_disagreement.csv').open(encoding='utf-8',newline='') as stream:
            pairs=list(csv.DictReader(stream))
        assert len(pairs)==15 and all(int(row['n'])==59 for row in pairs)
        assert not any('ID_POLIGONO' in row for row in pairs)
        checks['final_prediction_pairs']=len(pairs)
    registered={m['id']:m for m in registry}
    assert {m['id'] for m in registry if m['status'].startswith('current_champion')}=={'Reference26','Compact14'}
    assert all(registered[m]['status'].startswith('current_champion') for m in stage['champions'])
    with (ROOT/'results/current_champions/v1/metrics.csv').open(encoding='utf-8',newline='') as stream:
        current=list(csv.DictReader(stream))
    assert {r['experiment'] for r in current}==set(stage['included_models'])
    assert len(current)==20
    replay=read('results/current_champions/v1/reproduction_audit.json')
    assert replay['status']=='passed' and replay['external_folds']==81 and replay['max_prediction_difference']<1e-10
    assert replay['restricted_file_io'] and replay['no_L40']
    checks['current_result_rows']=len(current)
    with (ROOT/'documentation/ai/prompt_inventory.csv').open(encoding='utf-8',newline='') as stream:
        rows=list(csv.DictReader(stream))
    assert len({row['prompt_id'] for row in rows})==len(rows)
    for row in rows:
        assert sha(ROOT/row['prompt_file'])==row['sha256'],row['prompt_id']
        assert (ROOT/row['related_document']).is_file(),row['related_document']
        checks['prompt_records']+=1
    with (ROOT/'documentation/inventories/repository_files.csv').open(encoding='utf-8',newline='') as stream:
        for row in csv.DictReader(stream):
            assert (ROOT/row['path']).is_file(),row['path']
            checks['inventory_files']+=1
    if (ROOT/'.git').exists():
        files=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split(chr(0))
        assert not any(p.startswith(('data/','outputs/','docs/resources/')) for p in files),'Private artifacts tracked'
        assert not any('__pycache__' in p or p.endswith('.pyc') for p in files),'Compiled caches still tracked'
        checks['git_policy']=1
    print(json.dumps(dict(status='passed',checks=dict(checks),local_source_hashes_checked=args.local_sources,
                          training_performed=False,private_data_loaded=False),ensure_ascii=False,indent=2))


def _outer_coverage(folds):
    coverage={}
    for f in folds:
        key=(f['protocol'],f['repeat'])
        coverage.setdefault(key,Counter()).update(f['validation_positions'])
    return coverage


if __name__=='__main__':main()
