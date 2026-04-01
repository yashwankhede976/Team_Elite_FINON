import urllib.request, json

req = urllib.request.Request(
    'https://openrouter.ai/api/v1/models',
    headers={'Authorization': 'Bearer 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'}
)
data = json.loads(urllib.request.urlopen(req).read())
free = sorted([m['id'] for m in data['data'] if ':free' in m['id']])
with open('free_models.txt', 'w') as f:
    f.write('\n'.join(free))
print(f'Found {len(free)} free models. See free_models.txt')
