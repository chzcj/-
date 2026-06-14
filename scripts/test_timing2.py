import subprocess, json, time

BASE = 'http://127.0.0.1:3000'

c = subprocess.run(['curl', '-s', '-X', 'POST', BASE+'/api/conversations/start',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'familyId':'f_demo','childId':'c_demo'})],
    capture_output=True, text=True)
cid = json.loads(c.stdout)['data']['conversationId']
print('conv=' + cid)

for i in range(1, 8):
    msg = 'round{} test message here'.format(i)
    payload = json.dumps({'conversationId': cid, 'round': i, 'inputMode': 'text', 'text': msg})
    t0 = time.time()
    r = subprocess.run(
        ['curl', '-s', '-w', '\nMETRICS=%{time_total}s/%{time_starttransfer}s/%{size_download}b/%{size_upload}b\n',
         '-N', '-X', 'POST', BASE+'/api/problem/answer/stream',
         '-H', 'Content-Type: application/json', '-d', payload, '--max-time', '60'],
        capture_output=True, text=True)
    total_t = time.time() - t0
    out = r.stdout
    metrics = {}
    for line in out.split('\n'):
        if line.startswith('METRICS='):
            parts = line.replace('METRICS=', '').split('/')
            try:
                metrics = {
                    'total': float(parts[0].replace('s','')),
                    'ttfb': float(parts[1].replace('s','')),
                    'dl': int(parts[2].replace('b','')),
                    'ul': int(parts[3].replace('b',''))
                }
            except:
                pass
    out_clean = '\n'.join([l for l in out.split('\n') if not l.startswith('METRICS=')])
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
    total_s = metrics.get('total', 0)
    ttfb_s = metrics.get('ttfb', 0)
    up = metrics.get('ul', 0)
    down = metrics.get('dl', 0)
    print('R{}: total={:.1f}s TTFB={:.1f}s text={}c upload={}b download={}b'.format(
        i, total_s, ttfb_s, len(text), up, down))

# Now check the conversation state to see how big rounds list is
print('\n--- Check what data goes to DeepSeek ---')
state = subprocess.run(['curl', '-s', BASE+'/api/conversations/'+cid+'/state'],
    capture_output=True, text=True)
s = json.loads(state.stdout)
d = s.get('data', {})
rounds = d.get('rounds', [])
print('rounds count: ' + str(len(rounds)))
for rd in rounds:
    raw = rd.get('rawText', '')[:60]
    summary = rd.get('summary', '')[:60]
    print('  R{}: raw={} | summary={}'.format(rd.get('round'), raw, summary))

# CompactConversation to estimate token cost
compact = {
    'rounds': [{'round': r['round'], 'rawText': r['rawText'][:80], 'summary': r.get('summary','')[:80]} for r in rounds],
    'currentRound': d.get('currentRound'),
    'status': d.get('status')
}
compact_json = json.dumps(compact, ensure_ascii=False)
print('\ncompactConversation size: ' + str(len(compact_json)) + ' chars')
print('estimated tokens (user msg): ~' + str(int(len(compact_json)/2.5)) + ' tokens')

# Also check for waitMock or delays
import os
print('\n--- Check waitMock ---')
try:
    routes = subprocess.run(['grep', '-rn', 'waitMock', '/home/ubuntu/apps/yujian/src/lib/'], 
        capture_output=True, text=True)
    print(routes.stdout if routes.stdout else 'no waitMock found')
except:
    print('grep failed')
