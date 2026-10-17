export function readProjectLink(search) {
  const params = new URLSearchParams(search);
  return {
    projectId: params.get('project') || '',
    section: params.get('section') === 'development' ? 'development' : 'docs',
    record: params.get('record') || '',
  };
}

export function projectApiUrl(endpoint, projectId) {
  if (!projectId) throw new Error('尚未确定文档所属项目。');
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}project=${encodeURIComponent(projectId)}`;
}
