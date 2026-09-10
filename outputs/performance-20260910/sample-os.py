from pathlib import Path
import subprocess,time,json
rows=[]
for _ in range(12):
    lines=subprocess.check_output(['ps','-Ao','pid,ppid,pcpu,rss,time,comm'],text=True).splitlines()[1:]
    procs=[]
    for line in lines:
        parts=line.strip().split(None,5)
        if len(parts)==6 and any(s in parts[5] for s in ['Google Chrome','Codex (Renderer)','Codex (Service)','WindowServer','UURemoteServer']):
            procs.append(dict(zip(['pid','parent','cpuPercent','rssKB','cpuTime','process'],parts)))
        elif len(parts)==6 and parts[0]=='188':procs.append(dict(zip(['pid','parent','cpuPercent','rssKB','cpuTime','process'],parts)))
    rows.append({'at':time.time(),'processes':procs});time.sleep(1)
Path('outputs/performance-20260910/os-foreground.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('12 foreground process samples saved')
