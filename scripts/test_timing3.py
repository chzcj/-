import subprocess, json, time

BASE = 'http://127.0.0.1:3000'

c = subprocess.run(['curl', '-s', '-X', 'POST', BASE+'/api/conversations/start',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'familyId':'f_demo','childId':'c_demo'}, ensure_ascii=False)],
    capture_output=True, text=True)
cid = json.loads(c.stdout)['data']['conversationId']

msgs = [
    '孩子写数学作业前一直玩手机，一催就烦',
    '不是写到一半卡住，是还没开始就一直玩',
    '催他就不耐烦说知道了知道了别催了',
    '数学明显比语文拖得久',
    '他数学成绩还行，换了老师以后开始的',
]

for i, msg in enumerate(msgs):
    rn = i + 1
    payload = json.dumps(
        {'conversationId': cid, 'round': rn, 'inputMode': 'text', 'text': msg},
        ensure_ascii=False)
    t0 = time.time()
    r = subprocess.run(
        ['curl', '-s', '-w', '\nHTTP_TOTAL=%{time_total}s\n', '-N', '-X', 'POST',
         BASE+'/api/problem/answer/stream',
         '-H', 'Content-Type: application/json', '-d', payload, '--max-time', '60'],
        capture_output=True, text=True)
    out = r.stdout
    http_time = 0
    for line in out.split('\n'):
        if 'HTTP_TOTAL=' in line:
            http_time = float(line.split('=')[1].replace('s',''))
    out_clean = '\n'.join([l for l in out.split('\n') if 'HTTP_TOTAL=' not in l])
    lines = [l.strip() for l in out_clean.split('\n') if l.strip()]
    deltas = []
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get('type') == 'delta':
                deltas.append(ev['delta'])
        except:
            pass
    text = ''.join(deltas)
    print('R{}: HTTP={:.1f}s text={}c'.format(rn, http_time, len(text)))

# Also check the DB write speed
print('\n--- DB write check ---')
t0 = time.time()
state_r = subprocess.run(['curl', '-s', BASE+'/api/conversations/'+cid+'/state'],
    capture_output=True, text=True)
print('state read: {:.3f}s'.format(time.time()-t0))
