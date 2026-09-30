"""Reproducible standard-library build. No network or installed npm packages required."""
from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'dist'
def build():
 manifest=json.loads((ROOT/'modules.json').read_text('utf-8'))
 chunks=[str(i)+':function(module,exports,__r){\n'+(ROOT/p).read_text('utf-8')+'\n}'for i,p in manifest.items()]
 bundle="/* Kilian Zhou — Continuum. React runtime retains MIT notices. */\n(function(){'use strict';const process={env:{NODE_ENV:'production'}},cache={};const modules={\n"+',\n'.join(chunks)+"\n};function __r(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports,__r);return module.exports;}__r(0);})();"
 css='\n'.join((ROOT/'src'/p).read_text('utf-8')for p in ['legacy.css','dual-space.css','continuum.css'])
 output=OUTPUT
 if output.exists():
  if output.resolve()!=ROOT.joinpath('dist').resolve():raise ValueError('Unexpected build output')
  shutil.rmtree(output)
 output.mkdir()
 with (output/'index.html').open('w',encoding='utf-8',newline='\n') as f:f.write((ROOT/'index.template.html').read_text('utf-8'))
 with (output/'app.js').open('w',encoding='utf-8',newline='\n') as f:f.write(bundle)
 with (output/'styles.css').open('w',encoding='utf-8',newline='\n') as f:f.write(css)
 shutil.copytree(ROOT/'public',output,dirs_exist_ok=True)
 print(f'Built {output}: {len(bundle.encode())/1e6:.2f} MB JavaScript; {len(css.encode())/1e6:.2f} MB CSS')
if __name__=='__main__':build()
