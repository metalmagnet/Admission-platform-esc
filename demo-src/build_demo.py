import base64
F='/home/claude/visa-platform/node_modules/@fontsource'
def face(w):
    b=base64.b64encode(open(f'{F}/inter/files/inter-latin-{w}-normal.woff2','rb').read()).decode()
    return f"@font-face{{font-family:'Inter';font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2')}}"
fonts=''.join(face(w) for w in (400,500,600,700,800))
css=open('/home/claude/visa-platform/src/app/globals.css').read()
extra="""
a[data-act]{cursor:pointer}
.guide{background:var(--app-ink);color:#fff;padding:14px 0 12px}
.guide ol{list-style:none;margin:0 auto;padding:0 clamp(16px,4vw,32px);max-width:var(--app-content-max);display:flex;gap:6px 18px;flex-wrap:wrap}
.guide li{display:flex;align-items:center;gap:8px;font-size:13px;color:#a3a3a3}
.guide li span{width:22px;height:22px;border-radius:50%;border:1.5px solid #525252;display:inline-grid;place-items:center;font-size:11px;font-weight:700}
.guide li.done{color:#f5f5f5}.guide li.done span{background:var(--app-accent);border-color:var(--app-accent);color:var(--app-ink)}
.guide li.now{color:#fff;font-weight:700}.guide li.now span{border-color:var(--app-accent);color:var(--app-accent)}
.guide p{max-width:var(--app-content-max);margin:8px auto 0;padding:0 clamp(16px,4vw,32px);font-size:14px;color:var(--app-accent)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--app-ink);color:#fff;padding:12px 18px;border-radius:10px;font-weight:500;z-index:50;max-width:90vw;box-shadow:0 12px 40px -12px rgba(0,0,0,.5)}
.modal{position:fixed;inset:0;background:rgba(26,26,26,.55);display:grid;place-items:center;z-index:40;padding:16px}
.sheet{background:#fff;border-radius:12px;padding:20px;width:min(560px,100%);display:grid;gap:12px}
.sheet .page{border:1px solid var(--app-hairline);border-radius:8px;padding:24px;display:grid;gap:10px;background:var(--app-mist);min-height:260px;align-content:start}
.sheet .page i{display:block;height:10px;border-radius:5px;background:var(--app-hairline)}
.demo-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--app-ink);color:#fff;padding:10px clamp(16px,4vw,32px);font-size:14px}
.btn[disabled]{opacity:.45}
.switch{display:flex;gap:8px;flex-wrap:wrap;padding:12px clamp(16px,4vw,32px);border-bottom:1px solid var(--app-hairline-soft);background:var(--app-mist)}
.switch button{font:500 14px var(--app-font-body);padding:9px 16px;border:1px solid var(--app-hairline);background:var(--app-surface);border-radius:10px;cursor:pointer;color:var(--app-ink)}
.switch button[aria-pressed=true]{border-color:var(--app-accent);box-shadow:inset 0 -2px 0 var(--app-accent);font-weight:600}
"""
js=open('/home/claude/demo/engine.js').read()+'\n'+open('/home/claude/demo/demo.js').read()
html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admissions and visas, demo</title><style>{fonts}{css}{extra}</style></head><body><div id="app"></div><script>{js}</script></body></html>'''
open('/home/claude/demo/demo.html','w').write(html)
print(len(html)//1024,'KB')
