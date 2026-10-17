import runpy
reconcile = runpy.run_path('desktop/resources/delivery/translation-coverage.py')['reconcile_translation_coverage']
rows = []
def add(owner, kind, field, original, element, guid='', graph=''):
    rows.append(dict(owner=owner,kind=kind,field=field,original=original,elementName=element,nodeGuid=guid,graphName=graph))
    return True

def item(kind,field,text,element,**extra):
    return dict(owner='/Game/WBP_Test',status='translatable',location=element,kind=kind,text=text,translationEntry=dict(kind=kind,field=field,original=text,elementName=element,**extra))
items=[item('UMG动画','Name','关闭','关闭',animationName='关闭',valueType='object'),item('变量','Category','VR模板传送','Teleport'),item('蓝图注释','CommentText','这是注释','',nodeGuid='comment-guid',graphName='EventGraph'),dict(owner='/Game/WBP_Test',status='preserved',kind='功能名称值',text='骨骼映射',location='Map'),dict(owner='/Game/WBP_Test',status='review',kind='字符串值',text='不明确用途',location='CDO/Unknown')]
result=reconcile(rows,dict(entries=items),add)
assert result==dict(version=2,added=3,interfaceEvents=0,missing=[]),result
assert rows[0]['animationName']=='关闭'
assert not any(r['original']=='骨骼映射' for r in rows)
assert reconcile(rows,dict(entries=items),add)['added']==0
# Same text in an unrelated field cannot disguise a missing write target.
unknown=dict(owner='/Game/WBP_Test',status='translatable',kind='未知位置',text='关闭',location='Unimplemented')
assert reconcile(rows,dict(entries=[unknown]),add)['missing']==[dict(owner='/Game/WBP_Test',location='Unimplemented',kind='未知位置',text='关闭')]
# Two different graph-local identities must not collapse.
other=item('蓝图注释','CommentText','这是注释','',nodeGuid='other-guid',graphName='EventGraph')
assert reconcile(rows,dict(entries=[other]),add)['added']==1
for file in ['scan-blueprints.py','verify-chinese-residue.py','translation-coverage.py']:
    source=open('desktop/resources/delivery/'+file,encoding='utf-8').read()
    compile(source,file,'exec')
print('Audit omissions restore actionable animation/category/comment targets; repeat is stable; protected/unknown fields never fabricated; Python syntax passed.')

