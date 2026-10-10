#!/usr/bin/env python3
# Task 92: localize Google Fonts (cyrillic+latin subsets only) -> fonts/ + local css
import re, os, urllib.request

CSS = open('/tmp/gf.css').read()
OUT = '/home/z/cartest/task92-tutorial'
FDIR = os.path.join(OUT, 'fonts')
os.makedirs(FDIR, exist_ok=True)

# split into (comment, block) pairs
blocks = re.findall(r'/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]+\})', CSS)
keep_subsets = {'cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'}
out_css, seen = [], set()
for subset, block in blocks:
    if subset not in keep_subsets:
        continue
    m = re.search(r'url\((https://[^)]+)\)', block)
    if not m:
        continue
    url = m.group(1)
    fname = url.split('/s/')[1].replace('/', '_')
    local = f'fonts/{fname}'
    path = os.path.join(FDIR, fname)
    if url not in seen:
        seen.add(url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        open(path, 'wb').write(urllib.request.urlopen(req, timeout=30).read())
    out_css.append(block.replace(url, local))

open(os.path.join(OUT, 'fonts/gf-local.css'), 'w').write('\n'.join(out_css))
print(f'downloaded {len(seen)} files, kept {len(out_css)} font-face blocks')
