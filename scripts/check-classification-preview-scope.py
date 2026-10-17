import json, os, pathlib, runpy, sys, time, types, uuid

root=pathlib.Path('.local/checks/preview-scope-'+str(time.time_ns())).resolve()
source=root/'P'
source.mkdir(parents=True)
descriptor=source/'P.uproject'
descriptor.write_text('original descriptor',encoding='utf-8')
script=pathlib.Path('desktop/resources/delivery/fab-classify.py').resolve()
task_id=str(uuid.uuid4())
task=source/'.ue-translation-cache'/'classification'/task_id
preview=task/'PreviewProject'
preview.mkdir(parents=True)
preview_descriptor=preview/'P.uproject'
preview_descriptor.write_text('{}',encoding='utf-8')
(source/'.ue-translation-cache'/'owner.json').write_text(json.dumps({'kind':'ue-project-translation-cache','sourceDescriptor':str(descriptor)}),encoding='utf-8')
owner={'kind':'fab-classification-cache-task','id':task_id,'descriptorPath':str(descriptor)}
checks=[]
for name,mode,actual,owner_data,expected in [
    ('selected-project','scan',descriptor,owner,'escaped classification scope'),
    ('wrong-owner','scan',preview_descriptor,{**owner,'descriptorPath':str(root/'Other.uproject')},'ownership mismatch'),
    ('wrong-task','scan',preview_descriptor,{**owner,'id':str(uuid.uuid4())},'ownership mismatch'),
    ('normalize-apply','apply',preview_descriptor,owner,'requires preview scan')
]:
    (task/'owner.json').write_text(json.dumps(owner_data),encoding='utf-8')
    output=root/(name+'-result.json')
    request={'mode':mode,'descriptorPath':str(actual),'protectedRoots':[str(source)],'normalizeForClassification':True,'classificationPreview':{'taskId':task_id,'sourceDescriptor':str(descriptor)},'output':str(output)}
    request_file=root/(name+'-request.json')
    request_file.write_text(json.dumps(request),encoding='utf-8')
    reached=[]
    def deny_registry():
        reached.append(True)
        raise AssertionError('Unsafe normalization reached asset loading')
    sys.modules['unreal']=types.SimpleNamespace(Paths=types.SimpleNamespace(convert_relative_path_to_full=lambda p:p,get_project_file_path=lambda:str(actual)),AssetRegistryHelpers=types.SimpleNamespace(get_asset_registry=deny_registry))
    os.environ['UE_FAB_REQUEST']=str(request_file)
    runpy.run_path(str(script))
    result=json.loads(output.read_text(encoding='utf-8'))
    assert result['success'] is False and expected in result['error'],result
    assert not reached
    assert descriptor.read_text(encoding='utf-8')=='original descriptor'
    checks.append(name)
(root/'report.json').write_text(json.dumps({'root':str(root),'mockedUnreal':True,'checks':checks},indent=2),encoding='utf-8')
print(json.dumps({'root':str(root),'checks':checks}))
