import sys,json,pathlib
p=pathlib.Path(__file__).parent
sys.path.insert(0,str(pathlib.Path(sys.argv[1])/'src'))
from agenda_intelligence import review_rag_answer
c=json.loads((p/'validation.json').read_text());a=[]
for x in c:
 r=review_rag_answer(x['answer'],x['sources']);a.append(dict(id=x['id'],expected=x['expected'],flagged=r['route']=='revise',result=r))
(p/(sys.argv[2]+'.json')).write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
for label in ['supported','unsupported']:
 b=[x for x in a if x['expected']==label]; print(sys.argv[2],label,len(b),'flagged',sum(x['flagged'] for x in b))
