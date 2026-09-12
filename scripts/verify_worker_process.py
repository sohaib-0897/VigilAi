"""Exercise API start/stop commands against a separate real worker process."""
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from vigilai_api.main import app
from apps.worker.db import SessionLocal
from vigilai_api.db.models import User

root = Path('.verification').resolve()
env = dict(os.environ, YOLO_MODEL_PATH=str(root/'yolov8n.pt'))
log = (root/'worker-process.log').open('w')
process = subprocess.Popen([sys.executable, '-m', 'apps.worker.main'], env=env, stdout=log, stderr=log)
uid = None
try:
    with TestClient(app) as client:
        name = 'worker' + uuid.uuid4().hex[:10]
        response = client.post('/api/v1/auth/register', json={'email':name+'@example.com','username':name,'password':'Worker-test-password'})
        assert response.status_code == 200, response.text
        uid = response.json()['id']
        assert client.post('/api/v1/auth/login', json={'email':name+'@example.com','password':'Worker-test-password'}).status_code == 200
        camera = client.post('/api/v1/cameras', json={'name':name,'source_type':'local_video','source_uri':''}).json()
        cid = camera['id']
        with (root/'real-scene.avi').open('rb') as source:
            assert client.post(f'/api/v1/cameras/{cid}/upload', files={'file':('video.avi',source)}).status_code == 200
        # Start intent is durable even before the worker has subscribed.
        assert client.post(f'/api/v1/cameras/{cid}/start').status_code == 200
        online = False
        deadline = time.monotonic()+45
        while time.monotonic()<deadline:
            assert process.poll() is None, 'Worker crashed; see worker-process.log'
            state = client.get(f'/api/v1/cameras/{cid}').json()
            if state['status'] == 'online':
                online = True
            if online and state['status']=='stopped':
                assert not state['analytics_enabled']
                break
            time.sleep(.25)
        assert online, 'No real online transition'
        assert state['status']=='stopped', state
        assert client.post(f'/api/v1/cameras/{cid}/start').status_code == 200
        time.sleep(1)
        assert client.post(f'/api/v1/cameras/{cid}/stop').status_code == 200
        result={'separate_worker_process':'PASS','durable_start':'PASS','EOF':'PASS','stop_command':'PASS'}
        (root/'worker-results.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result))
finally:
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
    log.close()
    if uid:
        with SessionLocal() as session:
            user=session.get(User,uuid.UUID(uid))
            session.delete(user)
            session.commit()
