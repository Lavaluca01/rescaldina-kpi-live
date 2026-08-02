#!/usr/bin/env python3
import argparse,json,os,re,shutil,tempfile,urllib.request,zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'; REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'; PKG='http://schemas.openxmlformats.org/package/2006/relationships'
def n(v):
 try:return float(v or 0)
 except:return 0.0
def letters(ref):return re.match(r'([A-Z]+)',ref).group(1)
def read_xlsx(path):
 z=zipfile.ZipFile(path); shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  shared=[''.join(t.text or '' for t in si.iter('{%s}t'%NS)) for si in root.findall('{%s}si'%NS)]
 wb=ET.fromstring(z.read('xl/workbook.xml')); rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 relmap={r.attrib['Id']:r.attrib['Target'] for r in rels.findall('{%s}Relationship'%PKG)}; paths={}
 for s in wb.find('{%s}sheets'%NS): paths[s.attrib['name']]='xl/'+relmap[s.attrib['{%s}id'%REL]].lstrip('/')
 def sheet(name):
  root=ET.fromstring(z.read(paths[name])); rows={}
  for rr in root.iter('{%s}row'%NS):
   row={}
   for c in rr.findall('{%s}c'%NS):
    typ=c.attrib.get('t'); v=c.find('{%s}v'%NS); val=''
    if typ=='s' and v is not None: val=shared[int(v.text)]
    elif typ=='inlineStr': val=''.join(t.text or '' for t in c.iter('{%s}t'%NS))
    elif v is not None: val=v.text
    row[letters(c.attrib['r'])]=val
   if row: rows[int(rr.attrib['r'])]=row
  return rows
 return sheet
def timestamp(rows):
 text=' '.join(str(v) for r in sorted(rows)[:10] for v in rows[r].values())
 m=re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})',text)
 if not m:return None
 d,mo,y,h,mi,s=m.groups(); return f'{y}-{int(mo):02d}-{int(d):02d}T{int(h):02d}:{mi}:{s}'
def download(url):
 fd,p=tempfile.mkstemp(suffix='.xlsx');os.close(fd)
 req=urllib.request.Request(url,headers={'User-Agent':'Rescaldina-KPI-Agent/3.0'})
 with urllib.request.urlopen(req,timeout=120) as r,open(p,'wb') as f:shutil.copyfileobj(r,f)
 return p
def build(budget_file,realtime_file,out):
 kg=read_xlsx(budget_file); monthly=kg('Kerb_Mensile'); budgets=[]
 for r in sorted(monthly):
  x=monthly[r]; day=int(n(x.get('B')))
  if not 1<=day<=31:continue
  sales=n(x.get('D')); prot=n(x.get('E')); mw=n(x.get('H'))
  budgets.append({'date':f'2026-08-{day:02d}','sales':sales,'protection':prot,'mwService':mw,'mcafeePieces':n(x.get('P')),'officePieces':n(x.get('Q')),'under300Pieces':n(x.get('G')),'protectionAreas':{'telefonia':sales*.08,'pc':sales*.06,'ge':sales*.10},'findomestic':sales*.15,'mwServiceAreas':{'screen':mw*.60,'rtu':mw*.20,'calibrazione':mw*.20}})
 rg=read_xlsx(realtime_file); pv=rg('Progressivo Valore'); actual={}
 for r,row in pv.items():
  if any('017-RESCALDINA' in str(v).upper() for v in row.values()):
   actual={'sales':n(row.get('D')),'protection':n(row.get('K')),'mwService':n(row.get('M')),'screenPieces':n(row.get('R')),'officePieces':n(row.get('S')),'mcafeePieces':n(row.get('T')),'calibrazionePieces':n(row.get('U')),'rtuPcPieces':n(row.get('O')),'rtuSmartphonePieces':n(row.get('P'))}
   break
 ts=timestamp(pv); key=(ts or datetime.now().isoformat())[:10]; now=datetime.now().astimezone().isoformat(timespec='seconds')
 old={}
 if os.path.exists(out):
  try:old=json.load(open(out,encoding='utf-8'))
  except:pass
 actuals=old.get('actuals',{})
 if actual and key.startswith('2026-08'):actuals[key]=actual
 month_sales=sum(x['sales'] for x in budgets)
 data={'store':'RESCALDINA','storeCode':'017','month':'2026-08','currency':'EUR','generatedAt':now,'sourceUpdatedAt':ts or 'non rilevato','budgets':budgets,'actuals':actuals,'lastAvailableSnapshot':actual,'goldPlus':{'monthlyTargetValue':month_sales*.014,'monthlyTargetPieces':month_sales*.014/39.90,'unitValue':39.90},'rules':{'protection':{'telefonia':.08,'pc':.06,'ge':.10},'mwService':{'screen':.60,'rtu':.20,'calibrazione':.20},'findomestic':.15,'goldPlus':.014}}
 os.makedirs(os.path.dirname(out) or '.',exist_ok=True);json.dump(data,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--budget-file');p.add_argument('--realtime-file');p.add_argument('--budget-url');p.add_argument('--realtime-url');p.add_argument('--out',default='data/kpi.json');a=p.parse_args()
 bf=download(a.budget_url) if a.budget_url else a.budget_file;rf=download(a.realtime_url) if a.realtime_url else a.realtime_file
 if not bf or not rf:raise SystemExit('Servono budget e realtime: file o URL')
 build(bf,rf,a.out)
