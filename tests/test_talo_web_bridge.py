import importlib.util
import uuid
from pathlib import Path
import pytest
from talo.application.service import create_app_context
from talo.changes.manager import for_context
spec = importlib.util.spec_from_file_location('web_bridge', Path(__file__).parents[1]/'cli/talo_web_bridge.py')
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

@pytest.fixture
def project(tmp_path, monkeypatch):
 monkeypatch.setenv('TALO_HOME',str(tmp_path/'home'))
 root=tmp_path/'project';root.mkdir()
 (root/'hello.txt').write_text('before\n')
 ctx=create_app_context(root)
 change=for_context(ctx).propose([{'path':'hello.txt','content':'after\n'}])
 pid=ctx.project_id;ctx.close()
 return root,pid,change

def call(pid,method,params=None,request_id=None):
 return bridge.handle({'project_id':pid,'method':method,'params':params or {},'id':request_id or str(uuid.uuid4())})

def test_snapshot_and_apply_replay_undo(project):
 root,pid,change=project
 snap=call(pid,'snapshot')
 assert snap['changes'][0]['id']==change['id']
 assert snap['project']['path']==str(root)
 assert call(pid,'diff',{'change_id':change['id']})['diff'].find('+after')>=0
 rid=str(uuid.uuid4());args={'change_id':change['id'],'patch_hash':change['patch_hash']}
 call(pid,'apply',args,rid);call(pid,'apply',args,rid)
 assert (root/'hello.txt').read_text()=='after\n'
 call(pid,'undo',{'change_id':change['id']})
 assert (root/'hello.txt').read_text()=='before\n'

def test_unknown_project_and_stale_base_rejected(project):
 root,pid,change=project
 with pytest.raises(ValueError):call('wrong-project','snapshot')
 (root/'hello.txt').write_text('user edit\n')
 with pytest.raises(Exception):call(pid,'apply',{'change_id':change['id'],'patch_hash':change['patch_hash']})
 assert (root/'hello.txt').read_text()=='user edit\n'

def test_decision_revisions_keep_history_and_reject_stale(project):
 _,pid,_=project
 result=call(pid,'decision',{'content':'첫 결정'})
 rid=str(uuid.uuid4());args={'memory_id':result['memory_id'],'version':1,'content':'새 결정'}
 second=call(pid,'decision',args,rid)
 assert call(pid,'decision',args,rid)==second
 memories=call(pid,'snapshot')['memories']
 assert len(memories)==2
 assert next(m for m in memories if m['id']==result['memory_id'])['status']=='superseded'
 assert result['memory_id'] in next(m for m in memories if m['id']==second['memory_id'])['source_refs']
 with pytest.raises(ValueError):call(pid,'decision',args)


def test_snapshot_with_registered_connection(project):
 root,_,_=project
 ctx=create_app_context(root)
 try:
  from talo.config import Config
  ctx.config=Config({'connections':{'test':{'connection_id':'test','provider_id':'fixture','model_id':'fixture-model'}}})
  connections=bridge.snapshot(ctx)['connections']
  assert connections==[{'id':'test','model':'fixture-model','provider':'fixture','status':'unverified'}]
  assert 'credential_ref' not in connections[0]
 finally:
  ctx.close()
