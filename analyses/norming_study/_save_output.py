"""post-render: copies explore.html to results/norming_study/{PILOT}/"""
import re, shutil, os

with open('explore.qmd') as f:
    m = re.search(r"^PILOT\s*=\s*'([^']+)'", f.read(), re.MULTILINE)

if not m:
    print('[save_output] could not find PILOT in explore.qmd')
    raise SystemExit(1)

pilot = m.group(1)
dest_dir = f'../../results/norming_study/{pilot}'
os.makedirs(dest_dir, exist_ok=True)

# quarto sets QUARTO_PROJECT_OUTPUT_FILES to newline-separated output paths
src = None
for line in os.environ.get('QUARTO_PROJECT_OUTPUT_FILES', '').splitlines():
    if line.endswith('explore.html'):
        src = line.strip()
        break
if src is None:
    src = 'explore.html'  # fallback: rendered in-place next to .qmd

if os.path.exists(src):
    dest = os.path.join(dest_dir, 'explore.html')
    shutil.copy2(src, dest)
    print(f'[save_output] → results/norming_study/{pilot}/explore.html')
else:
    print(f'[save_output] explore.html not found at {src!r}')
