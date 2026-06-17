import subprocess, json, time, re

BASE = 'http://127.0.0.1:3000'

def api(method, path, data=None):
    url = f'{BASE}{path}'
    args = ['curl', '-s']
    if method != 'GET': args += ['-X', method]
    args += [url, '-H', 'Content-Type: application/json']
    if data: args += ['-d', json.dumps(data, ensure_ascii=False)]
    r = subprocess.run(args, capture_output=True, text=True)
    return json.loads(r.stdout)

def api_stream(path, data):
    url = f'{BASE}{path}'
    r = subprocess.run(['curl', '-s', '-N', '-X', 'POST', url, '-H', 'Content-Type: application/json',
                       '-d', json.dumps(data, ensure_ascii=False), '--max-time', '40'],
                      capture_output=True, text=True)
    lines = [l.strip() for l in r.stdout.strip().split('\n') if l.strip()]
    if not lines: return None, ''
    deltas = []; final = None
    for line in lines:
        try:
            ev = json.loads(line)
            if ev.get('type') == 'delta': deltas.append(ev['delta'])
            elif ev.get('type') == 'final': final = ev
        except: pass
    return final, ''.join(deltas)

scenarios = [
    {'name': 'S9_强情绪', 'rounds': [
        '我真的快被他气死了，我为他花了这么多钱补课，他一点都不争气。',
        '补课老师说他上课也在玩手机，我一个月花两千多。',
        '我跟他说我们为你做了这么多，你能不能争气一点。',
        '他就不说话，或者回房间关门。',
        '我承认我说话比较重，但我真的没办法了。'
    ]},
    {'name': 'S10_考试焦虑', 'rounds': [
        '孩子考试前特别紧张，但是从来不让我帮他复习。',
        '他说他自己可以，但不让我检查。',
        '我检查他背诵，他就开始烦，背两句就说都会了。',
        '他每次都说懂了，但考试就错很多。',
        '他说最烦我一题一题查他，感觉像审犯人。'
    ]}
]

card_triggers = 0
total_issues = 0

for scenario in scenarios:
    print(f'\n{"="*60}')
    print(f'SCENARIO: {scenario["name"]}')
    c = api('POST', '/api/conversations/start', {'familyId':'f_demo','childId':'c_demo'})
    cid = c['data']['conversationId']
    for ri, pt in enumerate(scenario['rounds']):
        final, text = api_stream('/api/problem/answer/stream',
            {'conversationId': cid, 'round': ri+1, 'inputMode': 'text', 'text': pt})
        if final is None:
            print(f'  R{ri+1}: NO RESPONSE')
            total_issues += 1
            continue
        na = final.get('data',{}).get('nextAction','?') if final.get('data') else '?'
        has_card = '<!--CARD_JSON-->' in text
        if has_card: card_triggers += 1

        psych_pats = [r'是不是压力大', r'是不是逃避', r'是不是怕失败', r'是不是没有内驱力', r'是不是心理有问题']
        bad_psych = any(re.search(p, text) for p in psych_pats)
        multi_q = (text.count('?') + text.count('?') if '?' in text else 0) > 2
        mdown = '**' in text
        issues = sum([bad_psych, multi_q, mdown])
        total_issues += issues

        status = 'OK' if issues == 0 else 'ERR'
        cm = ' [CARD]' if has_card else ''
        print(f'  R{ri+1} {status}{cm} | na={na} | {len(text)}c')
        if issues:
            tags = []
            if bad_psych: tags.append('PSYCH_Q')
            if multi_q: tags.append('MULTI_Q')
            if mdown: tags.append('MDOWN')
            print(f'       ISSUES: {",".join(tags)}')
        print(f'       {text[:120]}...')
        if has_card:
            idx = text.index('<!--CARD_JSON-->')
            card_part = text[idx+17:idx+300]
            print(f'       CARD: {card_part}')
        time.sleep(0.3)

print(f'\n{"="*60}')
print(f'Remaining 2 scenarios: issues={total_issues}, cards={card_triggers}')
