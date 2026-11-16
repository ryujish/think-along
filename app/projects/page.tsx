import Workspace from '@/components/project/Workspace';
import Studio from '@/components/studio/Studio';
import Director from '@/components/director/Director';

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.view === 'studio') return <Studio />;
  return params.source || params.project || params.demo || params.view
    ? <Workspace />
    : <Director />;
}
